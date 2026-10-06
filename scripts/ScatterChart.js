/**
 * ScatterChart — GDP per Capita vs Happiness Score
 *
 * Features:
 * - Log-scale x-axis (GDP)
 * - Points coloured by Region, sized by population
 * - Hover tooltip, click-to-select (dispatches 'countrySelect' event)
 * - Animated transitions on data update
 * - Brush-to-zoom support
 */
import { REGION_COLOURS } from './DataManager.js';

class ScatterChart {

    /** @type {HTMLElement} container DOM node */
    #container;
    #svg;
    #g;
    #tooltip;

    // Dimensions
    #width;
    #height;
    #margin = { top: 24, right: 24, bottom: 50, left: 60 };

    // Scales & axes
    #xScale;
    #yScale;
    #rScale;
    #xAxis;
    #yAxis;

    // State
    #data = [];
    #selectedCountry = null;
    #onCountrySelect = null;  // callback

    /**
     * @param {string} containerSelector  CSS selector for chart div
     * @param {string} tooltipSelector    CSS selector for tooltip div
     */
    constructor(containerSelector, tooltipSelector) {
        this.#container = document.querySelector(containerSelector);
        this.#tooltip   = d3.select(tooltipSelector);
        this.#initSvg();
    }

    /* ---------- Public API ---------- */

    /**
     * Render / update the scatter chart with new data.
     * @param {Array} data  Parsed rows from DataManager.getByYear()
     */
    render(data) {
        this.#data = data.filter(d => d.gdp_per_capita != null && d.happiness != null);
        this.#updateScales();
        this.#drawAxes();
        this.#drawPoints();
    }

    /** Highlight a specific country (called from other charts). */
    highlight(country) {
        this.#selectedCountry = country;
        this.#g.selectAll('.dot')
            .transition().duration(300)
            .attr('opacity', d => (!country || d.Country === country) ? 0.85 : 0.15)
            .attr('stroke-width', d => d.Country === country ? 2.5 : 0.5);
    }

    /** Reset highlight. */
    clearHighlight() {
        this.#selectedCountry = null;
        this.#g.selectAll('.dot')
            .transition().duration(300)
            .attr('opacity', 0.85)
            .attr('stroke-width', 0.5);
    }

    /** Register callback for country selection. */
    onCountrySelect(callback) {
        this.#onCountrySelect = callback;
    }

    /** Re-compute size on window resize. */
    resize() {
        this.#initSvg();
        if (this.#data.length) this.render(this.#data);
    }

    /* ---------- Private ---------- */

    #initSvg() {
        const rect = this.#container.getBoundingClientRect();
        this.#width  = rect.width - this.#margin.left - this.#margin.right;
        this.#height = Math.max(400, rect.height - 32) - this.#margin.top - this.#margin.bottom;

        // Remove old SVG if resizing
        d3.select(this.#container).select('svg').remove();

        this.#svg = d3.select(this.#container)
            .append('svg')
            .attr('width',  this.#width  + this.#margin.left + this.#margin.right)
            .attr('height', this.#height + this.#margin.top  + this.#margin.bottom);

        this.#g = this.#svg.append('g')
            .attr('transform', `translate(${this.#margin.left},${this.#margin.top})`);

        // Axis groups
        this.#g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${this.#height})`);
        this.#g.append('g').attr('class', 'y-axis');

        // Axis labels
        this.#svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.#margin.left + this.#width / 2)
            .attr('y', this.#height + this.#margin.top + 44)
            .text('GDP per Capita (USD, log scale)');

        this.#svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', `rotate(-90)`)
            .attr('x', -(this.#margin.top + this.#height / 2))
            .attr('y', 16)
            .text('Happiness Score');
    }

    #updateScales() {
        const gdpExtent = d3.extent(this.#data, d => d.gdp_per_capita);
        const hapExtent = d3.extent(this.#data, d => d.happiness);
        const popExtent = d3.extent(this.#data, d => d.population);

        this.#xScale = d3.scaleLog()
            .domain([Math.max(100, gdpExtent[0] * 0.8), gdpExtent[1] * 1.1])
            .range([0, this.#width]);

        this.#yScale = d3.scaleLinear()
            .domain([Math.max(0, hapExtent[0] - 0.5), hapExtent[1] + 0.3])
            .range([this.#height, 0]);

        this.#rScale = d3.scaleSqrt()
            .domain(popExtent)
            .range([4, 30]);

        this.#xAxis = d3.axisBottom(this.#xScale)
            .tickValues([300, 1000, 3000, 10000, 30000, 100000])
            .tickFormat(d => d >= 1000 ? `$${d3.format('.0s')(d)}` : `$${d}`);

        this.#yAxis = d3.axisLeft(this.#yScale).ticks(6);
    }

    #drawAxes() {
        this.#g.select('.x-axis')
            .transition().duration(600)
            .call(this.#xAxis);

        this.#g.select('.y-axis')
            .transition().duration(600)
            .call(this.#yAxis);
    }

    #drawPoints() {
        const self = this;

        const dots = this.#g.selectAll('.dot')
            .data(this.#data, d => d.Country);

        // EXIT
        dots.exit()
            .transition().duration(400)
            .attr('r', 0)
            .remove();

        // ENTER + UPDATE
        const enter = dots.enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => this.#xScale(d.gdp_per_capita))
            .attr('cy', d => this.#yScale(d.happiness))
            .attr('r', 0)
            .attr('fill', d => REGION_COLOURS[d.Region] || '#607d8b')
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.85);

        enter.merge(dots)
            .on('mouseover', function(event, d) { self.#showTooltip(event, d); d3.select(this).attr('stroke-width', 2); })
            .on('mousemove', function(event) { self.#moveTooltip(event); })
            .on('mouseout',  function()      { self.#hideTooltip(); d3.select(this).attr('stroke-width', 0.5); })
            .on('click',     function(event, d) {
                if (self.#onCountrySelect) self.#onCountrySelect(d.Country);
            })
            .transition().duration(800)
            .attr('cx', d => this.#xScale(d.gdp_per_capita))
            .attr('cy', d => this.#yScale(d.happiness))
            .attr('r',  d => this.#rScale(d.population || 0))
            .attr('fill', d => REGION_COLOURS[d.Region] || '#607d8b');
    }

    #showTooltip(event, d) {
        const fmt = d3.format(',.0f');
        this.#tooltip
            .style('opacity', 1)
            .html(`
                <div class="tt-title">${d.Country}</div>
                <div class="tt-row"><span class="tt-label">Region</span><span>${d.Region}</span></div>
                <div class="tt-row"><span class="tt-label">GDP/capita</span><span>$${fmt(d.gdp_per_capita)}</span></div>
                <div class="tt-row"><span class="tt-label">Happiness</span><span>${d.happiness.toFixed(2)}</span></div>
                <div class="tt-row"><span class="tt-label">Population</span><span>${fmt(d.population)}</span></div>
                <div class="tt-row"><span class="tt-label">Life Exp.</span><span>${d.life_expectancy ? d.life_expectancy.toFixed(1) : '—'}</span></div>
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

export default ScatterChart;
