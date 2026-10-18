// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, ok, test} from './harness.js';
import * as grid from '../github-pulse@joaocarvalhosm.github.io/lib/grid.js';
import {dateKey} from '../github-pulse@joaocarvalhosm.github.io/lib/stats.js';

/** `n` consecutive days starting at `start` (a local Date). */
function range(start, n) {
    return Array.from({length: n}, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        return {date: dateKey(date), count: i % 5, level: i % 5};
    });
}

// 2025-10-15 is a Wednesday; 366 days is what GitHub returns for a year
const year = range(new Date(2025, 9, 15), 366);
const layout = grid.layoutGrid(year);

test('grid: an empty calendar has no cells', () => {
    const empty = grid.layoutGrid([]);
    eq([empty.width, empty.columns, empty.cells.length, empty.months.length], [0, 0, 0, 0]);
});

test('grid: the first day goes on its weekday row', () => {
    eq(layout.offset, 3);
    eq(layout.cells[0], {index: 0, level: 0, x: grid.LEFT, y: grid.TOP + 3 * grid.STEP});
});

test('grid: weeks are columns, Sunday on top', () => {
    // index 4 is Sunday 19 Oct, the top of the second column
    eq([layout.cells[4].x, layout.cells[4].y], [grid.LEFT + grid.STEP, grid.TOP]);
});

test('grid: size fits every week', () => {
    eq(layout.columns, 53);
    eq(layout.width, grid.LEFT + 53 * grid.STEP - grid.GAP);
    eq(layout.height, grid.TOP + 7 * grid.STEP - grid.GAP);
    const last = layout.cells.at(-1);
    ok(last.x + grid.CELL <= layout.width && last.y + grid.CELL <= layout.height, 'last cell inside');
});

test('grid: months are named once, in order, without overlapping', () => {
    eq(layout.months.map(m => m.label),
        ['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out']);
    for (let i = 1; i < layout.months.length; i++)
        ok(layout.months[i].column - layout.months[i - 1].column >= 3, 'labels apart');
});

test('grid: a month with only a few days at the start is not named', () => {
    // starts on Sunday 28 Sep: the "set" label would sit right next to "out"
    const labels = grid.layoutGrid(range(new Date(2025, 8, 28), 60)).months.map(m => m.label);
    eq(labels[0], 'out');
});

test('grid: weekday names on Monday, Wednesday and Friday', () => {
    eq(layout.weekdays.map(w => w.label), ['Seg', 'Qua', 'Sex']);
    eq(layout.weekdays[0].y, grid.TOP + grid.STEP);
});

test('grid: cellAt finds the day under the pointer', () => {
    for (const index of [0, 4, 100, year.length - 1]) {
        const cell = layout.cells[index];
        eq(grid.cellAt(layout, cell.x + 1, cell.y + 1), index);
        eq(grid.cellAt(layout, cell.x + grid.CELL - 1, cell.y + grid.CELL - 1), index);
    }
});

test('grid: cellAt is -1 outside the days', () => {
    eq(grid.cellAt(layout, 2, grid.TOP + 2), -1);                       // weekday names
    eq(grid.cellAt(layout, grid.LEFT + 2, 2), -1);                      // month names
    eq(grid.cellAt(layout, grid.LEFT + 1, grid.TOP + 1), -1);           // before the first day
    eq(grid.cellAt(layout, layout.width + 5, grid.TOP + 1), -1);        // right of the grid
    eq(grid.cellAt(layout, grid.LEFT + 1, layout.height + 5), -1);      // below the grid
    const last = layout.cells.at(-1);
    eq(grid.cellAt(layout, last.x + 1, last.y + grid.STEP + 1), -1);    // after the last day
});
