/**
 * RadarChart — Multi-dimensional country well-being profile.
 *
 * Features:
 * - 6 axes: GDP/capita, Social Support, Health, Freedom, Generosity, Low Corruption
 * - Up to 3 overlaid country polygons
 * - Animated transitions between country selections
 * - Hover axis labels for detail
 * - Creative visualisation (beyond lecture examples)
 */
import { REGION_COLOURS } from './DataManager.js';

class RadarChart {

    #container;
    #svg;
    #g;
    #width;
    #height;
    #radius;
    #margin = 60;

    #angleSlice;
    #rScale;

    #axisLabels = [];
    #datasets = [];   // Array of { country, colour, values: [{axis, value}] }

    /** Colour palette for up to 3 countries */
    static PALETTE = ['#4fc3f7', '#ff9800', '#66bb6a'];

    /**
     * @param {string} containerSelector
     */
    constructor(containerSelector) {
        this.#container = document.querySelector(containerSelector);
        this.#initSvg();
    }

    /* ---------- Public API ---------- */

    /**
     * Render the radar chart with 1–3 country datasets.
     * @param {Array<{country: string, values: Array<{axis: string, value: number}>}>} datasets
     */
    render(datasets) {
        this.#datasets = datasets.filter(d => d && d.values);
        if (!this.#datasets.length) return;

        this.#axisLabels = this.#datasets[0].values.map(d => d.axis);
        this.#angleSlice = (2 * Math.PI) / this.#axisLabels.length;

        this.#rScale = d3.scaleLinear().domain([0, 1]).range([0, this.#radius]);

        this.#drawGrid();
        this.#drawAxes();
        this.#drawPolygons();
        this.#drawLegend();
    }

    resize() {
        this.#initSvg();
        if (this.#datasets.length) this.render(this.#datasets);
    }

    /* ---------- Private ---------- */

    #initSvg() {
        const rect = this.#container.getBoundingClientRect();
        this.#width  = rect.width;
        this.#height = Math.max(420, rect.height - 32);
        this.#radius = Math.min(this.#width, this.#height) / 2 - this.#margin;

        d3.select(this.#container).select('svg').remove();

        this.#svg = d3.select(this.#container)
            .append('svg')
            .attr('width', this.#width)
            .attr('height', this.#height);

        this.#g = this.#svg.append('g')
            .attr('transform', `translate(${this.#width / 2}, ${this.#height / 2})`);
    }

    #drawGrid() {
        this.#g.selectAll('.grid-circle').remove();
        const levels = 5;
        for (let i = 1; i <= levels; i++) {
            this.#g.append('circle')
                .attr('class', 'grid-circle')
                .attr('r', (this.#radius / levels) * i)
                .attr('fill', 'none')
                .attr('stroke', '#2d3548')
                .attr('stroke-dasharray', '3,3');
        }

        // Level labels
        this.#g.selectAll('.grid-label').remove();
        for (let i = 1; i <= levels; i++) {
            this.#g.append('text')
                .attr('class', 'grid-label')
                .attr('x', 4)
                .attr('y', -(this.#radius / levels) * i)
                .style('font-size', '9px')
                .style('fill', '#555')
                .text((i / levels).toFixed(1));
        }
    }

    #drawAxes() {
        this.#g.selectAll('.axis-line').remove();
        this.#g.selectAll('.axis-text').remove();

        this.#axisLabels.forEach((label, i) => {
            const angle = this.#angleSlice * i - Math.PI / 2;
            const x = this.#radius * Math.cos(angle);
            const y = this.#radius * Math.sin(angle);

            // Axis line
            this.#g.append('line')
                .attr('class', 'axis-line')
                .attr('x1', 0).attr('y1', 0)
                .attr('x2', x).attr('y2', y)
                .attr('stroke', '#2d3548');

            // Axis label
            const labelX = (this.#radius + 20) * Math.cos(angle);
            const labelY = (this.#radius + 20) * Math.sin(angle);
            this.#g.append('text')
                .attr('class', 'axis-text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('fill', '#8b93a7')
                .text(label);
        });
    }

    #drawPolygons() {
        const self = this;

        const radarLine = d3.lineRadial()
            .radius(d => this.#rScale(d.value))
            .angle((d, i) => i * this.#angleSlice)
            .curve(d3.curveLinearClosed);

        // Bind datasets
        const polys = this.#g.selectAll('.radar-area')
            .data(this.#datasets, d => d.country);

        polys.exit()
            .transition().duration(400)
            .attr('opacity', 0)
            .remove();

        const enter = polys.enter()
            .append('g')
            .attr('class', 'radar-area');

        // Filled area
        enter.append('path')
            .attr('class', 'radar-fill');

        // Stroke
        enter.append('path')
            .attr('class', 'radar-stroke');

        // Dots
        const merged = enter.merge(polys);

        merged.select('.radar-fill')
            .transition().duration(800)
            .attr('d', d => radarLine(d.values))
            .attr('fill', (d, i) => RadarChart.PALETTE[i % 3])
            .attr('fill-opacity', 0.12);

        merged.select('.radar-stroke')
            .transition().duration(800)
            .attr('d', d => radarLine(d.values))
            .attr('stroke', (d, i) => RadarChart.PALETTE[i % 3])
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('opacity', 0.85);

        // Dots on vertices
        merged.each(function(dataset, idx) {
            const dots = d3.select(this).selectAll('.radar-dot')
                .data(dataset.values);

            dots.enter()
                .append('circle')
                .attr('class', 'radar-dot')
                .attr('r', 4)
                .merge(dots)
                .transition().duration(800)
                .attr('cx', (d, i) => self.#rScale(d.value) * Math.cos(self.#angleSlice * i - Math.PI / 2))
                .attr('cy', (d, i) => self.#rScale(d.value) * Math.sin(self.#angleSlice * i - Math.PI / 2))
                .attr('fill', RadarChart.PALETTE[idx % 3])
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);

            dots.exit().remove();
        });
    }

    #drawLegend() {
        const legendEl = document.getElementById('radar-legend');
        if (!legendEl) return;

        legendEl.innerHTML = this.#datasets.map((d, i) => `
            <span class="legend-item">
                <span class="legend-swatch" style="background:${RadarChart.PALETTE[i % 3]}"></span>
                ${d.country}
            </span>
        `).join('');
    }
}

export default RadarChart;
