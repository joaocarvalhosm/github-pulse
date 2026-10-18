// SPDX-License-Identifier: GPL-3.0-or-later
//
// Top-bar button (the last 7 days as squares) and its menu:
//
//   header       photo, name, freshness, and the refresh/profile/settings buttons
//   message      only when something is missing or failing
//   tiles        contributions, current streak, record, today
//   grid         the year, with the hovered day and the legend under it
//   summary      yearly totals, busiest weekday, languages
//   repositories the most recently pushed ones
//
// It only renders; fetching and caching live in extension.js.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as format from '../lib/format.js';
import {safeColor} from '../lib/palette.js';
import * as stats from '../lib/stats.js';
import {isGitHubPage} from '../lib/urls.js';
import {Heatmap, HeatmapLegend} from './heatmap.js';

const MAX_LANGUAGES = 4;
const HOVER_HINT = 'Passe o mouse sobre um dia';

function openUrl(url) {
    if (!isGitHubPage(url))
        return;
    Gio.AppInfo.launch_default_for_uri(url, global.create_app_launch_context(0, -1));
}

function label(text = '', styleClass = '', props = {}) {
    return new St.Label({text, style_class: styleClass, y_align: Clutter.ActorAlign.CENTER, ...props});
}

/** Non-clickable menu row holding arbitrary widgets. */
function staticItem(child, styleClass = '') {
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive: false, can_focus: false, style_class: styleClass,
    });
    item.add_child(child);
    return item;
}

/** Big number with a caption under it. */
function tile(caption) {
    const box = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        style_class: 'github-pulse-tile',
        x_expand: true,
    });
    box.valueLabel = label('–', 'github-pulse-tile-value');
    box.add_child(box.valueLabel);
    box.add_child(label(caption, 'github-pulse-tile-caption'));
    return box;
}

