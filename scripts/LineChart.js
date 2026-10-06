/**
 * LineChart — Multi-series line chart for long-range World Bank trends (1990–2023).
 *
 * Features:
 * - Multiple country lines with smooth curves
 * - Switchable metric (GDP, life expectancy, population, CO₂)
 * - Animated line drawing via stroke-dasharray
 * - Hover crosshair + tooltip
 * - Click on line → select country (bidirectional with scatter)
 */
import { REGION_COLOURS } from './DataManager.js';

class LineChart {

    #container;
    #svg;
    #g;
    #tooltip;

    #width;
    #height;
    #margin = { top: 24, right: 120, bottom: 50, left: 70 };

    #xScale;
    #yScale;
    #line;
    #xAxis;
    #yAxis;

    #data = [];
    #metric = 'GDP_current_US';
    #countries = [];
    #colourMap = {};
    #onCountrySelect = null;

    /**
     * @param {string} containerSelector
     * @param {string} tooltipSelector
     */
    constructor(containerSelector, tooltipSelector) {
        this.#container = document.querySelector(containerSelector);
        this.#tooltip   = d3.select(tooltipSelector);
        this.#initSvg();
    }

    /* ---------- Public API ---------- */

    /**
     * Render trend lines.
     * @param {Array} data       Rows from DataManager.getTrends(countries)
     * @param {string} metric    Column name to plot on y-axis
     * @param {Object} colourMap Country → colour mapping
     */
    render(data, metric, colourMap) {
        this.#data = data;
        this.#metric = metric || this.#metric;
        this.#colourMap = colourMap || {};
        this.#countries = [...new Set(data.map(d => d.Country))];
        this.#updateScales();
        this.#drawAxes();
        this.#drawLines();
        this.#drawLegend();
    }

    /** Update metric without reloading data. */
    setMetric(metric) {
        this.#metric = metric;
        this.#updateScales();
        this.#drawAxes();
        this.#drawLines();
    }

    onCountrySelect(callback) {
        this.#onCountrySelect = callback;
    }

