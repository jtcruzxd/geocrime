/**
 * GeoCRIME — Incident Store (js/incidents.js)
 *
 * This file no longer generates synthetic data.
 * ALL_INCIDENTS starts empty and is populated exclusively by
 * UploadModule.importPending() when the user uploads a CSV or JSON file.
 *
 * All helper functions remain API-compatible with the rest of the codebase.
 */

// ── LIVE INCIDENT STORE ──────────────────────────────────────────
// Mutable array — UploadModule pushes records here on import.
const ALL_INCIDENTS = [];

// ── MUNICIPALITY CENTROIDS ───────────────────────────────────────
// Used by map.js to place anchor markers and pan the map.
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

// ── BARANGAY NAMES ───────────────────────────────────────────────
// Seed list per municipality; upload can add new barangay names.
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

// ── CRIME TYPE META ──────────────────────────────────────────────
// Populated dynamically from uploaded data; seed with common PNP types.
// Keys are the normalised/shortened crime label from upload.js.
const CRIME_TYPE_META = {};

/**
 * Register or update a crime type entry.
 * Called by upload.js for every unique crime type found in an upload.
 */
function registerCrimeType(key, label, colour) {
  if (!CRIME_TYPE_META[key]) {
    CRIME_TYPE_META[key] = {
      label,
      color:  colour || _assignColour(Object.keys(CRIME_TYPE_META).length),
      icon:   _assignIcon(key),
    };
  }
}

// Auto-assign colours from a palette so each crime type gets a distinct colour
const _COLOUR_PALETTE = [
  '#e74c3c','#f39c12','#e67e22','#2980b9','#8e44ad',
  '#27ae60','#c0392b','#16a085','#d35400','#2c3e50',
  '#1abc9c','#e91e8c','#f1c40f','#3498db','#95a5a6',
];
function _assignColour(idx) {
  return _COLOUR_PALETTE[idx % _COLOUR_PALETTE.length];
}

function _assignIcon(key) {
  const lower = key.toLowerCase();
  if (lower.includes('theft') || lower.includes('robbery'))  return '💰';
  if (lower.includes('rape')  || lower.includes('sexual'))   return '⚠';
  if (lower.includes('murder') || lower.includes('homicide'))return '💀';
  if (lower.includes('physical') || lower.includes('injury'))return '🤕';
  if (lower.includes('carn') || lower.includes('vehicle'))   return '🚗';
  if (lower.includes('drug') || lower.includes('dangerous')) return '💊';
  if (lower.includes('ra ') || lower.includes('rpc'))        return '📋';
  return '📌';
}

// ── HELPER FUNCTIONS ─────────────────────────────────────────────

/**
 * Returns all incidents matching the given year and crimeType filter.
 * @param {number|'all'} year
 * @param {string} crimeType  'total' | specific key
 */
function getIncidents(year, crimeType) {
  return ALL_INCIDENTS.filter(inc => {
    const yearOk = (year === 'all' || inc.year === parseInt(year, 10));
    const typeOk = (!crimeType || crimeType === 'total') ? true
      : inc.crimeType === crimeType;
    return yearOk && typeOk;
  });
}

/**
 * Returns incidents for a specific municipality.
 */
function getMunicipalityIncidents(municipalityId, year, crimeType) {
  return getIncidents(year, crimeType)
    .filter(inc => inc.municipalityId === municipalityId);
}

/**
 * Returns Leaflet.heat compatible array: [[lat, lng, intensity], ...]
 */
function getHeatPoints(year, crimeType) {
  return getIncidents(year, crimeType).map(inc => [inc.lat, inc.lng, 0.7]);
}

/**
 * Returns sorted list of unique crime type keys present in ALL_INCIDENTS.
 */
function getActiveCrimeTypes() {
  const counts = {};
  ALL_INCIDENTS.forEach(i => {
    counts[i.crimeType] = (counts[i.crimeType] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, ...CRIME_TYPE_META[key] }));
}

/**
 * Returns unique years present in ALL_INCIDENTS.
 */
function getActiveYears() {
  return [...new Set(ALL_INCIDENTS.map(i => i.year))].sort();
}

/**
 * Returns unique barangay names for a municipality from uploaded data.
 */
function getUploadedBarangays(municipalityId) {
  return [...new Set(
    ALL_INCIDENTS
      .filter(i => i.municipalityId === municipalityId)
      .map(i => i.barangay)
  )].sort();
}
