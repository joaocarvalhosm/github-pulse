// SPDX-License-Identifier: GPL-3.0-or-later
//
// GitHub Pulse: fetches your GitHub activity on a timer and hands it to the
// top-bar indicator. The token comes from the keyring on every refresh and
// is not kept in memory between refreshes.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {GitHubClient} from './lib/api.js';
import * as cache from './lib/cache.js';
import {isCancelled, lookupToken, releaseSchema} from './lib/token.js';
import {isAvatarUrl} from './lib/urls.js';
import {PulseIndicator} from './ui/indicator.js';

const STALE_ON_OPEN_SECONDS = 5 * 60;

export default class GitHubPulseExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._client = new GitHubClient();
        this._cancellable = new Gio.Cancellable();
        this._state = {pulse: null, error: null, loading: false, hasToken: true};
        this._refreshing = false;

        this._indicator = new PulseIndicator(this);
        this._indicator.connect('refresh-requested', () => this._refresh());
        this._indicator.connect('settings-requested', () => this.openPreferences());
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open && this._isStale())
                this._refresh();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settingsIds = [
            this._settings.connect('changed::refresh-minutes', () => this._startTimer()),
            this._settings.connect('changed::repo-count', () => this._refresh()),
            this._settings.connect('changed::token-revision', () => this._refresh()),
        ];
        this._startTimer();
        this._start();
    }

    async _start() {
        const cancellable = this._cancellable;
        const cached = await cache.loadPulse(cancellable);
        if (cancellable.is_cancelled())
            return;
        if (cached) {
            // the picture is always our own file, whatever the cache says
            const avatar = cache.avatarFile();
            cached.avatarPath = avatar.query_exists(null) ? avatar.get_path() : null;
            this._setState({pulse: cached});
        }
        this._refresh();
    }

    _setState(changes) {
        Object.assign(this._state, changes);
        this._indicator?.update(this._state);
    }

    _isStale() {
        const fetched = this._state.pulse?.fetchedAt;
        return !fetched || (Date.now() - Date.parse(fetched)) / 1000 > STALE_ON_OPEN_SECONDS;
    }

    _startTimer() {
        if (this._timerId)
            GLib.source_remove(this._timerId);
        const seconds = this._settings.get_uint('refresh-minutes') * 60;
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _refresh() {
        if (this._refreshing)
            return;
        this._refreshing = true;
        const cancellable = this._cancellable;
        try {
            const token = await lookupToken(cancellable);
            if (cancellable.is_cancelled())
                return;
            if (!token) {
                cache.clearCache();
                this._setState({pulse: null, error: null, loading: false, hasToken: false});
                return;
            }
            this._setState({loading: true, hasToken: true});
            const pulse = await this._client.fetchPulse(token, {
                repoCount: this._settings.get_uint('repo-count'),
                cancellable,
            });
            pulse.avatarPath = await this._avatar(pulse, cancellable);
            if (cancellable.is_cancelled())
                return;
            await cache.savePulse(pulse, cancellable);
            if (cancellable.is_cancelled())
                return;
            this._setState({pulse, error: null, loading: false});
        } catch (e) {
            if (isCancelled(e) || cancellable.is_cancelled())
                return;
            // keep showing the last good data, with the reason it is old
            this._setState({error: e, loading: false});
            if (!e.kind)
                logError(e, 'GitHub Pulse');
        } finally {
            this._refreshing = false;
        }
    }

    /** Path of the cached avatar, downloading it only when it changed. */
    async _avatar(pulse, cancellable) {
        const url = pulse.user.avatarUrl;
        const file = cache.avatarFile();
        const previous = this._state.pulse;
        if (previous?.user.avatarUrl === url && previous.avatarPath && file.query_exists(null))
            return file.get_path();
        if (!isAvatarUrl(url))
            return null;
        try {
            await this._client.download(url, file, cancellable);
            return file.get_path();
        } catch (e) {
            if (isCancelled(e))
                throw e;
            return null;   // the menu works without the picture
        }
    }

    disable() {
        this._cancellable.cancel();
        this._cancellable = null;
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._settingsIds = null;
        this._settings = null;
        this._indicator.destroy();
        this._indicator = null;
        this._client.destroy();
        this._client = null;
        this._state = null;
        releaseSchema();
    }
}
