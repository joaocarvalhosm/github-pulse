// SPDX-License-Identifier: GPL-3.0-or-later
//
// Colours of the contribution levels. The greens are GitHub's own scales;
// which one to use follows the menu style, told apart by its text colour.
// Level 0 is the text colour at low opacity, so it suits any background.

// levels 1-4
export const GREENS_DARK = ['#0e4429', '#006d32', '#26a641', '#39d353'];
export const GREENS_LIGHT = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];
const EMPTY_ALPHA = 0.12;

/** [r, g, b] in 0-1 for '#rrggbb'. */
export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

/** Light text means a dark style. `fg` has 0-255 red, green and blue. */
export function isDarkStyle(fg) {
    const luminance = (0.2126 * fg.red + 0.7152 * fg.green + 0.0722 * fg.blue) / 255;
    return luminance > 0.5;
}

/** [r, g, b, a] in 0-1 for each level 0-4, for text colour `fg`. */
export function levelColors(fg) {
    const greens = isDarkStyle(fg) ? GREENS_DARK : GREENS_LIGHT;
    return [
        [fg.red / 255, fg.green / 255, fg.blue / 255, EMPTY_ALPHA],
        ...greens.map(hex => [...hexToRgb(hex), 1]),
    ];
}

/** The colour itself when it is a plain '#rrggbb', otherwise a neutral grey. */
export function safeColor(color, fallback = '#8b949e') {
    return /^#[0-9a-fA-F]{6}$/.test(color ?? '') ? color : fallback;
}
