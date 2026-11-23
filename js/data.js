/**
 * GeoCRIME Data Module
 * All crime statistics sourced from:
 *   PSA (2024), Countryside in Figures 2024: Occidental Mindoro
 *   Based on PNP data as cited in the thesis.
 */

// ─── CRIME STATISTICS ───────────────────────────────────────────────────────

const CRIME_DATA = {
  province: {
    name: "Occidental Mindoro",
    population2024: 511417,
    policePersonnel2024: 374,
    years: [2021, 2022, 2023],
    totalCrimeVolume:    [911,  997,  866],
    indexCrimes:         [147,  148,  190],
    crimesAgainstPersons:[109,   90,  132],
    crimesAgainstProperty:[ 38,   58,   58],
    nonIndexCrimes:      [587,  636,  470],
    cse:                 [81.89, 81.54, 72.98],
    cce:                 [99.78, 100.00, 99.88],
  },

  municipalities: [
    {
      id:         "abra-de-ilog",
      name:       "Abra de Ilog",
      population: 31910,
      police:     22,
      crimes:     { 2021: 50,  2022: 59,  2023: 54  },
      ratePerTenThousand: 17.0,
      indexCrimes:{ 2021: 8,   2022: 10,  2023: 12  },
      nonIndex:   { 2021: 42,  2022: 49,  2023: 42  },
      focusCrimes:{ theft:4, rape:3, physicalInjury:2, robbery:1, murder:1, homicide:0, carnapping:1 },
      description: "Northern coastal municipality along Tablas Strait."
    },
    {
      id:         "calintaan",
      name:       "Calintaan",
      population: 31088,
      police:     21,
      crimes:     { 2021: 58,  2022: 55,  2023: 41  },
      ratePerTenThousand: 16.5,
      indexCrimes:{ 2021: 9,   2022: 8,   2023: 10  },
      nonIndex:   { 2021: 49,  2022: 47,  2023: 31  },
      focusCrimes:{ theft:3, rape:2, physicalInjury:2, robbery:1, murder:1, homicide:0, carnapping:0 },
      description: "Interior upland municipality in central Occidental Mindoro."
    },
    {
      id:         "looc",
      name:       "Looc",
      population: 9426,
      police:     21,
      crimes:     { 2021: 18,  2022: 7,   2023: 3   },
      ratePerTenThousand: 9.9,
      indexCrimes:{ 2021: 2,   2022: 1,   2023: 1   },
      nonIndex:   { 2021: 16,  2022: 6,   2023: 2   },
      focusCrimes:{ theft:1, rape:0, physicalInjury:0, robbery:0, murder:0, homicide:0, carnapping:0 },
      description: "Island municipality in the Lubang island group."
    },
    {
      id:         "lubang",
      name:       "Lubang",
      population: 18761,
      police:     21,
      crimes:     { 2021: 26,  2022: 19,  2023: 13  },
      ratePerTenThousand: 10.3,
      indexCrimes:{ 2021: 3,   2022: 3,   2023: 3   },
      nonIndex:   { 2021: 23,  2022: 16,  2023: 10  },
      focusCrimes:{ theft:1, rape:1, physicalInjury:0, robbery:0, murder:0, homicide:0, carnapping:0 },
      description: "Main municipality of the Lubang island group."
    },
    {
      id:         "magsaysay",
      name:       "Magsaysay",
      population: 40987,
      police:     22,
      crimes:     { 2021: 64,  2022: 87,  2023: 45  },
      ratePerTenThousand: 15.9,
      indexCrimes:{ 2021: 9,   2022: 13,  2023: 10  },
      nonIndex:   { 2021: 55,  2022: 74,  2023: 35  },
      focusCrimes:{ theft:4, rape:3, physicalInjury:2, robbery:1, murder:0, homicide:0, carnapping:0 },
      description: "Central municipality between Mamburao and Sablayan."
    },
    {
      id:         "mamburao",
      name:       "Mamburao",
      population: 44554,
      police:     34,
      crimes:     { 2021: 62,  2022: 119, 2023: 96  },
      ratePerTenThousand: 20.7,
      indexCrimes:{ 2021: 10,  2022: 18,  2023: 20  },
      nonIndex:   { 2021: 52,  2022: 101, 2023: 76  },
      focusCrimes:{ theft:6, rape:4, physicalInjury:3, robbery:2, murder:1, homicide:1, carnapping:2 },
      description: "Provincial capital and administrative center."
    },
    {
      id:         "paluan",
      name:       "Paluan",
      population: 19461,
      police:     21,
      crimes:     { 2021: 21,  2022: 15,  2023: 15  },
      ratePerTenThousand: 8.7,
      indexCrimes:{ 2021: 3,   2022: 2,   2023: 3   },
      nonIndex:   { 2021: 18,  2022: 13,  2023: 12  },
      focusCrimes:{ theft:1, rape:1, physicalInjury:0, robbery:0, murder:0, homicide:0, carnapping:0 },
      description: "Northwestern municipality facing the South China Sea."
    },
    {
      id:         "rizal",
      name:       "Rizal",
      population: 40319,
      police:     36,
      crimes:     { 2021: 88,  2022: 60,  2023: 73  },
      ratePerTenThousand: 18.3,
      indexCrimes:{ 2021: 13,  2022: 10,  2023: 15  },
      nonIndex:   { 2021: 75,  2022: 50,  2023: 58  },
      focusCrimes:{ theft:5, rape:4, physicalInjury:3, robbery:1, murder:1, homicide:0, carnapping:1 },
      description: "Central-east municipality with diverse terrain."
    },
    {
      id:         "sablayan",
      name:       "Sablayan",
      population: 91406,
      police:     66,
      crimes:     { 2021: 155, 2022: 171, 2023: 140 },
      ratePerTenThousand: 17.0,
      indexCrimes:{ 2021: 16,  2022: 23,  2023: 40  },
      nonIndex:   { 2021: 139, 2022: 148, 2023: 100 },
      focusCrimes:{ theft:7, rape:5, physicalInjury:4, robbery:2, murder:1, homicide:0, carnapping:2 },
      description: "Second most populous municipality; large coastal and upland territory."
    },
    {
      id:         "san-jose",
      name:       "San Jose",
      population: 143495,
      police:     74,
      crimes:     { 2021: 307, 2022: 341, 2023: 331 },
      ratePerTenThousand: 22.7,
      indexCrimes:{ 2021: 44,  2022: 62,  2023: 80  },
      nonIndex:   { 2021: 263, 2022: 279, 2023: 251 },
      focusCrimes:{ theft:17, rape:15, physicalInjury:7, robbery:5, murder:5, homicide:4, carnapping:7 },
      cse2023:    62.54,
      description: "Most populous municipality; main commercial center in the south. Accounts for ~38% of provincial crime."
    },
    {
      id:         "santa-cruz",
      name:       "Santa Cruz",
      population: 40010,
      police:     26,
      crimes:     { 2021: 62,  2022: 64,  2023: 55  },
      ratePerTenThousand: 15.1,
      indexCrimes:{ 2021: 10,  2022: 10,  2023: 11  },
      nonIndex:   { 2021: 52,  2022: 54,  2023: 44  },
      focusCrimes:{ theft:4, rape:3, physicalInjury:2, robbery:1, murder:0, homicide:0, carnapping:0 },
      description: "Southern coastal municipality near San Jose."
    }
  ]
};

