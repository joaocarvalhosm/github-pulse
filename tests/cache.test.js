// SPDX-License-Identifier: GPL-3.0-or-later
//
// Runs against $XDG_CACHE_HOME, which `make test` points to a temporary
// directory. Refuses to touch the real ~/.cache.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {eq, fixture, test} from './harness.js';
import {parseViewer} from '../github-pulse@joaocarvalhosm.github.io/lib/api.js';
import * as cache from '../github-pulse@joaocarvalhosm.github.io/lib/cache.js';

const isolated = GLib.get_user_cache_dir() !== GLib.build_filenamev([GLib.get_home_dir(), '.cache']);
const pulse = parseViewer(fixture('viewer.json'));

function mode(file) {
    return file.query_info('unix::mode', Gio.FileQueryInfoFlags.NONE, null)
        .get_attribute_uint32('unix::mode') & 0o777;
}

function cacheTest(name, fn) {
    test(`cache: ${name}`, () => {
        if (!isolated)
            throw new Error('set XDG_CACHE_HOME to a temporary directory (use make test)');
        return fn();
    });
}

cacheTest('round-trip', async () => {
    await cache.savePulse(pulse);
    eq(await cache.loadPulse(), pulse);
});

cacheTest('only the owner can read it', async () => {
    await cache.savePulse(pulse);
    eq(mode(cache.cacheDir()), 0o700);
    eq(mode(cache.cacheDir().get_child('pulse.json')), 0o600);
});

cacheTest('an existing file is made private', async () => {
    const file = cache.cacheDir().get_child('pulse.json');
    file.set_attribute_uint32('unix::mode', 0o644, Gio.FileQueryInfoFlags.NONE, null);
    await cache.savePulse(pulse);
    eq(mode(file), 0o600);
});

cacheTest('damaged or old data is ignored', async () => {
    const file = cache.cacheDir().get_child('pulse.json');
    for (const contents of ['{not json', '{"version": 0}', '[]', ' ']) {
        file.replace_contents(new TextEncoder().encode(contents), null, false,
            Gio.FileCreateFlags.NONE, null);
        eq(await cache.loadPulse(), null);
    }
});

cacheTest('clearCache removes everything', async () => {
    await cache.savePulse(pulse);
    cache.avatarFile().replace_contents(new Uint8Array([1]), null, false, Gio.FileCreateFlags.NONE, null);
    cache.clearCache();
    eq(cache.cacheDir().get_child('pulse.json').query_exists(null), false);
    eq(cache.avatarFile().query_exists(null), false);
    eq(await cache.loadPulse(), null);
    cache.clearCache();   // twice is fine
});
