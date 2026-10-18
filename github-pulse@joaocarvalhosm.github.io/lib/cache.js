// SPDX-License-Identifier: GPL-3.0-or-later
//
// Last good response, so the menu has data at login and while offline.
// Lives in ~/.cache/github-pulse/ with owner-only permissions, because it
// can contain the names of private repositories. Never holds the token.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {isValidPulse} from './api.js';

Gio._promisify(Gio.File.prototype, 'load_contents_async');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export function cacheDir() {
    return Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_cache_dir(), 'github-pulse']));
}

function ensureDir() {
    const dir = cacheDir();
    // mkdir_with_parents does not fail when the directory exists
    GLib.mkdir_with_parents(dir.get_path(), DIR_MODE);
    return dir;
}

export function avatarFile() {
    return ensureDir().get_child('avatar.png');
}

export async function loadPulse(cancellable = null) {
    try {
        const [contents] = await cacheDir().get_child('pulse.json')
            .load_contents_async(cancellable);
        const pulse = JSON.parse(new TextDecoder().decode(contents));
        return isValidPulse(pulse) ? pulse : null;
    } catch {
        return null;   // no cache yet, or unreadable: fetch again
    }
}

export async function savePulse(pulse, cancellable = null) {
    const file = ensureDir().get_child('pulse.json');
    const bytes = new GLib.Bytes(new TextEncoder().encode(JSON.stringify(pulse)));
    await file.replace_contents_bytes_async(bytes, null, false,
        Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable);
    // PRIVATE only applies to new files; an older file keeps its mode
    file.set_attribute_uint32('unix::mode', FILE_MODE, Gio.FileQueryInfoFlags.NONE, null);
}

/** Remove everything (used when the token is removed). */
export function clearCache() {
    for (const name of ['pulse.json', 'avatar.png']) {
        try {
            cacheDir().get_child(name).delete(null);
        } catch {
            // already gone
        }
    }
}