// ─── DERIVED HELPERS ────────────────────────────────────────────────────────

/**
 * Returns total crimes for a municipality in a given year.
 * @param {string} municipalityId
 * @param {number} year  2021 | 2022 | 2023 | 'all'
 * @param {string} crimeType 'total' | 'index' | 'nonIndex'
 */
function getCrimeCount(municipalityId, year, crimeType = 'total') {
  const m = CRIME_DATA.municipalities.find(x => x.id === municipalityId);
  if (!m) return 0;
  if (year === 'all') {
    const years = [2021, 2022, 2023];
    if (crimeType === 'total')    return years.reduce((s, y) => s + m.crimes[y], 0);
    if (crimeType === 'index')    return years.reduce((s, y) => s + m.indexCrimes[y], 0);
    if (crimeType === 'nonIndex') return years.reduce((s, y) => s + m.nonIndex[y], 0);
  }
  if (crimeType === 'total')    return m.crimes[year]      || 0;
  if (crimeType === 'index')    return m.indexCrimes[year] || 0;
  if (crimeType === 'nonIndex') return m.nonIndex[year]    || 0;
  return 0;
}

/**
 * Returns the crime rate per 10,000 residents for a municipality.
 * Uses the mean annual volume for 2021–2023 against 2024 population.
 */
function getCrimeRate(municipalityId) {
  const m = CRIME_DATA.municipalities.find(x => x.id === municipalityId);
  if (!m) return 0;
  return m.ratePerTenThousand;
}

/**
 * Returns all crime counts for a year across all municipalities.
 * Used to compute color scale domain.
 */
function getAllCrimeCounts(year, crimeType = 'total') {
  return CRIME_DATA.municipalities.map(m => getCrimeCount(m.id, year, crimeType));
}

/**
 * Returns the provincial-level time series for charts.
 */
function getProvinceTrend(indicator) {
  const p = CRIME_DATA.province;
  switch (indicator) {
    case 'total':    return p.totalCrimeVolume;
    case 'index':    return p.indexCrimes;
    case 'nonIndex': return p.nonIndexCrimes;
    case 'cse':      return p.cse;
    default:         return p.totalCrimeVolume;
  }
}

// Focus crime labels for the UI
const FOCUS_CRIME_LABELS = {
  theft:           'Theft',
  rape:            'Rape',
  physicalInjury:  'Physical Injury',
  robbery:         'Robbery',
  murder:          'Murder',
  homicide:        'Homicide',
  carnapping:      'Carnapping'
};

// Year options
const YEARS = ['all', 2021, 2022, 2023];
