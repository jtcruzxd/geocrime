/**
 * GeoCRIME — Data Module (js/data.js)
 *
 * Contains only static geodemographic reference data:
 * municipality names, populations, and police personnel counts.
 *
 * All crime statistics are derived at runtime from ALL_INCIDENTS
 * (populated by UploadModule). No hardcoded crime counts.
 *
 * Sources:
 *   PSA (2025a). 2024 Census of Population — Occidental Mindoro.
 *   PSA (2025b). Occidental Mindoro Women and Men 2025 Handbook.
 */

const CRIME_DATA = {
  province: {
    name:              'Occidental Mindoro',
    region:            'MIMAROPA',
    population2024:    511417,
    policePersonnel2024: 374,
    municipalities:    11,
    barangays:         164,
  },

  municipalities: [
    {
      id:          'abra-de-ilog',
      name:        'Abra de Ilog',
      population:  31910,
      police:      22,
      description: 'Northern coastal municipality along Tablas Strait.',
    },
    {
      id:          'calintaan',
      name:        'Calintaan',
      population:  31088,
      police:      21,
      description: 'Interior upland municipality in central Occidental Mindoro.',
    },
    {
      id:          'looc',
      name:        'Looc',
      population:  9426,
      police:      21,
      description: 'Island municipality in the Lubang island group.',
    },
    {
      id:          'lubang',
      name:        'Lubang',
      population:  18761,
      police:      21,
      description: 'Main municipality of the Lubang island group.',
    },
    {
      id:          'magsaysay',
      name:        'Magsaysay',
      population:  40987,
      police:      22,
      description: 'Central municipality between Mamburao and Sablayan.',
    },
    {
      id:          'mamburao',
      name:        'Mamburao',
      population:  44554,
      police:      34,
      description: 'Provincial capital and administrative center.',
    },
    {
      id:          'paluan',
      name:        'Paluan',
      population:  19461,
      police:      21,
      description: 'Northwestern municipality facing the South China Sea.',
    },
    {
      id:          'rizal',
      name:        'Rizal',
      population:  40319,
      police:      36,
      description: 'Central-east municipality with diverse terrain.',
    },
    {
      id:          'sablayan',
      name:        'Sablayan',
      population:  91406,
      police:      66,
      description: 'Second most populous municipality; large coastal and upland territory.',
    },
    {
      id:          'san-jose',
      name:        'San Jose',
      population:  143495,
      police:      74,
      description: 'Most populous municipality; main commercial center in the south.',
    },
    {
      id:          'santa-cruz',
      name:        'Santa Cruz',
      population:  40010,
      police:      26,
      description: 'Southern coastal municipality near San Jose.',
    },
  ],
};

// ── DYNAMIC STAT HELPERS ─────────────────────────────────────────
// All functions read from ALL_INCIDENTS (populated at runtime by upload).

/**
 * Total incident count for a municipality, optionally filtered.
 * @param {string}       municipalityId
 * @param {number|'all'} year
 * @param {string}       crimeType  'total' | specific key
 */
function getCrimeCount(municipalityId, year, crimeType) {
  return ALL_INCIDENTS.filter(i => {
    if (i.municipalityId !== municipalityId) return false;
    if (year !== 'all' && i.year !== parseInt(year, 10)) return false;
    if (crimeType && crimeType !== 'total' && i.crimeType !== crimeType) return false;
    return true;
  }).length;
}

/**
 * Crime rate per 10,000 residents for a municipality.
 * Based on uploaded data against 2024 population.
 */
function getCrimeRate(municipalityId) {
  const muni  = CRIME_DATA.municipalities.find(m => m.id === municipalityId);
  if (!muni || !muni.population) return 0;
  const count = getCrimeCount(municipalityId, 'all', 'total');
  return parseFloat(((count / muni.population) * 10000).toFixed(1));
}

/**
 * Returns the top municipality by uploaded incident count.
 */
function getTopMunicipality() {
  let top = null, topCount = 0;
  CRIME_DATA.municipalities.forEach(m => {
    const c = getCrimeCount(m.id, 'all', 'total');
    if (c > topCount) { topCount = c; top = m; }
  });
  return top;
}

/**
 * Returns sorted unique years present in uploaded data.
 */
function getDataYears() {
  if (!ALL_INCIDENTS.length) return [];
  return [...new Set(ALL_INCIDENTS.map(i => i.year))].sort();
}
