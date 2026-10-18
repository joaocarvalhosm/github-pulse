// SPDX-License-Identifier: GPL-3.0-or-later
//
// A tiny test harness: test() registers, run() executes in order (async
// tests included) and reports.

import GLib from 'gi://GLib';

const tests = [];

export function test(name, fn) {
    tests.push({name, fn});
}

export function eq(actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b)
        throw new Error(`expected ${b}, got ${a}`);
}

export function ok(value, message = 'expected a truthy value') {
    if (!value)
        throw new Error(message);
}

/** Runs `fn` and returns what it threw; fails when it does not throw. */
export function throws(fn) {
    try {
        fn();
    } catch (e) {
        return e;
    }
    throw new Error('expected an exception');
}

export function fixture(name) {
    const dir = GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]);
    const path = GLib.build_filenamev([dir, 'fixtures', name]);
    return JSON.parse(new TextDecoder().decode(GLib.file_get_contents(path)[1]));
}

/** Runs every registered test; resolves to the number of failures. */
export async function run() {
    let failures = 0;
    for (const {name, fn} of tests) {
        try {
            await fn();
            print(`ok   ${name}`);
        } catch (e) {
            failures++;
            print(`FAIL ${name}: ${e.message}`);
        }
    }
    print(`\n${tests.length - failures} passed, ${failures} failed`);
    return failures;
}
