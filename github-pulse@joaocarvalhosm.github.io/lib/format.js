// SPDX-License-Identifier: GPL-3.0-or-later
//
// Texts shown in the menu, in Portuguese. Pure, so they are unit tested;
// dates use our own names instead of the locale, which may not be pt-BR.

import {parseDateKey, timeAgo} from './stats.js';

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// with the article: "aos domingos", "às segundas"
const WEEKDAYS_PLURAL = ['aos domingos', 'às segundas', 'às terças', 'às quartas',
    'às quintas', 'às sextas', 'aos sábados'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 1234 -> '1.234'. */
export function number(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function plural(n, one, many) {
    return `${number(n)} ${n === 1 ? one : many}`;
}

/** '2026-10-15' -> 'qui, 15 de outubro de 2026'. */
export function formatDay(key) {
    const date = parseDateKey(key);
    return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} de ` +
        `${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Hover text for one day of the grid. */
export function dayText(day) {
    const count = day.count === 0 ? 'Nenhuma contribuição'
        : plural(day.count, 'contribuição', 'contribuições');
    return `${count} em ${formatDay(day.date)}`;
}

/** The yearly totals that are not zero, e.g. ['38 commits', '1 issue']. */
export function totalsParts(totals) {
    return [
        [totals.commits, 'commit', 'commits'],
        [totals.pullRequests, 'pull request', 'pull requests'],
        [totals.issues, 'issue', 'issues'],
        [totals.reviews, 'revisão', 'revisões'],
    ].filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
}

/** 'Mais ativo às quartas' for weekday 3 (0 = Sunday). */
export function busiestText(weekday) {
    return `Mais ativo ${WEEKDAYS_PLURAL[weekday]}`;
}

/** Right-hand details of a repository row: stars, open items, last push. */
export function repoMeta(repo, now = new Date()) {
    const parts = [];
    if (repo.stars)
        parts.push(`★ ${number(repo.stars)}`);
    const open = (repo.openIssues ?? 0) + (repo.openPullRequests ?? 0);
    if (open)
        parts.push(plural(open, 'aberto', 'abertos'));
    parts.push(timeAgo(repo.pushedAt, now));
    return parts.join(' · ');
}
