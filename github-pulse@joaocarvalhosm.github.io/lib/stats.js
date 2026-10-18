// SPDX-License-Identifier: GPL-3.0-or-later
//
// Pure calculations on the contribution calendar. No GNOME imports, so the
// tests run with plain `gjs -m`.
//
// A "day" is {date: 'YYYY-MM-DD', count, level}, level 0-4 as on GitHub.

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' for a Date, in local time. */
export function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Local Date at midnight for 'YYYY-MM-DD'. */
export function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function addDays(date, n) {
    const result = new Date(date);
    result.setDate(result.getDate() + n);
    return result;
}

function byDate(days) {
    return new Map(days.map(day => [day.date, day]));
}

/**
 * Days in a row with at least one contribution, ending today. A day with no
 * contributions yet does not break the streak until it is over, so when
 * today is still empty the count starts from yesterday.
 */
export function currentStreak(days, today = new Date()) {
    const map = byDate(days);
    let date = today;
    if (!(map.get(dateKey(date))?.count > 0))
        date = addDays(date, -1);
    let length = 0;
    while (map.get(dateKey(date))?.count > 0) {
        length++;
        date = addDays(date, -1);
    }
    return length;
}

/** Longest run of days with contributions anywhere in `days`. */
export function longestStreak(days) {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    let best = 0;
    let run = 0;
    let previous = null;
    for (const day of sorted) {
        const date = parseDateKey(day.date);
        const consecutive = previous !== null &&
            Math.round((date - previous) / DAY_MS) === 1;
        if (day.count > 0)
            run = consecutive ? run + 1 : 1;
        else
            run = 0;
        best = Math.max(best, run);
        previous = date;
    }
    return best;
}

/** The `n` days ending today, oldest first; missing days count as 0. */
export function lastDays(days, n, today = new Date()) {
    const map = byDate(days);
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
        const key = dateKey(addDays(today, -i));
        result.push(map.get(key) ?? {date: key, count: 0, level: 0});
    }
    return result;
}

/** Average contributions per weekday, index 0 = Sunday. */
export function weekdayAverages(days) {
    const sums = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    for (const day of days) {
        const weekday = parseDateKey(day.date).getDay();
        sums[weekday] += day.count;
        counts[weekday]++;
    }
    return sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
}

/** {weekday, average} of the weekday with the highest average, or null. */
export function busiestWeekday(days) {
    const averages = weekdayAverages(days);
    let best = null;
    averages.forEach((average, weekday) => {
        if (average > 0 && (best === null || average > best.average))
            best = {weekday, average};
    });
    return best;
}

/**
 * Share of commits per language over the repositories you committed to,
 * largest first. Repositories without a language are left out.
 */
export function languageShares(repos) {
    const totals = new Map();
    for (const repo of repos) {
        if (!repo.language || !repo.commits)
            continue;
        const entry = totals.get(repo.language.name) ??
            {name: repo.language.name, color: repo.language.color, commits: 0};
        entry.commits += repo.commits;
        totals.set(entry.name, entry);
    }
    const sum = [...totals.values()].reduce((acc, l) => acc + l.commits, 0);
    return [...totals.values()]
        .map(l => ({name: l.name, color: l.color, share: sum ? l.commits / sum : 0}))
        .sort((a, b) => b.share - a.share);
}

/** Short Portuguese "time ago" text for an ISO timestamp. */
export function timeAgo(iso, now = new Date()) {
    const seconds = Math.max(0, (now - new Date(iso)) / 1000);
    const steps = [
        [60, 'agora', 1],
        [3600, 'min', 60],
        [86400, 'h', 3600],
        [7 * 86400, 'd', 86400],
        [30 * 86400, 'sem', 7 * 86400],
        [365 * 86400, 'meses', 30 * 86400],
    ];
    for (const [limit, unit, size] of steps) {
        if (seconds < limit) {
            if (unit === 'agora')
                return 'agora';
            const value = Math.floor(seconds / size);
            return unit === 'meses' && value === 1 ? 'há 1 mês' : `há ${value} ${unit}`;
        }
    }
    const years = Math.floor(seconds / (365 * 86400));
    return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}
