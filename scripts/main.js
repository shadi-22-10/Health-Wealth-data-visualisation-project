/**
 * main.js — Application orchestration
 *
 * Responsibilities:
 * 1. Instantiate DataManager + all 5 chart classes
 * 2. Load data, then perform initial render
 * 3. Wire UI controls (year slider, metric dropdowns, country selectors)
 * 4. Implement bidirectional interactions between charts
 * 5. Scroll-based navigation highlighting
 * 6. Window resize handling
 */

import { DataManager, REGION_COLOURS } from './DataManager.js';
import ScatterChart   from './ScatterChart.js';
import BarChart       from './BarChart.js';
import LineChart      from './LineChart.js';
import ChoroplethMap  from './ChoroplethMap.js';
import RadarChart     from './RadarChart.js';
import LifeExpectancyScatterChart from './ScatterChart2.js';

/* ============================================================
   State
   ============================================================ */
const state = {
    year: 2015,
    mapMetric: 'happiness',
    trendMetric: 'GDP_current_US',
    selectedCountries: ['Finland', 'United States', 'India', 'Brazil', 'Nigeria'],
    radarCountries: ['Finland', '', '']
};

/* ============================================================
   Instances
   ============================================================ */
const dm      = new DataManager();
const scatter  = new ScatterChart('#scatter-chart', '#scatter-tooltip');
const bar      = new BarChart('#bar-chart', '#bar-tooltip');
const line     = new LineChart('#line-chart', '#line-tooltip');
const choropleth = new ChoroplethMap('#map-chart', '#map-tooltip');
const radar    = new RadarChart('#radar-chart');
const scatter2 = new LifeExpectancyScatterChart('#scatter2-chart', '#scatter2-tooltip');

/* ============================================================
   Bootstrap
   ============================================================ */
(async function init() {
    try {
        // Load data + geo simultaneously
        await dm.load();
        console.log('[main] Data & geo loaded');

        populateControls();
        renderAll();
        wireControls();
        wireInteractions();
        wireNavScroll();
        wireResize();

        console.log('[main] Application ready');
    } catch (err) {
        console.error('[main] Init failed:', err);
        document.body.innerHTML += `<div style="color:red;padding:2rem;text-align:center">
            <h2>Failed to load data</h2><pre>${err.message}</pre></div>`;
    }
})();

/* ============================================================
   Rendering
   ============================================================ */

function renderAll() {
    renderScatter();
    renderMap();
    renderBar();
    renderTrends();
    renderRadar();
    renderScatter2();
}

function renderScatter() {
    const data = dm.getByYear(state.year);
    scatter.render(data);
    buildScatterLegend();
}

function renderMap() {
    const data = dm.getByYear(state.year);
    choropleth.render(data, state.mapMetric);
}

function renderBar() {
    const regionData = dm.getRegionAverages(state.year);
    bar.render(regionData);
}

function renderTrends() {
    const data = dm.getTrends(state.selectedCountries);
    const colourMap = buildColourMap(state.selectedCountries);
    line.render(data, state.trendMetric, colourMap);
    buildCountryChips();
}

function renderRadar() {
    const datasets = state.radarCountries
        .filter(c => c)
        .map(country => {
            const values = dm.getRadarData(country);
            return values ? { country, values } : null;
        })
        .filter(Boolean);
    radar.render(datasets);
}

function renderScatter2() {
    const data = dm.getByYear(state.year);
    scatter2.render(data);
}



/* ============================================================
   UI Control population
   ============================================================ */

function populateControls() {
    // Radar country selectors
    ['radar-country-1', 'radar-country-2', 'radar-country-3'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">— Select —</option>` +
            dm.countries.map(c => `<option value="${c}" ${c === state.radarCountries[idx] ? 'selected' : ''}>${c}</option>`).join('');
    });
}

/* ============================================================
   Control wiring
   ============================================================ */

function wireControls() {
    // Year slider
    const slider  = document.getElementById('year-slider');
    const display = document.getElementById('year-display');
    if (slider) {
        slider.addEventListener('input', () => {
            state.year = +slider.value;
            display.textContent = state.year;
            renderScatter();
            renderMap();
            renderBar();
            renderScatter2();
        });
    }

    // Map metric dropdown
    const mapSel = document.getElementById('map-metric');
    if (mapSel) {
        mapSel.addEventListener('change', () => {
            state.mapMetric = mapSel.value;
            renderMap();
        });
    }

    // Trends metric dropdown
    const trendSel = document.getElementById('trends-metric');
    if (trendSel) {
        trendSel.addEventListener('change', () => {
            state.trendMetric = trendSel.value;
            renderTrends();
        });
    }

    // Radar country selectors
    ['radar-country-1', 'radar-country-2', 'radar-country-3'].forEach((id, idx) => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.addEventListener('change', () => {
                state.radarCountries[idx] = sel.value;
                renderRadar();
            });
        }
    });
}

