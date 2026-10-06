/**
 * ChoroplethMap — World map coloured by a selectable metric.
 *
 * Features:
 * - TopoJSON world geometry (110m) loaded from CDN
 * - Sequential colour scale for chosen metric
 * - Hover tooltip with country details
 * - Click → select country (bidirectional with scatter/radar)
 * - Animated colour transitions on metric/year change
 * - Zoom & pan via d3.zoom
 */

class ChoroplethMap {

    #container;
    #svg;
    #g;
    #tooltip;
    #projection;
    #path;
    #colourScale;
    #zoom;

    #width;
    #height;

    #data = [];
    #dataMap = new Map();
    #metric = 'happiness';
    #worldGeo = null;
    #onCountrySelect = null;

    /** Nice labels and colour schemes per metric */
    static METRIC_CONFIG = {
        'happiness':        { label: 'Happiness Score',  scheme: d3.interpolateYlGnBu,   domain: [2.5, 8] },
        'gdp_per_capita':   { label: 'GDP per Capita',   scheme: d3.interpolateViridis,   domain: [200, 80000] },
        'life_expectancy':  { label: 'Life Expectancy',  scheme: d3.interpolateRdYlGn,    domain: [45, 85] },
        'internet_users':   { label: 'Internet Users %', scheme: d3.interpolatePurples,    domain: [0, 100] }
    };

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
     * Load TopoJSON once (call before first render).
     */
    async loadGeo() {
        const worldUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
        const world = await d3.json(worldUrl);
        this.#worldGeo = topojson.feature(world, world.objects.countries);
        console.log('[ChoroplethMap] Geometry loaded —', this.#worldGeo.features.length, 'countries');
    }

    /**
     * Render / update the map.
     * @param {Array}  data   Rows from DataManager.getByYear()
     * @param {string} metric Property name to colour by
     */
    render(data, metric) {
        this.#data = data;
        this.#metric = metric || this.#metric;
        this.#buildDataMap();
        this.#updateColourScale();
        this.#drawCountries();
        this.#drawLegendBar();
    }

    /** Change metric without reloading data. */
    setMetric(metric) {
        this.#metric = metric;
        this.#updateColourScale();
        this.#drawCountries();
        this.#drawLegendBar();
    }

    /** Highlight a single country on the map. */
    highlight(country) {
        this.#g.selectAll('.country')
            .transition().duration(300)
            .attr('stroke-width', d => {
                const name = this.#matchCountry(d);
                return name === country ? 2 : 0.3;
            })
            .attr('stroke', d => {
                const name = this.#matchCountry(d);
                return name === country ? '#fff' : '#1a1f2e';
            });
    }

    clearHighlight() {
        this.#g.selectAll('.country')
            .transition().duration(300)
            .attr('stroke-width', 0.3)
            .attr('stroke', '#1a1f2e');
    }

    onCountrySelect(callback) {
        this.#onCountrySelect = callback;
    }

    resize() {
        this.#initSvg();
        if (this.#worldGeo) this.render(this.#data, this.#metric);
    }

    /* ---------- Private ---------- */

    #initSvg() {
        const rect = this.#container.getBoundingClientRect();
        this.#width  = rect.width;
        this.#height = Math.max(450, rect.height - 32);

        d3.select(this.#container).select('svg').remove();

        this.#svg = d3.select(this.#container)
            .append('svg')
            .attr('width', this.#width)
            .attr('height', this.#height);

        this.#g = this.#svg.append('g');

        // Projection
        this.#projection = d3.geoNaturalEarth1()
            .fitSize([this.#width, this.#height], { type: 'Sphere' });

        this.#path = d3.geoPath().projection(this.#projection);

        // Zoom
        this.#zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => this.#g.attr('transform', event.transform));

        this.#svg.call(this.#zoom);

        // Ocean background
        this.#g.append('path')
            .datum({ type: 'Sphere' })
            .attr('d', this.#path)
            .attr('fill', '#0d1520');
    }

    /** Build a map from country name → data row for quick look-up */
    #buildDataMap() {
        this.#dataMap.clear();
        for (const row of this.#data) {
            this.#dataMap.set(row.Country, row);
        }
    }

    /** Look up country name from TopoJSON feature (id is ISO numeric code) */
    #countryName(feature) {
        // TopoJSON uses ISO numeric ids; we need a name-based match.
        // We use the "properties.name" when available.
        return feature.properties?.name || '';
    }

    #updateColourScale() {
        const cfg = ChoroplethMap.METRIC_CONFIG[this.#metric] || ChoroplethMap.METRIC_CONFIG['happiness'];
        this.#colourScale = d3.scaleSequential(cfg.scheme).domain(cfg.domain);
    }

    #drawCountries() {
        if (!this.#worldGeo) return;
        const self = this;

        const countries = this.#g.selectAll('.country')
            .data(this.#worldGeo.features, d => d.id);

        const enter = countries.enter()
            .append('path')
            .attr('class', 'country')
            .attr('d', this.#path)
            .attr('stroke', '#1a1f2e')
            .attr('stroke-width', 0.3);

        enter.merge(countries)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
                self.#showTooltip(event, d);
            })
            .on('mousemove', function(event) { self.#moveTooltip(event); })
            .on('mouseout', function() {
                d3.select(this).attr('stroke', '#1a1f2e').attr('stroke-width', 0.3);
                self.#hideTooltip();
            })
            .on('click', function(event, d) {
                const name = self.#matchCountry(d);
                if (name && self.#onCountrySelect) self.#onCountrySelect(name);
            })
            .transition().duration(600)
            .attr('fill', d => {
                const name = this.#matchCountry(d);
                if (!name) return '#2d3548';
                const row = this.#dataMap.get(name);
                if (!row || row[this.#metric] == null) return '#2d3548';
                return this.#colourScale(row[this.#metric]);
            });
    }

    /** Try to match TopoJSON feature to our data by name */
    #matchCountry(feature) {
        const topoName = feature.properties?.name || '';
        // Direct match
        if (this.#dataMap.has(topoName)) return topoName;
        // Fuzzy fallback: check if a data country name contains the topo name
        for (const country of this.#dataMap.keys()) {
            if (country === topoName || topoName.includes(country) || country.includes(topoName)) {
                return country;
            }
        }
        return null;
    }

    #drawLegendBar() {
        const legendEl = document.getElementById('map-legend-bar');
        if (!legendEl) return;
        const cfg = ChoroplethMap.METRIC_CONFIG[this.#metric] || ChoroplethMap.METRIC_CONFIG['happiness'];

        // Create a canvas gradient
        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 12;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 300, 0);
        for (let i = 0; i <= 1; i += 0.1) {
            grad.addColorStop(i, this.#colourScale(cfg.domain[0] + i * (cfg.domain[1] - cfg.domain[0])));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 300, 12);

        legendEl.innerHTML = `
            <span class="legend-label">${d3.format('.2s')(cfg.domain[0])}</span>
            <img class="legend-bar" src="${canvas.toDataURL()}" alt="colour scale" style="width:300px;height:12px;border-radius:3px;">
            <span class="legend-label">${d3.format('.2s')(cfg.domain[1])}</span>
            <span class="legend-label" style="margin-left:8px;">${cfg.label}</span>
        `;
    }

    #showTooltip(event, d) {
        const name = this.#matchCountry(d);
        const row = name ? this.#dataMap.get(name) : null;
        const fmt = d3.format(',.0f');
        this.#tooltip
            .style('opacity', 1)
            .html(`
                <div class="tt-title">${name || d.properties?.name || 'Unknown'}</div>
                ${row ? `
                <div class="tt-row"><span class="tt-label">Happiness</span><span>${row.happiness != null ? row.happiness.toFixed(2) : '—'}</span></div>
                <div class="tt-row"><span class="tt-label">GDP/cap</span><span>${row.gdp_per_capita != null ? '$' + fmt(row.gdp_per_capita) : '—'}</span></div>
                <div class="tt-row"><span class="tt-label">Life Exp.</span><span>${row.life_expectancy != null ? row.life_expectancy.toFixed(1) : '—'}</span></div>
                <div class="tt-row"><span class="tt-label">Internet</span><span>${row.internet_users != null ? row.internet_users.toFixed(1) + '%' : '—'}</span></div>
                ` : '<div style="color:#8b93a7">No data</div>'}
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

export default ChoroplethMap;
