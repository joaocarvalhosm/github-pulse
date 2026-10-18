// SPDX-License-Identifier: GPL-3.0-or-later
//
// Unit tests, without GNOME Shell: `make test` (runs gjs -m tests/run.js
// with a temporary XDG_CACHE_HOME).

import GLib from 'gi://GLib';
import System from 'system';

import {run} from './harness.js';
import './stats.test.js';
import './format.test.js';
import './grid.test.js';
import './palette.test.js';
import './api.test.js';
import './urls.test.js';
import './token.test.js';
import './cache.test.js';

const loop = new GLib.MainLoop(null, false);
let failures = 1;
run().then(n => {
    failures = n;
}).catch(e => print(`runner error: ${e}\n${e.stack}`)).finally(() => loop.quit());
loop.run();
if (failures)
    System.exit(1);
