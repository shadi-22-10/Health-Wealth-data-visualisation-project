import { REGION_COLOURS } from './DataManager.js';

/**
 * Scatter chart objects and initiate sizing, scales, groups and tooltip. 
 * Constructor calls the init function to build the svg
 */
class LifeExpectancyScatterChart {
    constructor(chartId, tooltipId, regionColors = REGION_COLOURS) {
        this.chartId = chartId;
        this.tooltipId = tooltipId;
        this.regionColors = regionColors;

        this.margin = { top: 40, right: 30, bottom: 65, left: 70 };
        this.width = 900;
        this.height = 500;
        this.innerWidth = this.width - this.margin.left - this.margin.right;
        this.innerHeight = this.height - this.margin.top - this.margin.bottom;

        this.data = [];
        this.countryChosen = null;
        this.countryClickHandler = null;

        this.svg = null;
        this.chart = null;
        this.xScale = null;
        this.yScale = null;
        this.xGroup = null;
        this.yGroup = null;
        this.pointsGroup = null;
        this.trendGroup = null;
        this.gridGroup = null;
        this.tooltip = d3.select(this.tooltipId);

        this.init();
    }

    /**
     * SVG template for scatter chart. 
     * Includes layers for grid, axes, points, labeling axes and trend line
     * 
     */
    init() {
        d3.select(this.chartId).selectAll('*').remove();

        this.svg = d3.select(this.chartId)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`);

        this.chart = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.gridGroup = this.chart.append('g').attr('class', 'grid-group');
        this.trendGroup = this.chart.append('g').attr('class', 'trend-group');
        this.pointsGroup = this.chart.append('g').attr('class', 'points-group');
        

        this.xGroup = this.chart.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${this.innerHeight})`);

        this.yGroup = this.chart.append('g')
            .attr('class', 'y-axis');

