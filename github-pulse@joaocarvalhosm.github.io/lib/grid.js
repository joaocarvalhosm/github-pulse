// SPDX-License-Identifier: GPL-3.0-or-later
//
// Geometry of the yearly grid, as on github.com: one column per week,
// Sunday on top, month names over the columns and Seg/Qua/Sex on the left.
// Pure, so the layout and the hit test are unit tested.

export const CELL = 10;
export const GAP = 3;
export const STEP = CELL + GAP;
export const LEFT = 30;       // room for the weekday names
export const TOP = 18;        // room for the month names
const MONTH_LABEL_COLUMNS = 3;

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAY_LABELS = [[1, 'Seg'], [3, 'Qua'], [5, 'Sex']];

function weekdayOf(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
}

function monthOf(key) {
    return Number(key.slice(5, 7)) - 1;
}

/**
 * Cell positions and labels for `days` ({date: 'YYYY-MM-DD', level}, oldest
 * first, consecutive). Coordinates are in pixels from the top left corner.
 */
export function layoutGrid(days) {
    const offset = days.length ? weekdayOf(days[0].date) : 0;
    const columns = Math.ceil((days.length + offset) / 7);
    const width = days.length ? LEFT + columns * STEP - GAP : 0;
    const height = TOP + 7 * STEP - GAP;

    const cells = days.map((day, index) => {
        const slot = index + offset;
        return {
            index,
            level: day.level,
            x: LEFT + Math.floor(slot / 7) * STEP,
            y: TOP + (slot % 7) * STEP,
        };
    });

    // A month is named over the first column where it shows up; a label
    // that would run into the next one (a month's last days at the start
    // of the year) or past the right edge is left out.
    const months = [];
    let previous = -1;
    for (let column = 0; column < columns; column++) {
        const first = Math.max(0, column * 7 - offset);
        const month = monthOf(days[first].date);
        if (month !== previous)
            months.push({column, x: LEFT + column * STEP, label: MONTHS[month]});
        previous = month;
    }
    const visible = months.filter((label, i) => {
        const next = months[i + 1]?.column ?? columns;
        return next - label.column >= MONTH_LABEL_COLUMNS ||
            (i === months.length - 1 && columns - label.column >= 2);
    });

    const weekdays = WEEKDAY_LABELS.map(([row, label]) => ({y: TOP + row * STEP, label}));
    return {offset, columns, width, height, cells, months: visible, weekdays};
}

/** Index of the day under (x, y), or -1. */
export function cellAt(layout, x, y) {
    if (x < LEFT || y < TOP)
        return -1;
    const column = Math.floor((x - LEFT) / STEP);
    const row = Math.floor((y - TOP) / STEP);
    if (row > 6 || column >= layout.columns)
        return -1;
    const index = column * 7 + row - layout.offset;
    return index >= 0 && index < layout.cells.length ? index : -1;
}