    resize() {
        this.#initSvg();
        if (this.#data.length) this.render(this.#data, this.#metric, this.#colourMap);
    }

    /* ---------- Private ---------- */

    #initSvg() {
        const rect = this.#container.getBoundingClientRect();
        this.#width  = rect.width - this.#margin.left - this.#margin.right;
        this.#height = Math.max(400, rect.height - 32) - this.#margin.top - this.#margin.bottom;

        d3.select(this.#container).select('svg').remove();

        this.#svg = d3.select(this.#container)
            .append('svg')
            .attr('width',  this.#width  + this.#margin.left + this.#margin.right)
            .attr('height', this.#height + this.#margin.top  + this.#margin.bottom);

        this.#g = this.#svg.append('g')
            .attr('transform', `translate(${this.#margin.left},${this.#margin.top})`);

        this.#g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${this.#height})`);
        this.#g.append('g').attr('class', 'y-axis');
        this.#g.append('g').attr('class', 'lines-group');
        this.#g.append('g').attr('class', 'legend-group');

        // Crosshair line
        this.#g.append('line')
            .attr('class', 'crosshair')
            .attr('y1', 0).attr('y2', this.#height)
            .attr('stroke', '#555').attr('stroke-dasharray', '3,3')
            .attr('opacity', 0);

        // X-axis label
        this.#svg.append('text').attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.#margin.left + this.#width / 2)
            .attr('y', this.#height + this.#margin.top + 44)
            .text('Year');
    }

    #updateScales() {
        const yearExtent = d3.extent(this.#data, d => d.Year);
        const vals = this.#data.map(d => d[this.#metric]).filter(v => v != null);
        const yExtent = d3.extent(vals);

        this.#xScale = d3.scaleLinear()
            .domain(yearExtent)
            .range([0, this.#width]);

        this.#yScale = d3.scaleLinear()
            .domain([Math.min(0, yExtent[0]), yExtent[1] * 1.05])
            .nice()
            .range([this.#height, 0]);

        this.#line = d3.line()
            .defined(d => d[this.#metric] != null)
            .x(d => this.#xScale(d.Year))
            .y(d => this.#yScale(d[this.#metric]))
            .curve(d3.curveCardinal.tension(0.5));

        this.#xAxis = d3.axisBottom(this.#xScale).tickFormat(d3.format('d')).ticks(8);

        // Smart y-axis format based on metric
        const metricFormats = {
            'GDP_current_US': d3.format('.2s'),
            'life_expectancy': d3.format('.0f'),
            'population': d3.format('.2s'),
            'CO2_emissions': d3.format('.2s')
        };
        this.#yAxis = d3.axisLeft(this.#yScale).ticks(6)
            .tickFormat(metricFormats[this.#metric] || d3.format('.2s'));
    }

    #drawAxes() {
        this.#g.select('.x-axis').transition().duration(600).call(this.#xAxis);
        this.#g.select('.y-axis').transition().duration(600).call(this.#yAxis);
    }

    #drawLines() {
        const self = this;
        const grouped = d3.group(this.#data, d => d.Country);
        const lineData = Array.from(grouped, ([country, rows]) => ({
            country,
            values: rows.sort((a, b) => a.Year - b.Year)
        }));

        const linesGroup = this.#g.select('.lines-group');

        const paths = linesGroup.selectAll('.trend-line')
            .data(lineData, d => d.country);

        paths.exit()
            .transition().duration(400).attr('opacity', 0).remove();

        const enter = paths.enter()
            .append('path')
            .attr('class', 'trend-line')
            .attr('fill', 'none')
            .attr('stroke-width', 2.5)
            .attr('opacity', 0);

        enter.merge(paths)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('stroke-width', 4);
                self.#showTooltip(event, d);
            })
            .on('mousemove', function(event) { self.#moveTooltip(event); })
            .on('mouseout', function() {
                d3.select(this).attr('stroke-width', 2.5);
                self.#hideTooltip();
            })
            .on('click', function(event, d) {
                if (self.#onCountrySelect) self.#onCountrySelect(d.country);
            })
            .transition().duration(800)
            .attr('d', d => this.#line(d.values))
            .attr('stroke', d => this.#colourMap[d.country] || '#4fc3f7')
            .attr('opacity', 0.9);

        // Animate line drawing for newly entered paths
        enter.each(function() {
            const totalLength = this.getTotalLength ? this.getTotalLength() : 0;
            if (totalLength) {
                d3.select(this)
                    .attr('stroke-dasharray', totalLength)
                    .attr('stroke-dashoffset', totalLength)
                    .transition().duration(1200).ease(d3.easeQuadOut)
                    .attr('stroke-dashoffset', 0)
                    .attr('opacity', 0.9);
            }
        });
    }

    #drawLegend() {
        const legendGroup = this.#g.select('.legend-group');
        legendGroup.selectAll('*').remove();

        this.#countries.forEach((country, i) => {
            const g = legendGroup.append('g')
                .attr('transform', `translate(${this.#width + 10}, ${i * 20})`);

            g.append('line')
                .attr('x1', 0).attr('x2', 18)
                .attr('y1', 0).attr('y2', 0)
                .attr('stroke', this.#colourMap[country] || '#4fc3f7')
                .attr('stroke-width', 2.5);

            g.append('text')
                .attr('x', 24).attr('y', 4)
                .style('font-size', '11px')
                .text(country);
        });
    }

    #showTooltip(event, d) {
        const fmt = d3.format('.2s');
        const latest = d.values[d.values.length - 1];
        this.#tooltip
            .style('opacity', 1)
            .html(`
                <div class="tt-title">${d.country}</div>
                <div class="tt-row"><span class="tt-label">Latest (${latest.Year})</span><span>${latest[this.#metric] != null ? fmt(latest[this.#metric]) : '—'}</span></div>
                <div class="tt-row"><span class="tt-label">Data points</span><span>${d.values.length}</span></div>
            `);
    }

    #moveTooltip(event) {
        this.#tooltip
            .style('left', (event.offsetX + 16) + 'px')
            .style('top',  (event.offsetY - 10) + 'px');
    }

    #hideTooltip() {
        this.#tooltip.style('opacity', 0);
    }
}

export default LineChart;
