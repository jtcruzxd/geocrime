/**
 * GeoCRIME — Incident Data Module (js/incidents.js)
 *
 * Generates synthetic incident-level records that are:
 *  - Proportional to the real PSA/PNP crime totals per municipality per year
 *  - Spatially scattered around each municipality's real centroid
 *  - Typed with realistic focus-crime distributions from the thesis
 *  - Dated within the correct calendar year with seasonal variation
 *
 * Each incident: { id, municipalityId, barangay, lat, lng, crimeType, date, year, month }
 */

// ── MUNICIPALITY CENTROIDS (real geographic centres) ───────────────
const MUNICIPALITY_CENTROIDS = {
  'lubang':       { lat: 13.855, lng: 119.830, spread: 0.040 },
  'looc':         { lat: 13.820, lng: 120.070, spread: 0.025 },
  'paluan':       { lat: 13.470, lng: 120.460, spread: 0.055 },
  'abra-de-ilog': { lat: 13.450, lng: 120.720, spread: 0.060 },
  'mamburao':     { lat: 13.220, lng: 120.600, spread: 0.055 },
  'calintaan':    { lat: 13.060, lng: 120.590, spread: 0.065 },
  'rizal':        { lat: 13.080, lng: 120.720, spread: 0.060 },
  'magsaysay':    { lat: 13.000, lng: 120.650, spread: 0.055 },
  'sablayan':     { lat: 12.840, lng: 120.760, spread: 0.090 },
  'san-jose':     { lat: 12.353, lng: 121.070, spread: 0.080 },
  'santa-cruz':   { lat: 12.530, lng: 120.980, spread: 0.060 },
};

// ── BARANGAY NAMES PER MUNICIPALITY (representative sample) ────────
const BARANGAY_NAMES = {
  'lubang':       ['Poblacion I','Poblacion II','Tilik','Cabra','Ambil','Tagbac'],
  'looc':         ['Poblacion','Agkawayan','Ambil Island','Golo'],
  'paluan':       ['Poblacion','Alipaoy','Concepcion','Handang','Lumangbayan'],
  'abra-de-ilog': ['Poblacion','Batong Buhay','Lumangbayan','Malpalon','Udalo','Wawa'],
  'mamburao':     ['Poblacion I','Poblacion II','Balansay','Fatima','Talabaan','Tayamaan','San Roque','Paclasan'],
  'calintaan':    ['Poblacion','Concepcion','Iriron','Malpalon','San Agustin','Talaotao'],
  'rizal':        ['Poblacion','Calintaan','Don Juan','Kaypaaba','Lumangbayan','Malpalon','Talabaan'],
  'magsaysay':    ['Poblacion','Bayotbot','Bulangao','Caguray','Gapasan','Laste','Malitbog'],
  'sablayan':     ['Poblacion','Batong Buhay','Buenavista','Burgos','Claudio Salgado','Ligaya','Pag-asa','San Nicolas','Talaotao','Tuban'],
  'san-jose':     ['Poblacion I','Poblacion II','Poblacion III','Bagong Sikat','Bucayao','Caminawit','Liwanag','Mangarin','Murtha','Natandol','Pag-asa','San Roque','Santa Rita','Tayamaan'],
  'santa-cruz':   ['Poblacion','Buhay na Tubig','Burgos','Cataning','Concepcion','Laste','Paetan'],
};

// ── FOCUS CRIME WEIGHTS PER MUNICIPALITY ───────────────────────────
// Based on thesis Table 2 focus crimes breakdown; weights sum to 1.
const CRIME_WEIGHTS = {
  'lubang':       { theft:0.22, rape:0.22, physicalInjury:0.11, robbery:0.11, murder:0.11, homicide:0.11, carnapping:0.11 },
  'looc':         { theft:0.40, rape:0.20, physicalInjury:0.15, robbery:0.10, murder:0.05, homicide:0.05, carnapping:0.05 },
  'paluan':       { theft:0.30, rape:0.25, physicalInjury:0.18, robbery:0.10, murder:0.07, homicide:0.05, carnapping:0.05 },
  'abra-de-ilog': { theft:0.29, rape:0.22, physicalInjury:0.15, robbery:0.07, murder:0.07, homicide:0.07, carnapping:0.14 },
  'mamburao':     { theft:0.30, rape:0.20, physicalInjury:0.15, robbery:0.10, murder:0.05, homicide:0.05, carnapping:0.10, nonIndex:0.05 },
  'calintaan':    { theft:0.28, rape:0.18, physicalInjury:0.18, robbery:0.09, murder:0.09, homicide:0.09, carnapping:0.09 },
  'rizal':        { theft:0.28, rape:0.22, physicalInjury:0.17, robbery:0.06, murder:0.06, homicide:0.06, carnapping:0.06, nonIndex:0.09 },
  'magsaysay':    { theft:0.29, rape:0.22, physicalInjury:0.15, robbery:0.07, murder:0.07, homicide:0.07, carnapping:0.07, nonIndex:0.06 },
  'sablayan':     { theft:0.26, rape:0.19, physicalInjury:0.15, robbery:0.07, murder:0.04, homicide:0.04, carnapping:0.07, nonIndex:0.18 },
  'san-jose':     { theft:0.26, rape:0.23, physicalInjury:0.11, robbery:0.08, murder:0.08, homicide:0.06, carnapping:0.11, nonIndex:0.07 },
  'santa-cruz':   { theft:0.29, rape:0.22, physicalInjury:0.15, robbery:0.07, murder:0.07, homicide:0.07, carnapping:0.07, nonIndex:0.06 },
};

