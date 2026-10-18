// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, test} from './harness.js';
import * as format from '../github-pulse@joaocarvalhosm.github.io/lib/format.js';

test('format: number uses dots for thousands', () => {
    eq(format.number(0), '0');
    eq(format.number(999), '999');
    eq(format.number(1234), '1.234');
    eq(format.number(1234567), '1.234.567');
    eq(format.number(undefined), '0');
    eq(format.number('x'), '0');
});

test('format: plural', () => {
    eq(format.plural(1, 'dia', 'dias'), '1 dia');
    eq(format.plural(0, 'dia', 'dias'), '0 dias');
    eq(format.plural(1500, 'dia', 'dias'), '1.500 dias');
});

test('format: formatDay does not depend on the locale', () => {
    eq(format.formatDay('2026-10-15'), 'qui, 15 de outubro de 2026');
    eq(format.formatDay('2026-03-01'), 'dom, 1 de março de 2026');
});

test('format: dayText', () => {
    eq(format.dayText({date: '2026-10-15', count: 0}), 'Nenhuma contribuição em qui, 15 de outubro de 2026');
    eq(format.dayText({date: '2026-10-15', count: 1}), '1 contribuição em qui, 15 de outubro de 2026');
    eq(format.dayText({date: '2026-10-15', count: 12}), '12 contribuições em qui, 15 de outubro de 2026');
});

test('format: totalsParts leaves out zeros', () => {
    eq(format.totalsParts({commits: 38, pullRequests: 1, issues: 0, reviews: 2}),
        ['38 commits', '1 pull request', '2 revisões']);
    eq(format.totalsParts({commits: 0, pullRequests: 0, issues: 0, reviews: 0}), []);
});

test('format: repoMeta', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const pushedAt = '2026-10-15T09:00:00Z';
    eq(format.repoMeta({stars: 0, openIssues: 0, openPullRequests: 0, pushedAt}, now), 'há 3 h');
    eq(format.repoMeta({stars: 1200, openIssues: 2, openPullRequests: 1, pushedAt}, now),
        '★ 1.200 · 3 abertos · há 3 h');
    eq(format.repoMeta({stars: 1, openIssues: 1, pushedAt}, now), '★ 1 · 1 aberto · há 3 h');
});

test('format: busiestText uses the right article', () => {
    eq(format.busiestText(0), 'Mais ativo aos domingos');
    eq(format.busiestText(3), 'Mais ativo às quartas');
    eq(format.busiestText(6), 'Mais ativo aos sábados');
});