/* ============================================================
   Bidirectional interactions
   ============================================================ */

function wireInteractions() {

    // 1. Scatter ↔ Map: clicking a country highlights it on both
    scatter.onCountrySelect(country => {
        choropleth.highlight(country);
        updateRadarFromCountry(country);
    });

    choropleth.onCountrySelect(country => {
        scatter.highlight(country);
        updateRadarFromCountry(country);
    });

    // 2. Bar → Scatter: clicking a region filters scatter to that region
    bar.onRegionSelect(region => {
        const yearData = dm.getByYear(state.year);
        const filtered = yearData.filter(d => d.Region === region);
        scatter.render(filtered);
        choropleth.clearHighlight();
    });

    // 3. Line chart → add country to selected list + highlight
    line.onCountrySelect(country => {
        scatter.highlight(country);
        choropleth.highlight(country);
        updateRadarFromCountry(country);
    });

    // 4. Double-click scatter to reset filter
    document.getElementById('scatter-chart')?.addEventListener('dblclick', () => {
        renderScatter();
        scatter.clearHighlight();
        choropleth.clearHighlight();
    });

    scatter2.setCountryClickHandler((country) => {
    choropleth.highlight(country);
    updateRadarFromCountry(country);
});
}

/** Push a country into the first empty radar slot and re-render. */
function updateRadarFromCountry(country) {
    const emptyIdx = state.radarCountries.indexOf('');
    if (emptyIdx !== -1) {
        state.radarCountries[emptyIdx] = country;
    } else {
        // Rotate: drop oldest, add newest
        state.radarCountries.shift();
        state.radarCountries.push(country);
    }
    // Sync selectors
    ['radar-country-1', 'radar-country-2', 'radar-country-3'].forEach((id, i) => {
        const sel = document.getElementById(id);
        if (sel) sel.value = state.radarCountries[i] || '';
    });
    renderRadar();
}

/* ============================================================
   Scatter legend (region swatches)
   ============================================================ */

function buildScatterLegend() {
    const el = document.getElementById('scatter-legend');
    if (!el) return;
    el.innerHTML = Object.entries(REGION_COLOURS).map(([region, colour]) =>
        `<span class="legend-item" data-region="${region}">
            <span class="legend-swatch" style="background:${colour}"></span>${region}
         </span>`
    ).join('');

    // Click legend item to filter scatter
    el.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', () => {
            const region = item.dataset.region;
            const yearData = dm.getByYear(state.year);
            const filtered = yearData.filter(d => d.Region === region);
            scatter.render(filtered);
            bar.highlight(region);
        });
    });
}

/* ============================================================
   Trend country chips
   ============================================================ */

function buildCountryChips() {
    const container = document.getElementById('trends-country-chips');
    if (!container) return;

    container.innerHTML = '';

    state.selectedCountries.forEach(country => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = country;
        chip.style.borderColor = buildColourMap(state.selectedCountries)[country] || '#aaa';

        const removeBtn = document.createElement('span');
        removeBtn.className = 'chip-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            state.selectedCountries = state.selectedCountries.filter(c => c !== country);
            renderTrends();
        });
        chip.appendChild(removeBtn);
        container.appendChild(chip);
    });

    // Add-country mini-input
    const addBtn = document.createElement('button');
    addBtn.className = 'chip chip-add';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
        const name = prompt('Enter country name:');
        if (name && dm.countries.includes(name) && !state.selectedCountries.includes(name)) {
            state.selectedCountries.push(name);
            renderTrends();
        } else if (name) {
            alert(`Country "${name}" not found. Check spelling.`);
        }
    });
    container.appendChild(addBtn);
}

/** Build a deterministic colour map for a list of countries. */
function buildColourMap(countries) {
    const palette = d3.schemeTableau10;
    const map = {};
    countries.forEach((c, i) => { map[c] = palette[i % palette.length]; });
    return map;
}

/* ============================================================
   Scroll-based navigation highlighting
   ============================================================ */

function wireNavScroll() {
    const sections = document.querySelectorAll('.story-section');
    const links    = document.querySelectorAll('.nav-link');
    const navH     = document.getElementById('story-nav')?.offsetHeight || 0;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                links.forEach(l => l.classList.toggle('active', l.dataset.section === id));
            }
        });
    }, {
        rootMargin: `-${navH + 10}px 0px -50% 0px`,
        threshold: 0.1
    });

    sections.forEach(s => observer.observe(s));
}

/* ============================================================
   Resize handling
   ============================================================ */

function wireResize() {
    let timer;
    window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            scatter.resize();
            renderScatter2();
            bar.resize();
            line.resize();
            choropleth.resize();
            radar.resize();
        }, 200);
    });
}
