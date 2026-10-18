// SPDX-License-Identifier: GPL-3.0-or-later
//
// URLs come from the API response. Only open or download the ones that
// point where they should: github.com pages and GitHub's avatar host, over
// HTTPS, without credentials or odd ports.

import GLib from 'gi://GLib';

function parse(url) {
    try {
        return GLib.Uri.parse(url, GLib.UriFlags.NONE);
    } catch {
        return null;
    }
}

function isHttpsOn(url, host) {
    const uri = parse(url);
    return uri !== null &&
        uri.get_scheme() === 'https' &&
        uri.get_host() === host &&
        uri.get_userinfo() === null &&
        uri.get_port() === -1;
}

/** A page on github.com (profile, repository). */
export function isGitHubPage(url) {
    return typeof url === 'string' && isHttpsOn(url, 'github.com');
}

/** An avatar image served by GitHub. */
export function isAvatarUrl(url) {
    return typeof url === 'string' && isHttpsOn(url, 'avatars.githubusercontent.com');
}
