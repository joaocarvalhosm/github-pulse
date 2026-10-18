// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, test} from './harness.js';
import * as stats from '../github-pulse@joaocarvalhosm.github.io/lib/stats.js';

function days(spec) {
    // spec: {'2026-10-01': 2, ...}
    return Object.entries(spec).map(([date, count]) => ({date, count, level: count ? 1 : 0}));
}

const today = new Date(2026, 9, 15);   // 15 Oct 2026, local time

test('stats: dateKey and parseDateKey round-trip', () => {
    eq(stats.dateKey(stats.parseDateKey('2026-01-05')), '2026-01-05');
    eq(stats.dateKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('stats: current streak counts back from today', () => {
    eq(stats.currentStreak(days({'2026-10-13': 1, '2026-10-14': 2, '2026-10-15': 1}), today), 3);
});

test('stats: an empty today does not break the streak yet', () => {
    eq(stats.currentStreak(days({'2026-10-13': 1, '2026-10-14': 2, '2026-10-15': 0}), today), 2);
});

test('stats: today missing from the calendar counts as empty', () => {
    eq(stats.currentStreak(days({'2026-10-13': 1, '2026-10-14': 2}), today), 2);
});

test('stats: a gap ends the current streak', () => {
    eq(stats.currentStreak(days({'2026-10-12': 1, '2026-10-13': 0, '2026-10-14': 2}), today), 1);
});

test('stats: no contributions means no streak', () => {
    eq(stats.currentStreak(days({'2026-10-14': 0, '2026-10-15': 0}), today), 0);
    eq(stats.currentStreak([], today), 0);
});

test('stats: longest streak finds the best run', () => {
    eq(stats.longestStreak(days({
        '2026-10-01': 1, '2026-10-02': 1, '2026-10-03': 0,
        '2026-10-04': 1, '2026-10-05': 1, '2026-10-06': 1,
    })), 3);
});

test('stats: longest streak treats missing days as a gap', () => {
    eq(stats.longestStreak(days({'2026-10-01': 1, '2026-10-03': 1})), 1);
});

test('stats: longest streak does not depend on input order', () => {
    eq(stats.longestStreak(days({'2026-10-03': 1, '2026-10-01': 1, '2026-10-02': 1})), 3);
    eq(stats.longestStreak([]), 0);
});

test('stats: longest streak crosses month boundaries', () => {
    eq(stats.longestStreak(days({'2026-09-30': 1, '2026-10-01': 1})), 2);
});

test('stats: lastDays fills missing days with zero', () => {
    const result = stats.lastDays(days({'2026-10-15': 4}), 3, today);
    eq(result.map(d => [d.date, d.count]), [['2026-10-13', 0], ['2026-10-14', 0], ['2026-10-15', 4]]);
});

test('stats: lastDays crosses a month boundary', () => {
    const result = stats.lastDays([], 3, new Date(2026, 9, 1));
    eq(result.map(d => d.date), ['2026-09-29', '2026-09-30', '2026-10-01']);
});

test('stats: weekday averages', () => {
    // Sunday 11 Oct and Sunday 18 Oct, Monday 12 Oct
    const averages = stats.weekdayAverages(days({'2026-10-11': 2, '2026-10-18': 4, '2026-10-12': 3}));
    eq(averages, [3, 3, 0, 0, 0, 0, 0]);
});

test('stats: busiest weekday uses averages', () => {
    // 2026-10-11 is a Sunday, 2026-10-12 a Monday
    const best = stats.busiestWeekday(days({'2026-10-11': 1, '2026-10-12': 6, '2026-10-19': 2}));
    eq([best.weekday, best.average], [1, 4]);
});

test('stats: busiest weekday is null without contributions', () => {
    eq(stats.busiestWeekday(days({'2026-10-12': 0})), null);
    eq(stats.busiestWeekday([]), null);
});

test('stats: language shares weight by commits and skip unknown languages', () => {
    const shares = stats.languageShares([
        {language: {name: 'Python', color: '#3572A5'}, commits: 30},
        {language: {name: 'JavaScript', color: '#f1e05a'}, commits: 10},
        {language: null, commits: 50},
    ]);
    eq(shares.map(s => [s.name, s.share]), [['Python', 0.75], ['JavaScript', 0.25]]);
});

test('stats: language shares add up repositories of the same language', () => {
    const shares = stats.languageShares([
        {language: {name: 'C', color: '#555555'}, commits: 1},
        {language: {name: 'C', color: '#555555'}, commits: 3},
        {language: {name: 'Go', color: '#00ADD8'}, commits: 0},
    ]);
    eq(shares.map(s => [s.name, s.share]), [['C', 1]]);
    eq(stats.languageShares([]), []);
});

test('stats: timeAgo', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    eq(stats.timeAgo('2026-10-15T11:59:30Z', now), 'agora');
    eq(stats.timeAgo('2026-10-15T11:55:00Z', now), 'há 5 min');
    eq(stats.timeAgo('2026-10-15T09:00:00Z', now), 'há 3 h');
    eq(stats.timeAgo('2026-10-12T12:00:00Z', now), 'há 3 d');
    eq(stats.timeAgo('2026-09-20T12:00:00Z', now), 'há 3 sem');
    eq(stats.timeAgo('2026-09-10T12:00:00Z', now), 'há 1 mês');
    eq(stats.timeAgo('2026-08-01T12:00:00Z', now), 'há 2 meses');
    eq(stats.timeAgo('2025-10-01T12:00:00Z', now), 'há 1 ano');
    eq(stats.timeAgo('2024-10-01T12:00:00Z', now), 'há 2 anos');
});

test('stats: timeAgo of a future time (clock skew) is "agora"', () => {
    eq(stats.timeAgo('2026-10-15T12:05:00Z', new Date('2026-10-15T12:00:00Z')), 'agora');
});
