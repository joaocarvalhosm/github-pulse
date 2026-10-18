// SPDX-License-Identifier: GPL-3.0-or-later

import {eq, test} from './harness.js';
import * as palette from '../github-pulse@joaocarvalhosm.github.io/lib/palette.js';

const WHITE = {red: 255, green: 255, blue: 255};
const DARK_TEXT = {red: 30, green: 30, blue: 30};

test('palette: hexToRgb', () => {
    eq(palette.hexToRgb('#ff0000'), [1, 0, 0]);
    eq(palette.hexToRgb('#000000'), [0, 0, 0]);
});

test('palette: light text means a dark style', () => {
    eq(palette.isDarkStyle(WHITE), true);
    eq(palette.isDarkStyle(DARK_TEXT), false);
});

test('palette: five levels, the greens follow the style', () => {
    const dark = palette.levelColors(WHITE);
    const light = palette.levelColors(DARK_TEXT);
    eq(dark.length, 5);
    eq(dark[4], [...palette.hexToRgb(palette.GREENS_DARK[3]), 1]);
    eq(light[1], [...palette.hexToRgb(palette.GREENS_LIGHT[0]), 1]);
});

test('palette: an empty day is the text colour, faint', () => {
    const [r, g, b, a] = palette.levelColors(WHITE)[0];
    eq([r, g, b], [1, 1, 1]);
    eq(a > 0 && a < 0.3, true);
});

test('palette: safeColor only lets plain hex colours into CSS', () => {
    eq(palette.safeColor('#3572A5'), '#3572A5');
    eq(palette.safeColor('#fff'), '#8b949e');
    eq(palette.safeColor('red'), '#8b949e');
    eq(palette.safeColor('#000000; background-image: url(x)'), '#8b949e');
    eq(palette.safeColor(null), '#8b949e');
    eq(palette.safeColor(undefined, '#123456'), '#123456');
});
