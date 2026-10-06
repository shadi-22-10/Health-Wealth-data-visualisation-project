/**
 * BarChart — Regional happiness comparison with individual country bars.
 *
 * Features:
 * - Horizontal grouped bars showing average happiness per region
 * - Min/max whiskers to show spread within each region
 * - Click on region → filters other charts (dispatches 'regionSelect')
 * - Animated enter/exit transitions
 * - Tooltip with region details
 */
import { REGION_COLOURS } from './DataManager.js';

class BarChart {

    #container;
    #svg;
    #g;
    #tooltip;

    #width;
    #height;
    #margin = { top: 24, right: 30, bottom: 50, left: 200 };

    #xScale;
    #yScale;
    #xAxis;
    #yAxis;

    #data = [];
    #selectedRegion = null;
    #onRegionSelect = null;

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
     * Render the bar chart with region aggregates.
     * @param {Array} regionData  Output from DataManager.getRegionAverages()
     */
    render(regionData) {
        this.#data = regionData.filter(d => d.Region);
        this.#updateScales();
        this.#drawAxes();
        this.#drawBars();
    }

    /** Highlight a specific region. */
    highlight(region) {
        this.#selectedRegion = region;
        this.#g.selectAll('.bar-group')
            .transition().duration(300)
            .attr('opacity', d => (!region || d.Region === region) ? 1 : 0.2);
    }

    clearHighlight() {
        this.#selectedRegion = null;
        this.#g.selectAll('.bar-group')
            .transition().duration(300)
            .attr('opacity', 1);
    }

    onRegionSelect(callback) {
        this.#onRegionSelect = callback;
    }

    resize() {
        this.#initSvg();
        if (this.#data.length) this.render(this.#data);
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

        this.#svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', this.#margin.left + this.#width / 2)
            .attr('y', this.#height + this.#margin.top + 44)
            .text('Average Happiness Score');
    }

    #updateScales() {
        this.#yScale = d3.scaleBand()
            .domain(this.#data.map(d => d.Region))
            .range([0, this.#height])
            .padding(0.25);

        this.#xScale = d3.scaleLinear()
            .domain([0, d3.max(this.#data, d => d.max) * 1.05 || 8])
            .range([0, this.#width]);

        this.#xAxis = d3.axisBottom(this.#xScale).ticks(6);
        this.#yAxis = d3.axisLeft(this.#yScale);
    }

    #drawAxes() {
        this.#g.select('.x-axis')
            .transition().duration(600)
            .call(this.#xAxis);

        this.#g.select('.y-axis')
            .transition().duration(600)
            .call(this.#yAxis)
            .selectAll('text')
            .style('font-size', '11px');
    }

    #drawBars() {
        const self = this;

        // Bind bar groups
        const groups = this.#g.selectAll('.bar-group')
            .data(this.#data, d => d.Region);

        groups.exit()
            .transition().duration(400).attr('opacity', 0).remove();

        const enter = groups.enter()
            .append('g')
            .attr('class', 'bar-group')
            .attr('transform', d => `translate(0,${this.#yScale(d.Region)})`);

        // Range line (min–max whisker)
        enter.append('line')
            .attr('class', 'range-line')
            .attr('stroke', '#555')
            .attr('stroke-width', 1.5);

        // Main bar (average)
        enter.append('rect')
            .attr('class', 'bar')
            .attr('height', this.#yScale.bandwidth())
            .attr('rx', 3)
            .attr('ry', 3);

        // Value label
        enter.append('text')
            .attr('class', 'bar-label')
            .attr('dy', '0.35em')
            .attr('y', this.#yScale.bandwidth() / 2)
            .style('font-size', '11px')
            .style('fill', '#e4e6eb');

        // Merge enter + update
        const merged = enter.merge(groups);

        merged.transition().duration(600)
            .attr('transform', d => `translate(0,${this.#yScale(d.Region)})`);

        // Update range line
        merged.select('.range-line')
            .transition().duration(600)
            .attr('x1', d => this.#xScale(d.min))
            .attr('x2', d => this.#xScale(d.max))
            .attr('y1', this.#yScale.bandwidth() / 2)
            .attr('y2', this.#yScale.bandwidth() / 2);

        // Update bar
        merged.select('.bar')
            .on('mouseover', function(event, d) { self.#showTooltip(event, d); d3.select(this).attr('opacity', 0.8); })
            .on('mousemove', function(event)     { self.#moveTooltip(event); })
            .on('mouseout',  function()          { self.#hideTooltip(); d3.select(this).attr('opacity', 1); })
            .on('click',     function(event, d)  { if (self.#onRegionSelect) self.#onRegionSelect(d.Region); })
            .transition().duration(600)
            .attr('width', d => this.#xScale(d.happiness))
            .attr('height', this.#yScale.bandwidth())
            .attr('fill', d => REGION_COLOURS[d.Region] || '#607d8b');

        // Update label
        merged.select('.bar-label')
            .transition().duration(600)
            .attr('x', d => this.#xScale(d.happiness) + 6)
            .attr('y', this.#yScale.bandwidth() / 2)
            .text(d => d.happiness.toFixed(2) + ` (${d.count})`);
    }

    #showTooltip(event, d) {
        this.#tooltip
            .style('opacity', 1)
            .html(`
                <div class="tt-title">${d.Region}</div>
                <div class="tt-row"><span class="tt-label">Avg Score</span><span>${d.happiness.toFixed(3)}</span></div>
                <div class="tt-row"><span class="tt-label">Range</span><span>${d.min.toFixed(2)} – ${d.max.toFixed(2)}</span></div>
                <div class="tt-row"><span class="tt-label">Countries</span><span>${d.count}</span></div>
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

export default BarChart;
