// SPDX-License-Identifier: GPL-3.0-or-later
//
// The yearly contribution grid, drawn with Cairo on one St.DrawingArea
// (about 370 cells, cheaper than one widget each), and the small
// "Menos … Mais" legend. Geometry is in lib/grid.js, colours in
// lib/palette.js. The grid emits `day-hovered` with the index of the day
// under the pointer, or -1.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import PangoCairo from 'gi://PangoCairo';
import St from 'gi://St';

import {CELL, cellAt, layoutGrid} from '../lib/grid.js';
import {levelColors} from '../lib/palette.js';

const RADIUS = 2;
const LEGEND_GAP = 3;

function roundedRect(cr, x, y, size, r) {
    cr.newSubPath();
    cr.arc(x + size - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + size - r, y + size - r, r, 0, Math.PI / 2);
    cr.arc(x + r, y + size - r, r, Math.PI / 2, Math.PI);
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.closePath();
}

function fillCell(cr, color, x, y) {
    cr.setSourceRGBA(...color);
    roundedRect(cr, x, y, CELL, RADIUS);
    cr.fill();
}

export const Heatmap = GObject.registerClass({
    Signals: {'day-hovered': {param_types: [GObject.TYPE_INT]}},
}, class Heatmap extends St.DrawingArea {
    _init() {
        super._init({reactive: true, style_class: 'github-pulse-heatmap'});
        this._layout = layoutGrid([]);
        this._hovered = -1;
        this.connect('motion-event', (_actor, event) => this._onMotion(event));
        this.connect('leave-event', () => this._setHovered(-1));
    }

    setDays(days) {
        this._layout = layoutGrid(days);
        this.set_size(this._layout.width, this._layout.height);
        this._hovered = -1;
        this.queue_repaint();
    }

    _onMotion(event) {
        const [stageX, stageY] = event.get_coords();
        const [ok, x, y] = this.transform_stage_point(stageX, stageY);
        if (ok)
            this._setHovered(cellAt(this._layout, x, y));
        return Clutter.EVENT_PROPAGATE;
    }

    _setHovered(index) {
        if (index === this._hovered)
            return;
        this._hovered = index;
        this.queue_repaint();
        this.emit('day-hovered', index);
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const node = this.get_theme_node();
        const fg = node.get_foreground_color();
        const colors = levelColors(fg);

        // labels in the theme font, at the size set in the stylesheet
        const text = PangoCairo.create_layout(cr);
        text.set_font_description(node.get_font());
        const label = (string, x, y) => {
            text.set_text(string, -1);
            const [, logical] = text.get_pixel_extents();
            cr.moveTo(x, y - logical.height / 2);
            PangoCairo.show_layout(cr, text);
        };
        cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, 0.65);
        for (const month of this._layout.months)
            label(month.label, month.x, 7);
        for (const weekday of this._layout.weekdays)
            label(weekday.label, 0, weekday.y + CELL / 2);

        for (const cell of this._layout.cells)
            fillCell(cr, colors[cell.level] ?? colors[0], cell.x, cell.y);

        const hovered = this._layout.cells[this._hovered];
        if (hovered) {
            cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, 0.9);
            cr.setLineWidth(1.5);
            roundedRect(cr, hovered.x - 1, hovered.y - 1, CELL + 2, RADIUS + 1);
            cr.stroke();
        }
        cr.$dispose();
    }
});

/** The five level colours in a row, between "Menos" and "Mais". */
export const HeatmapLegend = GObject.registerClass(
class HeatmapLegend extends St.DrawingArea {
    _init() {
        super._init({
            style_class: 'github-pulse-legend-cells',
            width: 5 * CELL + 4 * LEGEND_GAP,
            height: CELL,
            y_align: Clutter.ActorAlign.CENTER,
        });
    }

    vfunc_repaint() {
        const cr = this.get_context();
        levelColors(this.get_theme_node().get_foreground_color())
            .forEach((color, level) => fillCell(cr, color, level * (CELL + LEGEND_GAP), 0));
        cr.$dispose();
    }
});
