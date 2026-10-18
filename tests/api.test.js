// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, fixture, ok, test, throws} from './harness.js';
import * as api from '../github-pulse@joaocarvalhosm.github.io/lib/api.js';

const viewer = fixture('viewer.json');
const pulse = api.parseViewer(viewer, new Date('2026-10-15T12:00:00Z'));

test('api: parseViewer maps the GraphQL response', () => {
    eq(pulse.version, api.PULSE_VERSION);
    eq(pulse.user, {login: 'octo-tester', name: 'Octo Tester',
        url: 'https://github.com/octo-tester', avatarUrl: 'https://avatars.githubusercontent.com/u/1?s=96'});
    eq(pulse.calendar.total, 57);
    eq(pulse.calendar.days.map(d => [d.date, d.count, d.level]),
        [['2026-10-11', 0, 0], ['2026-10-12', 3, 2], ['2026-10-13', 9, 4]]);
    eq(pulse.totals, {commits: 40, pullRequests: 5, issues: 3, reviews: 2, private: 7});
    eq(pulse.topRepos[1], {name: 'octo-tester/b', url: 'https://github.com/octo-tester/b',
        language: null, commits: 10});
    eq(pulse.repos[0].openIssues, 2);
    eq(pulse.repos[0].openPullRequests, 1);
    eq(pulse.repos[0].isPrivate, true);
    eq(pulse.fetchedAt, '2026-10-15T12:00:00.000Z');
});

test('api: an unknown contribution level becomes 0', () => {
    const copy = JSON.parse(JSON.stringify(viewer));
    copy.contributionsCollection.contributionCalendar.weeks[0].contributionDays[1].contributionLevel = 'NEW';
    eq(api.parseViewer(copy).calendar.days[1].level, 0);
});

test('api: parsed data is valid for the cache', () => {
    eq(api.isValidPulse(pulse), true);
});

test('api: isValidPulse rejects old or damaged data', () => {
    const broken = changes => ({...JSON.parse(JSON.stringify(pulse)), ...changes});
    eq(api.isValidPulse(null), false);
    eq(api.isValidPulse({}), false);
    eq(api.isValidPulse(broken({version: 0})), false);
    eq(api.isValidPulse(broken({user: {}})), false);
    eq(api.isValidPulse(broken({repos: null})), false);
    eq(api.isValidPulse(broken({calendar: {total: 1, days: [{date: '2026-10-11', count: 1, level: 9}]}})), false);
    eq(api.isValidPulse(broken({calendar: {total: 1, days: [{date: 'yesterday', count: 1, level: 1}]}})), false);
});

test('api: errorForStatus explains each failure', () => {
    eq(api.errorForStatus(200), null);
    eq(api.errorForStatus(401).kind, 'auth');
    eq(api.errorForStatus(403, '0').kind, 'rate');
    eq(api.errorForStatus(429).kind, 'rate');
    eq(api.errorForStatus(403, '4999').kind, 'auth');
    eq(api.errorForStatus(403).kind, 'auth');
    eq(api.errorForStatus(302).kind, 'api');      // redirects are not followed
    const error = api.errorForStatus(502);
    eq([error.kind, error.message, error instanceof api.GitHubError], ['api', 'O GitHub respondeu 502.', true]);
});

test('api: viewerFromResponse returns the viewer', () => {
    eq(api.viewerFromResponse({data: {viewer: {login: 'x'}}}), {login: 'x'});
});

test('api: GraphQL errors become a short api error', () => {
    const e = throws(() => api.viewerFromResponse({errors: [{message: 'a'}, {message: 'b'}]}));
    eq([e.kind, e.message], ['api', 'a; b']);
    const long = throws(() => api.viewerFromResponse({errors: [{message: 'x'.repeat(5000)}]}));
    eq(long.message.length, 200);
    eq(throws(() => api.viewerFromResponse({errors: [{}]})).message, 'O GitHub retornou um erro.');
});

test('api: a response without a viewer is an api error', () => {
    for (const json of [null, {}, {data: null}, {data: {viewer: null}}])
        eq(throws(() => api.viewerFromResponse(json)).kind, 'api');
});

test('api: the query never asks for write access', () => {
    ok(/^\s*query\b/.test(api.QUERY), 'is a query');
    ok(!/\bmutation\b/.test(api.QUERY), 'no mutation');
});