        this.svg.append('text')
            .attr('class', 'title')
            .attr('x', this.margin.left)
            .attr('y', 24)
            .text('Life Expectancy vs Happiness');

        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', this.margin.left + this.innerWidth / 2)
            .attr('y', this.height - 18)
            .attr('text-anchor', 'middle')
            .text('Life Expectancy (Years)');

        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(this.margin.top + this.innerHeight / 2))
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .text('Happiness Score');
    }
    /**
     * Function executes when country on scatter chart is selected
     */
    setCountryClickHandler(handler) {
        this.countryClickHandler = handler;
    }

    /**
     * Data cleaning in order to use only valid rows 
     */

    render(data) {
        this.data = data
            .filter(d =>
                d.life_expectancy !== null &&
                d.life_expectancy !== undefined &&
                d.happiness !== null &&
                d.happiness !== undefined &&
                !isNaN(+d.life_expectancy) &&
                !isNaN(+d.happiness)
            )
            .map(d => ({
                ...d,
                life_expectancy: +d.life_expectancy,
                happiness: +d.happiness,
                gdp_per_capita: d.gdp_per_capita != null ? +d.gdp_per_capita : null
            }));

        if (this.data.length === 0) return;

        this.updateScales();
        this.drawGrid();
        this.drawAxes();
        this.drawTrendLine();
        this.drawPoints();
    }

    /**
     * Uses the data to create x and y scales 
     * x and y values are mapped out to pixels
     */
    updateScales() {
        const xMin = d3.min(this.data, d => d.life_expectancy);
        const xMax = d3.max(this.data, d => d.life_expectancy);
        const yMin = d3.min(this.data, d => d.happiness);
        const yMax = d3.max(this.data, d => d.happiness);

        this.xScale = d3.scaleLinear()
            .domain([Math.max(0, xMin - 2), xMax + 2])
            .range([0, this.innerWidth]);

        this.yScale = d3.scaleLinear()
            .domain([Math.max(0, yMin - 0.4), yMax + 0.3])
            .nice()
            .range([this.innerHeight, 0]);
    }
    
    /**
     * Draw the axes with transitions that smoothen the updates
     * Current scales are used to draw the axes
     */
    drawAxes() {
        const xAxis = d3.axisBottom(this.xScale).ticks(8);
        const yAxis = d3.axisLeft(this.yScale).ticks(6);

        this.xGroup
            .transition()
            .duration(700)
            .call(xAxis);

        this.yGroup
            .transition()
            .duration(700)
            .call(yAxis);
    }

    /**
     * Draw vertical and horizontal grid lines to read values
     */
    drawGrid() {
        const xTicks = this.xScale.ticks(8);
        const yTicks = this.yScale.ticks(6);

        const linesVertical = this.gridGroup.selectAll('.grid-x').data(xTicks);

        linesVertical.enter()
            .append('line')
            .attr('class', 'grid-x')
            .merge(linesVertical)
            .transition()
            .duration(700)
            .attr('x1', d => this.xScale(d))
            .attr('x2', d => this.xScale(d))
            .attr('y1', 0)
            .attr('y2', this.innerHeight)
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1);

        linesVertical.exit().remove();

        const linesHorizontal = this.gridGroup.selectAll('.grid-y').data(yTicks);

        linesHorizontal.enter()
            .append('line')
            .attr('class', 'grid-y')
            .merge(linesHorizontal)
            .transition()
            .duration(700)
            .attr('x1', 0)
            .attr('x2', this.innerWidth)
            .attr('y1', d => this.yScale(d))
            .attr('y2', d => this.yScale(d))
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1);

        linesHorizontal.exit().remove();
    }

    /**
     * Connects the dataset to SVG circles
     * Uses the x and y scales to position points on the grid
     * Click and tooltip interactions
     */

    drawPoints() {
        const circles = this.pointsGroup.selectAll('circle')
            .data(this.data, d => d.Country);

        circles.enter()
            .append('circle')
            .attr('cx', d => this.xScale(d.life_expectancy))
            .attr('cy', d => this.yScale(d.happiness))
            .attr('r', 0)
            .attr('fill', d => this.regionColors[d.Region] || '#6b7280')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('opacity', 0.88)
            .on('mouseover', (event, d) => {
                this.showTooltip(event, d);
            })
            .on('mousemove', (event) => {
                this.moveTooltip(event);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.countryChosen = d.Country;
                this.applyHighlight();

                if (this.countryClickHandler) {
                    this.countryClickHandler(d.Country, d);
                }
            })
            .merge(circles)
            .transition()
            .duration(800)
            .attr('cx', d => this.xScale(d.life_expectancy))
            .attr('cy', d => this.yScale(d.happiness))
            .attr('r', d => this.countryChosen === d.Country ? 9 : 6.5)
            .attr('fill', d => this.regionColors[d.Region] || '#6b7280')
            .attr('opacity', d => {
                if (!this.countryChosen) return 0.88;
                return d.Country === this.countryChosen ? 0.95 : 0.2;
            });

        circles.exit()
            .transition()
            .duration(300)
            .attr('r', 0)
            .remove();
    }
    
    /**
     * When the user goes over a point tooltip is shown
     * The event tells you where the cursor is on the screen 
     * Will display information about a country if user hovers anc clicks over one
     */
    showTooltip(event, d) {
        this.tooltip
            .style('opacity', 1)
            .html(`
                <div><strong>${d.Country}</strong></div>
                <div>Region: ${d.Region}</div>
                <div>Life Expectancy: ${d.life_expectancy.toFixed(1)}</div>
                <div>Happiness: ${d.happiness.toFixed(2)}</div>
                <div>GDP per Capita: ${
                    d.gdp_per_capita != null
                        ? '$' + d3.format(',')(Math.round(d.gdp_per_capita))
                        : 'N/A'
                }</div>
            `);

        this.moveTooltip(event);
    }

    /**
     * Find the sum X y, XY and X^2  
     * Calculates tge denominator
     * Uses it to calculate the gradient
     */
    calculateRegression(){
        const n = this.data.length;

        const sumX = d3.sum(this.data, d => d.life_expectancy);
        const sumY = d3.sum(this.data, d => d.happiness);
        const sumXY = d3.sum(this.data, d => d.life_expectancy * d.happiness);
        const sumX2 = d3.sum(this.data, d => d.life_expectancy * d.life_expectancy);

        const denominator = (n*sumX2) - (sumX * sumX);

        const gradient = denominator === 0 ? 0 : ((n * sumXY) - (sumX*sumY)) / denominator;

        const intercept = (sumY - gradient * sumX) / n;

        return {gradient, intercept};
    }

    /**
     * Calculates correlation.   
     * Tells us how much life expectancy caries with happiness
     */
    calculateCorrelation(){
        const n = this.data.length;

        const sumX = d3.sum(this.data, d => d.life_expectancy);
        const sumY = d3.sum(this.data, d => d.happiness);
        const sumXY = d3.sum(this.data, d => d.life_expectancy * d.happiness);
        const sumX2 = d3.sum(this.data, d => d.life_expectancy * d.life_expectancy);
        const sumY2 = d3.sum(this.data, d => d.happiness * d.happiness);

        const numerator = (n*sumXY) - (sumX*sumY);
        const denominator = Math.sqrt(((n*sumX2)-(sumX*sumX)) * (n*sumY2)-(sumY*sumY));
        
        const r = denominator === 0 ? 0 : numerator / denominator;
        const r2 = r*r;

        return {r,r2};



    }
    /**
     * Draws trend line for scatter chart by using the euwtaion of the line of best fit
     * Calculates correlation (r and r^2) which tells you how much hsppiness varies with 
     * life expectancy
     * Results show very little correlation between happiness and life expectancy 
     */
    drawTrendLine(){
        const {gradient, intercept} = this.calculateRegression();
        const { r, r2 } = this.calculateCorrelation();

        const x1 = d3.min(this.data, d=>d.life_expectancy);
        const x2 = d3.max(this.data, d => d.life_expectancy);

        const y1 = gradient * x1 + intercept;
        const y2 = gradient *x2 +intercept;

        const lineData = [{x1,x2,y1,y2}];

        const trendLine = this.trendGroup.selectAll('.trend-line').data(lineData);

        trendLine.enter().append('line').attr('class','trend-line').merge(trendLine).transition()
        .duration(800).attr('x1', d => this.xScale(d.x1))
        .attr('y1', d => this.yScale(d.y1))
        .attr('x2', d => this.xScale(d.x2))
        .attr('y2', d => this.yScale(d.y2))
        .attr('stroke', '#111827')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6 5')
        .attr('opacity', 0.9);

        trendLine.exit().remove();

        const statsBox = d3.select('#scatter2-stats');

statsBox.html(`
    <div style="font-size: 24px; font-weight: 700; color: #ffffff; text-align: center; margin-top: 18px;">
        r = ${r.toFixed(2)} &nbsp;&nbsp; R² = ${r2.toFixed(2)}
    </div>
`);
    }

    moveTooltip(event) {
        this.tooltip
            .style('left', `${event.pageX + 14}px`)
            .style('top', `${event.pageY - 28}px`);
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    applyHighlight() {
        this.pointsGroup.selectAll('circle')
            .transition()
            .duration(250)
            .attr('r', d => this.countryChosen === d.Country ? 9 : 6.5)
            .attr('opacity', d => {
                if (!this.countryChosen) return 0.88;
                return d.Country === this.countryChosen ? 0.95 : 0.2;
            })
            .attr('stroke-width', d => this.countryChosen === d.Country ? 2.5 : 1);
    }

    highlight(countryName) {
        this.countryChosen = countryName;
        this.applyHighlight();
    }

    clearHighlight() {
        this.countryChosen = null;
        this.applyHighlight();
    }
}

export default LifeExpectancyScatterChart;