/** Round icon button, as in the Quick Settings and the calendar. */
function iconButton(iconName, accessibleName, onClicked) {
    const button = new St.Button({
        style_class: 'icon-button github-pulse-icon-button',
        icon_name: iconName,
        accessible_name: accessibleName,
        can_focus: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    button.connect('clicked', onClicked);
    return button;
}

function colorDot(color) {
    return new St.Widget({
        style_class: 'github-pulse-dot',
        style: `background-color: ${safeColor(color)};`,
        y_align: Clutter.ActorAlign.CENTER,
    });
}

export const PulseIndicator = GObject.registerClass({
    Signals: {
        'refresh-requested': {},
        'settings-requested': {},
    },
}, class PulseIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, 'GitHub Pulse');
        this._pulse = null;
        this._error = null;
        this._hasToken = true;
        this._loading = false;

        const panelBox = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._panelIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${extension.path}/icons/github-pulse-symbolic.svg`),
            style_class: 'system-status-icon',
        });
        this._strip = new St.BoxLayout({
            style_class: 'github-pulse-strip',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        this._stripCells = [];
        for (let i = 0; i < 7; i++) {
            const cell = new St.Widget({style_class: 'github-pulse-strip-cell github-pulse-l0'});
            this._stripCells.push(cell);
            this._strip.add_child(cell);
        }
        panelBox.add_child(this._panelIcon);
        panelBox.add_child(this._strip);
        this.add_child(panelBox);

        this.menu.box.add_style_class_name('github-pulse-menu');
        this._buildHeader();
        this._buildMessage();
        this._data = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._data);
        this._buildTiles();
        this._buildGrid();
        this._buildSummary();
        this._buildRepos();

        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._updateSubtitle();
        });
    }

    _buildHeader() {
        const header = new St.BoxLayout({style_class: 'github-pulse-header', x_expand: true});
        this._avatar = new St.Bin({
            style_class: 'github-pulse-avatar',
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: 'avatar-default-symbolic', icon_size: 24}),
        });
        const names = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this._nameLabel = label('GitHub Pulse', 'github-pulse-name');
        this._subtitleLabel = label('', 'github-pulse-subtitle');
        names.add_child(this._nameLabel);
        names.add_child(this._subtitleLabel);

        const buttons = new St.BoxLayout({style_class: 'github-pulse-buttons'});
        this._refreshButton = iconButton('view-refresh-symbolic', 'Atualizar agora',
            () => this.emit('refresh-requested'));
        this._profileButton = iconButton('web-browser-symbolic', 'Abrir perfil no GitHub', () => {
            this.menu.close();
            openUrl(this._pulse?.user.url);
        });
        const settingsButton = iconButton('emblem-system-symbolic', 'Configurações', () => {
            this.menu.close();
            this.emit('settings-requested');
        });
        buttons.add_child(this._refreshButton);
        buttons.add_child(this._profileButton);
        buttons.add_child(settingsButton);

        header.add_child(this._avatar);
        header.add_child(names);
        header.add_child(buttons);
        this.menu.addMenuItem(staticItem(header));
    }

    _buildMessage() {
        // Shown instead of the data when something is missing or failing
        this._messageItem = new PopupMenu.PopupImageMenuItem('', 'dialog-information-symbolic',
            {style_class: 'github-pulse-message'});
        this._messageItem.label.clutter_text.line_wrap = true;
        this._messageItem.label.x_expand = true;
        this._messageItem.connect('activate', () => this.emit(
            this._hasToken && this._error?.kind !== 'auth' ? 'refresh-requested' : 'settings-requested'));
        this.menu.addMenuItem(this._messageItem);
    }

    _buildTiles() {
        const tiles = new St.BoxLayout({style_class: 'github-pulse-tiles', x_expand: true});
        tiles.layout_manager.homogeneous = true;
        this._totalTile = tile('no último ano');
        this._streakTile = tile('sequência atual');
        this._bestTile = tile('recorde');
        this._todayTile = tile('hoje');
        for (const t of [this._totalTile, this._streakTile, this._bestTile, this._todayTile])
            tiles.add_child(t);
        this._data.addMenuItem(staticItem(tiles));
    }

    _buildGrid() {
        const box = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'github-pulse-grid',
            x_expand: true,
        });
        this._heatmap = new Heatmap();
        this._heatmap.connect('day-hovered', (_heatmap, index) => this._onDayHovered(index));

        const footer = new St.BoxLayout({style_class: 'github-pulse-grid-footer', x_expand: true});
        this._hoverLabel = label(HOVER_HINT, 'github-pulse-hover', {x_expand: true});
        const legend = new St.BoxLayout({style_class: 'github-pulse-legend'});
        legend.add_child(label('Menos', 'github-pulse-legend-text'));
        legend.add_child(new HeatmapLegend());
        legend.add_child(label('Mais', 'github-pulse-legend-text'));
        footer.add_child(this._hoverLabel);
        footer.add_child(legend);

        box.add_child(this._heatmap);
        box.add_child(footer);
        this._data.addMenuItem(staticItem(box));
    }

    _buildSummary() {
        this._data.addMenuItem(staticItem(label('Resumo do ano', 'github-pulse-heading')));
        const box = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'github-pulse-summary',
            x_expand: true,
        });
        this._totalsLabel = label('', 'github-pulse-totals');
        this._totalsLabel.clutter_text.line_wrap = true;
        this._busiestLabel = label('', 'github-pulse-dim');
        this._languageBar = new St.BoxLayout({style_class: 'github-pulse-language-bar'});
        this._languageLegend = new St.BoxLayout({style_class: 'github-pulse-language-legend'});
        box.add_child(this._totalsLabel);
        box.add_child(this._busiestLabel);
        box.add_child(this._languageBar);
        box.add_child(this._languageLegend);
        this._data.addMenuItem(staticItem(box));
    }

    _buildRepos() {
        this._data.addMenuItem(staticItem(label('Repositórios recentes', 'github-pulse-heading')));
        this._reposSection = new PopupMenu.PopupMenuSection();
        this._data.addMenuItem(this._reposSection);
    }

    /**
     * state: {pulse, error, loading, hasToken}. `pulse` may be the cached
     * copy while `error` explains why it could not be refreshed.
     */
    update({pulse, error = null, loading = false, hasToken = true}) {
        this._pulse = pulse ?? null;
        this._error = error;
        this._hasToken = hasToken;
        this._loading = loading;

        const showData = this._pulse !== null && hasToken;
        this._data.actor.visible = showData;
        this._strip.visible = showData;
        this._panelIcon.visible = !showData;
        this._panelIcon.opacity = error || !hasToken ? 166 : 255;
        this._profileButton.visible = showData;
        this._refreshButton.reactive = hasToken && !loading;

        this._showMessage();
        if (showData) {
            this._render(this._pulse);
        } else {
            this._nameLabel.text = 'GitHub Pulse';
            this._setAvatar(null);
        }
        this._updateSubtitle();
    }

    _showMessage() {
        let text = null;
        let icon = 'dialog-information-symbolic';
        if (!this._hasToken) {
            text = 'Conecte sua conta do GitHub nas configurações.';
            icon = 'system-users-symbolic';
        } else if (this._error) {
            text = this._pulse ? `Mostrando dados salvos. ${this._error.message}` : this._error.message;
            icon = this._error.kind === 'network' ? 'network-offline-symbolic' : 'dialog-warning-symbolic';
        } else if (!this._pulse) {
            text = 'Carregando…';
        }
        this._messageItem.visible = text !== null;
        this._messageItem.label.text = text ?? '';
        this._messageItem.setIcon(icon);
        this._messageItem.setSensitive(!this._hasToken || this._error !== null);
    }

    _render(pulse) {
        const today = new Date();
        const days = pulse.calendar.days;

        this._nameLabel.text = pulse.user.name || pulse.user.login;
        this._setAvatar(pulse.avatarPath);

        const week = stats.lastDays(days, 7, today);
        week.forEach((day, i) => {
            this._stripCells[i].style_class = `github-pulse-strip-cell github-pulse-l${day.level}`;
        });

        this._totalTile.valueLabel.text = format.number(pulse.calendar.total);
        this._streakTile.valueLabel.text = format.plural(stats.currentStreak(days, today), 'dia', 'dias');
        this._bestTile.valueLabel.text = format.plural(stats.longestStreak(days), 'dia', 'dias');
        this._todayTile.valueLabel.text = format.number(week[6].count);

        this._heatmap.setDays(days);
        this._onDayHovered(-1);

        const parts = format.totalsParts(pulse.totals);
        if (pulse.totals.private)
            parts.push(`${format.number(pulse.totals.private)} em repositórios privados`);
        this._totalsLabel.text = parts.length ? parts.join(' · ') : 'Nenhuma contribuição no último ano';

        const busiest = stats.busiestWeekday(days);
        this._busiestLabel.visible = busiest !== null;
        if (busiest)
            this._busiestLabel.text = format.busiestText(busiest.weekday);

        this._renderLanguages(stats.languageShares(pulse.topRepos));
        this._renderRepos(pulse.repos);
    }

    _setAvatar(path) {
        if (path) {
            const uri = Gio.File.new_for_path(path).get_uri();
            this._avatar.style = `background-image: url("${uri}");`;
            this._avatar.child.visible = false;
        } else {
            this._avatar.style = null;
            this._avatar.child.visible = true;
        }
    }

    _onDayHovered(index) {
        const day = this._pulse?.calendar.days[index];
        this._hoverLabel.text = day ? format.dayText(day) : HOVER_HINT;
    }

    _renderLanguages(shares) {
        this._languageBar.destroy_all_children();
        this._languageLegend.destroy_all_children();
        const top = shares.slice(0, MAX_LANGUAGES);
        this._languageBar.visible = this._languageLegend.visible = top.length > 0;
        // as wide as the grid above it; the gaps between segments are 2px
        const width = this._heatmap.width - 2 * (top.length - 1);
        const total = top.reduce((sum, l) => sum + l.share, 0);
        top.forEach((language, i) => {
            const segment = new St.Widget({
                style_class: 'github-pulse-language-segment',
                style: `background-color: ${safeColor(language.color)};`,
                width: Math.max(6, Math.round(language.share / total * width)),
            });
            if (i === 0)
                segment.add_style_class_name('first');
            if (i === top.length - 1)
                segment.add_style_class_name('last');
            this._languageBar.add_child(segment);

            const entry = new St.BoxLayout({style_class: 'github-pulse-language-entry'});
            entry.add_child(colorDot(language.color));
            entry.add_child(label(language.name));
            entry.add_child(label(`${Math.round(language.share * 100)}%`, 'github-pulse-dim'));
            this._languageLegend.add_child(entry);
        });
    }

    _renderRepos(repos) {
        this._reposSection.removeAll();
        if (!repos.length) {
            this._reposSection.addMenuItem(staticItem(label('Nenhum repositório seu ainda', 'github-pulse-dim')));
            return;
        }
        for (const repo of repos) {
            const item = new PopupMenu.PopupBaseMenuItem({style_class: 'github-pulse-repo'});
            item.add_child(colorDot(repo.language?.color));
            item.add_child(label(repo.name, 'github-pulse-repo-name'));
            if (repo.isPrivate) {
                item.add_child(new St.Icon({
                    icon_name: 'changes-prevent-symbolic',
                    style_class: 'github-pulse-repo-icon',
                    accessible_name: 'Privado',
                    y_align: Clutter.ActorAlign.CENTER,
                }));
            }
            item.add_child(label(format.repoMeta(repo), 'github-pulse-dim', {
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
            }));
            item.connect('activate', () => openUrl(repo.url));
            this._reposSection.addMenuItem(item);
        }
    }

    _updateSubtitle() {
        const login = this._pulse && this._hasToken ? `@${this._pulse.user.login} · ` : '';
        if (this._loading)
            this._subtitleLabel.text = `${login}atualizando…`;
        else if (this._pulse && this._hasToken)
            this._subtitleLabel.text = `${login}atualizado ${stats.timeAgo(this._pulse.fetchedAt)}`;
        else
            this._subtitleLabel.text = this._hasToken ? 'Sua atividade no GitHub' : 'Nenhuma conta conectada';
    }
});
