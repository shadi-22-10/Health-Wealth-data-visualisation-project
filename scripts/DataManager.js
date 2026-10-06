/**
 * DataManager — centralised data loading, parsing, and filtering.
 *
 * Loads all four CSV files once via d3.csv, parses numeric types, and
 * exposes helper methods used by every chart.
 *
 * Usage:
 *   const dm = new DataManager();
 *   await dm.load();
 *   const rows = dm.getByYear(2015);
 */

/** Colour map for regions (consistent across all charts) */
const REGION_COLOURS = {
    'Western Europe':                         '#4fc3f7',
    'North America':                          '#81c784',
    'Australia and New Zealand':              '#aed581',
    'Eastern Asia':                           '#fff176',
    'Latin America and Caribbean':            '#ffb74d',
    'Middle East and Northern Africa':        '#ff8a65',
    'Southeastern Asia':                      '#ce93d8',
    'Central and Eastern Europe':             '#90caf9',
    'Eastern Europe':                         '#80cbc4',
    'Southern Asia':                          '#f48fb1',
    'Sub-Saharan Africa':                     '#ef5350'
};

class DataManager {

    /** Paths to data files (relative to index.html) */
    #paths = {
        main:      'data/merged_wb_happiness_2015_2019.csv',
        full2015:  'data/merged_all_2015.csv',
        trends:    'data/wb_trends_1990_2023.csv',
        happiness: 'data/happiness_2015_2019.csv'
    };

    /** Parsed datasets */
    main      = [];
    full2015  = [];
    trends    = [];
    happiness = [];

    /** Derived look-ups */
    regions   = [];
    countries = [];
    years     = [];

    /* -------------------------------------------------- */
    /*  Loading & Parsing                                  */
    /* -------------------------------------------------- */

    /**
     * Load all CSV files concurrently.
     * @returns {Promise<void>}
     */
    async load() {
        const [main, full2015, trends, happiness] = await Promise.all([
            d3.csv(this.#paths.main,      this.#parseMain),
            d3.csv(this.#paths.full2015,  this.#parseFull2015),
            d3.csv(this.#paths.trends,    this.#parseTrends),
            d3.csv(this.#paths.happiness, this.#parseHappiness)
        ]);

        this.main      = main;
        this.full2015  = full2015;
        this.trends    = trends;
        this.happiness = happiness;

        // Derived indices
        this.regions   = [...new Set(this.main.map(d => d.Region))].filter(Boolean).sort();
        this.countries = [...new Set(this.main.map(d => d.Country))].filter(Boolean).sort();
        this.years     = [...new Set(this.main.map(d => d.Year))].sort((a, b) => a - b);

        console.log(`[DataManager] Loaded — main: ${main.length}, full2015: ${full2015.length}, ` +
                     `trends: ${trends.length}, happiness: ${happiness.length}`);
    }

    /* -------- Row parsers (private) -------- */

    /** Parse a numeric value, returning null for blanks */
    #num(v) { return v === '' || v == null ? null : +v; }

    #parseMain = (d) => ({
        Country:                  d.Country,
        Year:                     +d.Year,
        GDP_current_US:           this.#num(d.GDP_current_US),
        life_expectancy:          this.#num(d.life_expectancy_at_birth),
        population:               this.#num(d.population),
        CO2_emissions:            this.#num(d.CO2_emisions),
        electricity_access:       this.#num(d['access_to_electricity%']),
        internet_users:           this.#num(d['individuals_using_internet%']),
        gini_index:               this.#num(d.gini_index),
        human_capital_index:      this.#num(d.human_capital_index),
        happiness:                this.#num(d['Happiness Score']),
        gdp_per_capita_idx:       this.#num(d['GDP per Capita']),
        social_support:           this.#num(d['Social Support']),
        healthy_life_exp:         this.#num(d['Healthy Life Expectancy']),
        freedom:                  this.#num(d.Freedom),
        generosity:               this.#num(d.Generosity),
        corruption:               this.#num(d['Perceptions of Corruption']),
        Region:                   d.Region,
        // Computed GDP per capita from WB data
        gdp_per_capita:           (this.#num(d.GDP_current_US) && this.#num(d.population))
                                    ? this.#num(d.GDP_current_US) / this.#num(d.population)
                                    : null
    });

    #parseFull2015 = (d) => ({
        ...this.#parseMain(d),
        who_life_exp:       this.#num(d['Life expectancy ']),
        adult_mortality:    this.#num(d['Adult Mortality']),
        infant_deaths:      this.#num(d['infant deaths']),
        hepatitis_b:        this.#num(d['Hepatitis B']),
        measles:            this.#num(d['Measles ']),
        polio:              this.#num(d.Polio),
        total_expenditure:  this.#num(d['Total expenditure']),
        diphtheria:         this.#num(d['Diphtheria ']),
        who_gdp:            this.#num(d.GDP),
        schooling:          this.#num(d.Schooling),
        dev_status:         d.Status
    });

    #parseTrends = (d) => ({
        Country:        d.Country,
        Year:           +d.Year,
        GDP_current_US: this.#num(d.GDP_current_US),
        life_expectancy:this.#num(d.life_expectancy_at_birth),
        population:     this.#num(d.population),
        CO2_emissions:  this.#num(d.CO2_emisions)
    });

    #parseHappiness = (d) => ({
        Country:          d.Country,
        Year:             +d.Year,
        happiness:        this.#num(d['Happiness Score']),
        gdp_per_capita_idx: this.#num(d['GDP per Capita']),
        social_support:   this.#num(d['Social Support']),
        healthy_life_exp: this.#num(d['Healthy Life Expectancy']),
        freedom:          this.#num(d.Freedom),
        generosity:       this.#num(d.Generosity),
        corruption:       this.#num(d['Perceptions of Corruption']),
        Region:           d.Region
    });

    /* -------------------------------------------------- */
    /*  Query helpers                                      */
    /* -------------------------------------------------- */

    /** Return main dataset filtered to a single year. */
    getByYear(year) {
        return this.main.filter(d => d.Year === year);
    }

    /** Return trend data for a list of countries. */
    getTrends(countries) {
        const set = new Set(countries);
        return this.trends.filter(d => set.has(d.Country));
    }

    /** Return happiness rows for a list of countries. */
    getHappiness(countries) {
        const set = new Set(countries);
        return this.happiness.filter(d => set.has(d.Country));
    }

    /** Aggregate happiness by region for a given year. */
    getRegionAverages(year) {
        const yearData = this.happiness.filter(d => d.Year === year && d.happiness != null);
        const grouped = d3.group(yearData, d => d.Region);
        return Array.from(grouped, ([region, rows]) => ({
            Region: region,
            happiness: d3.mean(rows, d => d.happiness),
            count: rows.length,
            min: d3.min(rows, d => d.happiness),
            max: d3.max(rows, d => d.happiness)
        })).sort((a, b) => b.happiness - a.happiness);
    }

    /** Get the region colour. Falls back to grey. */
    regionColour(region) {
        return REGION_COLOURS[region] || '#607d8b';
    }

    /** Get full-2015 row for a specific country (radar chart). */
    getCountryProfile(country) {
        return this.full2015.find(d => d.Country === country) || null;
    }

    /** Compute normalised [0-1] radar axes for a country (2015). */
    getRadarData(country) {
        const row = this.getCountryProfile(country);
        if (!row) return null;
        const axes = ['gdp_per_capita_idx','social_support','healthy_life_exp',
                      'freedom','generosity','corruption'];
        const labels = ['GDP per Capita','Social Support','Health','Freedom','Generosity','Low Corruption'];
        // Compute max per axis from full dataset
        const maxVals = axes.map(a => d3.max(this.full2015, d => d[a]) || 1);
        return axes.map((a, i) => ({
            axis: labels[i],
            value: row[a] != null ? row[a] / maxVals[i] : 0
        }));
    }
}

export { DataManager, REGION_COLOURS };
