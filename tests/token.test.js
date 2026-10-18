// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';

import {eq, test} from './harness.js';
import {isCancelled, looksLikeToken} from '../github-pulse@joaocarvalhosm.github.io/lib/token.js';

test('token: accepts fine-grained and classic tokens', () => {
    eq(looksLikeToken(`github_pat_${'A1_'.repeat(20)}`), true);
    eq(looksLikeToken(`ghp_${'a'.repeat(36)}`), true);
});

test('token: refuses anything that could break or abuse the header', () => {
    for (const token of [
        `ghp_${'a'.repeat(36)}\n`,
        `ghp_${'a'.repeat(18)} ${'a'.repeat(18)}`,
        `Bearer ghp_${'a'.repeat(36)}`,
        `ghp_${'a'.repeat(36)}\r\nX-Evil: 1`,
        `ghp_${'a'.repeat(10)}`,
        `gho_${'a'.repeat(36)}`,
        'password123',
        '',
    ])
        eq(looksLikeToken(token), false);
});

test('token: isCancelled', () => {
    eq(isCancelled(new Gio.IOErrorEnum({code: Gio.IOErrorEnum.CANCELLED, message: 'x'})), true);
    eq(isCancelled(new Gio.IOErrorEnum({code: Gio.IOErrorEnum.FAILED, message: 'x'})), false);
    eq(isCancelled(new Error('x')), false);
    eq(isCancelled(null), false);
});