// ── CRIME TYPE DISPLAY META ─────────────────────────────────────────
const CRIME_TYPE_META = {
  theft:          { label: 'Theft',           color: '#f39c12', icon: '💰' },
  rape:           { label: 'Rape',            color: '#e74c3c', icon: '⚠' },
  physicalInjury: { label: 'Physical Injury', color: '#e67e22', icon: '🤕' },
  robbery:        { label: 'Robbery',         color: '#c0392b', icon: '🔫' },
  murder:         { label: 'Murder',          color: '#8e1c1c', icon: '💀' },
  homicide:       { label: 'Homicide',        color: '#922b21', icon: '⚔' },
  carnapping:     { label: 'Carnapping',      color: '#1a5276', icon: '🚗' },
  nonIndex:       { label: 'Non-Index Crime', color: '#5d6d7e', icon: '📋' },
};

// ── SEEDED PRNG (reproducible data on every load) ──────────────────
function _seededRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── HELPERS ────────────────────────────────────────────────────────
function _weightedChoice(weights, rng) {
  const keys = Object.keys(weights);
  let r = rng();
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

function _gaussianJitter(centre, spread, rng) {
  // Box–Muller to get a roughly Gaussian scatter
  const u1 = rng(), u2 = rng();
  const z  = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return centre + z * spread * 0.5;
}

function _randomDate(year, rng) {
  // Slight seasonal bias: more crime in Q2/Q3 (months 4–9)
  const monthWeights = [0.07,0.07,0.08,0.09,0.10,0.10,0.10,0.09,0.09,0.08,0.07,0.06];
  let r = rng();
  let month = 0;
  for (let i = 0; i < 12; i++) {
    r -= monthWeights[i];
    if (r <= 0) { month = i; break; }
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.floor(rng() * daysInMonth) + 1;
  const mm  = String(month + 1).padStart(2, '0');
  const dd  = String(day).padStart(2, '0');
  return { date: `${year}-${mm}-${dd}`, month: month + 1, year };
}

// ── MAIN GENERATOR ─────────────────────────────────────────────────
function _generateIncidents() {
  const incidents = [];
  let id = 1;

  CRIME_DATA.municipalities.forEach((muni, muniIdx) => {
    const centroid = MUNICIPALITY_CENTROIDS[muni.id];
    if (!centroid) return;
    const barangays = BARANGAY_NAMES[muni.id] || ['Poblacion'];
    const weights   = CRIME_WEIGHTS[muni.id]  || {};

    [2021, 2022, 2023].forEach((year, yearIdx) => {
      const total = muni.crimes[year] || 0;
      // Use a unique seed per municipality+year for reproducibility
      const rng   = _seededRng((muniIdx + 1) * 1000 + yearIdx * 100 + 7919);

      for (let i = 0; i < total; i++) {
        const crimeType = _weightedChoice(weights, rng);
        const barangay  = barangays[Math.floor(rng() * barangays.length)];

        // Scatter incidents around the centroid with Gaussian jitter
        // Higher-crime types cluster more tightly near the poblacion
        const clusterFactor = (crimeType === 'theft' || crimeType === 'robbery') ? 0.6 : 1.0;
        const lat = _gaussianJitter(centroid.lat, centroid.spread * clusterFactor, rng);
        const lng = _gaussianJitter(centroid.lng, centroid.spread * clusterFactor, rng);

        const { date, month } = _randomDate(year, rng);

        incidents.push({
          id:             id++,
          municipalityId: muni.id,
          municipality:   muni.name,
          barangay,
          lat:            parseFloat(lat.toFixed(6)),
          lng:            parseFloat(lng.toFixed(6)),
          crimeType,
          date,
          year,
          month,
        });
      }
    });
  });

  return incidents;
}

// ── EXPORTS ────────────────────────────────────────────────────────

/** All 2,774 synthetic incidents (matches PSA totals exactly). */
const ALL_INCIDENTS = _generateIncidents();

/**
 * Returns incidents filtered by year and/or crimeType.
 * @param {number|'all'} year
 * @param {string}       crimeType  'total'|'index'|'nonIndex'|specific type key
 */
function getIncidents(year, crimeType) {
  const INDEX_TYPES    = ['murder','homicide','physicalInjury','rape','robbery','theft','carnapping'];
  const NONINDEX_TYPES = ['nonIndex'];

  return ALL_INCIDENTS.filter(inc => {
    const yearOk = (year === 'all' || inc.year === parseInt(year, 10));
    let typeOk = true;
    if (crimeType === 'index')    typeOk = INDEX_TYPES.includes(inc.crimeType);
    if (crimeType === 'nonIndex') typeOk = NONINDEX_TYPES.includes(inc.crimeType);
    if (crimeType !== 'total' && crimeType !== 'index' && crimeType !== 'nonIndex') {
      typeOk = inc.crimeType === crimeType;
    }
    return yearOk && typeOk;
  });
}

/**
 * Returns incidents for a specific municipality.
 * @param {string}       municipalityId
 * @param {number|'all'} year
 * @param {string}       crimeType
 */
function getMunicipalityIncidents(municipalityId, year, crimeType) {
  return getIncidents(year, crimeType).filter(inc => inc.municipalityId === municipalityId);
}

/**
 * Returns Leaflet.heat compatible array: [[lat, lng, intensity], ...]
 * Intensity is normalised 0–1 based on max incidents per municipality.
 */
function getHeatPoints(year, crimeType) {
  const filtered = getIncidents(year, crimeType);
  // Each incident contributes one heat point; weight by crime severity
  const SEVERITY = {
    murder: 1.0, homicide: 0.95, rape: 0.9, robbery: 0.8,
    physicalInjury: 0.7, carnapping: 0.6, theft: 0.5, nonIndex: 0.3,
  };
  return filtered.map(inc => [
    inc.lat,
    inc.lng,
    SEVERITY[inc.crimeType] || 0.4,
  ]);
}
