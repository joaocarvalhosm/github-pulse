// SPDX-License-Identifier: GPL-3.0-or-later
//
// Preferences: the GitHub token (checked against the API, then stored in
// the keyring) and how often to refresh. The token is never shown again
// after saving and never goes to GSettings; the extension is told about a
// change through the `token-revision` counter.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {GitHubClient} from './lib/api.js';
import {clearToken, isCancelled, looksLikeToken, lookupToken, storeToken} from './lib/token.js';

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export default class GitHubPulsePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const client = new GitHubClient();
        const cancellable = new Gio.Cancellable();
        window.connect('close-request', () => {
            cancellable.cancel();
            client.destroy();
            return false;
        });

        const page = new Adw.PreferencesPage({icon_name: 'dialog-password-symbolic'});
        window.add(page);

        // Account
        const account = new Adw.PreferencesGroup({
            title: 'Conta do GitHub',
            description: 'Use um token fine-grained só de leitura. Em "Repository access", ' +
                'escolha os repositórios que quer ver (ou todos). As permissões padrão ' +
                '(Metadata: read-only) bastam. O token fica no chaveiro do GNOME.',
        });
        page.add(account);

        const status = new Adw.ActionRow({title: 'Verificando…'});
        account.add(status);

        const entry = new Adw.PasswordEntryRow({
            title: 'Novo token',
            show_apply_button: true,
        });
        account.add(entry);

        const remove = new Gtk.Button({
            label: 'Remover',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        status.add_suffix(remove);

        const create = new Adw.ActionRow({
            title: 'Criar um token no GitHub',
            subtitle: 'Abre github.com no navegador',
            activatable: true,
        });
        create.add_suffix(new Gtk.Image({icon_name: 'adw-external-link-symbolic'}));
        create.connect('activated', () =>
            new Gtk.UriLauncher({uri: NEW_TOKEN_URL}).launch(window, null, null));
        account.add(create);

        const showStatus = (title, subtitle = '', canRemove = false) => {
            status.title = title;
            status.subtitle = subtitle;
            remove.visible = canRemove;
        };

        const check = async token => {
            const pulse = await client.fetchPulse(token, {repoCount: 1, cancellable});
            return pulse.user.login;
        };

        const refreshStatus = async () => {
            try {
                const token = await lookupToken(cancellable);
                if (!token) {
                    showStatus('Nenhum token salvo', 'Cole um token abaixo e confirme.');
                    return;
                }
                showStatus('Verificando…', '', true);
                const login = await check(token);
                showStatus(`Conectado como @${login}`, 'Token salvo no chaveiro', true);
            } catch (e) {
                if (!isCancelled(e))
                    showStatus('Token salvo, mas com problema', e.message, true);
            }
        };

        entry.connect('apply', async () => {
            const token = entry.text.trim();
            entry.text = '';
            if (!looksLikeToken(token)) {
                showStatus('Isso não parece um token do GitHub',
                    'Tokens começam com github_pat_ (fine-grained) ou ghp_ (clássico).');
                return;
            }
            try {
                showStatus('Verificando o token…');
                const login = await check(token);
                await storeToken(token, cancellable);
                settings.set_uint('token-revision', settings.get_uint('token-revision') + 1);
                showStatus(`Conectado como @${login}`, 'Token salvo no chaveiro', true);
            } catch (e) {
                if (!isCancelled(e))
                    showStatus('Token não salvo', e.message);
            }
        });

        remove.connect('clicked', async () => {
            try {
                await clearToken(cancellable);
                settings.set_uint('token-revision', settings.get_uint('token-revision') + 1);
                showStatus('Nenhum token salvo', 'Token removido do chaveiro.');
            } catch (e) {
                if (!isCancelled(e))
                    showStatus('Não foi possível remover o token', e.message, true);
            }
        });

        // Behaviour
        const behaviour = new Adw.PreferencesGroup({title: 'Atualização'});
        page.add(behaviour);
        const refresh = new Adw.SpinRow({
            title: 'Atualizar a cada',
            subtitle: 'minutos',
            adjustment: new Gtk.Adjustment({lower: 5, upper: 240, step_increment: 5}),
        });
        settings.bind('refresh-minutes', refresh, 'value', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(refresh);
        const repos = new Adw.SpinRow({
            title: 'Repositórios recentes no menu',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 15, step_increment: 1}),
        });
        settings.bind('repo-count', repos, 'value', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(repos);

        refreshStatus();
    }
}
