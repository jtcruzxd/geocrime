/**
 * GeoCRIME — Upload Module v2 (js/upload.js)
 *
 * Accepts CSV or JSON files. Every unique crime description from the
 * uploaded data becomes its own crime type — no bucketing into generic
 * categories. Long descriptions are shortened to their RA / RPC citation
 * or to a compact 3-word label.
 *
 * Required columns (case-insensitive, flexible aliases):
 *   lat / latitude / y
 *   lng / lon / longitude / x
 *   barangay / brgy / barangay_name
 *   municipality / muni / city / town / lgu
 *   crime_type / crimetype / type / offense / crime / category / description
 *   date / incident_date / date_reported  (YYYY-MM-DD | MM/DD/YYYY | DD-MM-YYYY)
 *
 * Optional:
 *   year   — derived from date if absent
 *   month  — derived from date if absent
 */

const UploadModule = (() => {

  // ── COLUMN ALIASES ──────────────────────────────────────────────
  const ALIASES = {
    lat:          ['lat','latitude','y','x_coord','lat_decimal'],
    lng:          ['lng','lon','long','longitude','x','y_coord','lng_decimal'],
    barangay:     ['barangay','brgy','barangay_name','brgy_name','village','sitio'],
    municipality: ['municipality','muni','city','town','lgu','municipality_name','city_municipality'],
    crimeType:    ['crime_type','crimetype','type','offense','crime','category',
                   'crime_category','description','offense_type','nature','nature_of_offense',
                   'violation','charge'],
    date:         ['date','incident_date','date_reported','date_of_incident',
                   'report_date','date_committed','date_filed'],
  };

  // ── RA / RPC SHORTENER ──────────────────────────────────────────
  /**
   * Converts a raw crime description into a short display label.
   *
   * Rules (applied in order):
   *  1. Already short (≤ 30 chars) → return as-is (title-cased)
   *  2. Contains "Republic Act" / "RA" + number → "RA XXXX"
   *  3. Contains "Article" / "Art." + number → "RPC Art. XX"
   *  4. Contains "Presidential Decree" / "PD" → "PD XXXX"
   *  5. Contains "Batas Pambansa" / "BP" → "BP XXXX"
   *  6. Contains "Executive Order" / "EO" → "EO XX"
   *  7. Fallback: take first 3 significant words
   */
  function shortenCrimeLabel(raw) {
    if (!raw) return 'Unknown';
    const str = String(raw).trim();
    // NOTE: do NOT short-circuit on length here — citation patterns must run first

    // RA XXXX  (Republic Act No. / RA / R.A.)
    let m = str.match(/(?:Republic\s+Act|R\.?A\.?)\s*(?:No\.?)?\s*(\d[\d,\s]*\d|\d)/i);
    if (m) return 'RA ' + m[1].replace(/[\s,]/g,'');

    // RPC Art. XX — check for Revised Penal Code first, then find article number
    if (/(?:Revised\s+Penal\s+Code|R\.?P\.?C\.?)/i.test(str)) {
      const artM = str.match(/Art(?:icle)?\.?\s*(\d[\d\-A-Za-z]*)/i);
      return artM ? 'RPC Art. ' + artM[1].toUpperCase() : 'RPC';
    }

    // Article XX (any position, any length)
    m = str.match(/\bArt(?:icle)?\.?\s*(\d[\d\-A-Za-z]*)/i);
    if (m) return 'RPC Art. ' + m[1].toUpperCase();

    // PD XXXX
    m = str.match(/(?:Presidential\s+Decree|P\.?D\.?)\s*(?:No\.?)?\s*(\d+)/i);
    if (m) return 'PD ' + m[1];

    // BP XXXX
    m = str.match(/(?:Batas\s+Pambansa|B\.?P\.?)\s*(?:Blg\.?)?\s*(\d+)/i);
    if (m) return 'BP ' + m[1];

    // EO XX — Executive Order / E.O. / EO with optional "No."
    m = str.match(/(?:Executive\s+Order|E\.O\.|EO)\s*(?:No\.?\s*)?(\d+)/i);
    if (m) return 'EO ' + m[1];

    // Already short — return title-cased
    if (str.length <= 30) return _titleCase(str);

    // Fallback: first 3 significant words (skip stopwords)
    const STOPWORDS = new Set(['the','a','an','of','for','in','on','at','to','and',
                                'or','with','under','by','as','per','no','violation']);
    const words = str.replace(/[^a-zA-Z0-9\s]/g,' ').split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()));
    return _titleCase(words.slice(0, 3).join(' '));
  }

  /**
   * Generates a stable key (slug) from a short label.
   * Used as the crime type key in CRIME_TYPE_META and incident records.
   */
  function labelToKey(label) {
    return label.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  function _titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // ── COLOUR PALETTE ──────────────────────────────────────────────
  const PALETTE = [
    '#e74c3c','#f39c12','#2980b9','#27ae60','#8e44ad',
    '#e91e8c','#16a085','#d35400','#c0392b','#1abc9c',
    '#f1c40f','#3498db','#95a5a6','#2c3e50','#e67e22',
    '#a93226','#1f618d','#1e8449','#6c3483','#b7950b',
  ];
  let _paletteIdx = 0;
  const _typeColourMap = {};   // key → colour (persists across imports)

  function _getColour(key) {
    if (!_typeColourMap[key]) {
      _typeColourMap[key] = PALETTE[_paletteIdx % PALETTE.length];
      _paletteIdx++;
    }
    return _typeColourMap[key];
  }

  // ── COLUMN DETECTION ───────────────────────────────────────────
  function _detectColumns(headers) {
    const lower = headers.map(h => h.toLowerCase().trim());
    const map   = {};
    for (const [field, aliases] of Object.entries(ALIASES)) {
      for (const alias of aliases) {
        const idx = lower.indexOf(alias);
        if (idx !== -1) { map[field] = headers[idx]; break; }
      }
    }
    return map;
  }

  function _getMissing(colMap) {
    return Object.keys(ALIASES).filter(k => !colMap[k]);
  }

  // ── CSV PARSER ─────────────────────────────────────────────────
  function _parseCSV(text) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
    const headers = _splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = _splitCSVLine(lines[i]);
      const row  = {};
      headers.forEach((h, j) => { row[h] = vals[j] ?? ''; });
      rows.push(row);
    }
    return { headers, rows };
  }

  function _splitCSVLine(line) {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  // ── JSON PARSER ────────────────────────────────────────────────
  function _parseJSON(text) {
    const data = JSON.parse(text);
    const arr  = Array.isArray(data) ? data
      : (data.data || data.incidents || data.records || []);
    if (!arr.length) throw new Error('JSON must contain an array of records.');
    const headers = Object.keys(arr[0]);
    return { headers, rows: arr.map(r =>
      Object.fromEntries(Object.entries(r).map(([k,v]) => [k, v == null ? '' : String(v)]))
    )};
  }

  // ── DATE PARSING ───────────────────────────────────────────────
  function _parseDate(raw) {
    if (!raw) return null;
    const str = String(raw).trim();

    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return { date:`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,
                    year:+m[1], month:+m[2] };

    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return { date:`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`,
                    year:+m[3], month:+m[1] };

    m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (m) return { date:`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,
                    year:+m[3], month:+m[2] };

    m = str.match(/^(\d{4})$/);
    if (m) return { date:`${m[1]}-01-01`, year:+m[1], month:1 };

    return null;
  }

  // ── ROW → INCIDENT ─────────────────────────────────────────────
  let _uploadIdCounter = 100000;

  function _rowToIncident(row, colMap) {
    const lat = parseFloat(row[colMap.lat]);
    const lng = parseFloat(row[colMap.lng]);
    if (isNaN(lat) || isNaN(lng)) return null;

    // Bounds check: Occidental Mindoro rough bounding box + islands
    if (lat < 11.5 || lat > 14.5 || lng < 119.0 || lng > 122.0) return null;

    const barangay     = (row[colMap.barangay]     || 'Unknown').trim();
    const municipality = (row[colMap.municipality] || 'Unknown').trim();
    const rawDesc      = (row[colMap.crimeType]    || 'Unknown').trim();

    // Build short label and key
    const shortLabel   = shortenCrimeLabel(rawDesc);
    const crimeKey     = labelToKey(shortLabel);
    const colour       = _getColour(crimeKey);

    // Register in CRIME_TYPE_META (idempotent)
    registerCrimeType(crimeKey, shortLabel, colour);

    const parsed = _parseDate(row[colMap.date] || '');
    const date   = parsed ? parsed.date  : '2024-01-01';
    const year   = parsed ? parsed.year  : 2024;
    const month  = parsed ? parsed.month : 1;

    // Match municipalityId
    const muniMatch = CRIME_DATA.municipalities.find(m =>
      m.name.toLowerCase() === municipality.toLowerCase() ||
      m.id.replace(/-/g,' ') === municipality.toLowerCase()
    );
    const municipalityId   = muniMatch ? muniMatch.id   : 'uploaded';
    const municipalityName = muniMatch ? muniMatch.name : municipality;

    // Merge new barangay name into BARANGAY_NAMES seed list
    if (muniMatch && BARANGAY_NAMES[municipalityId] &&
        !BARANGAY_NAMES[municipalityId].includes(barangay)) {
      BARANGAY_NAMES[municipalityId].push(barangay);
    }

    return {
      id:              _uploadIdCounter++,
      municipalityId,
      municipality:    municipalityName,
      barangay,
      lat,
      lng,
      crimeType:       crimeKey,       // slug key for filtering
      crimeLabel:      shortLabel,     // display label (short)
      crimeRaw:        rawDesc,        // original full description
      date,
      year,
      month,
      uploaded:        true,
    };
  }

  // ── VALIDATE ───────────────────────────────────────────────────
  function _validateRows(rows, colMap) {
    let valid = 0, invalid = 0;
    const errors = [];
    rows.forEach((row, i) => {
      const lat = parseFloat(row[colMap.lat]);
      const lng = parseFloat(row[colMap.lng]);
      const inBounds = lat >= 11.5 && lat <= 14.5 && lng >= 119.0 && lng <= 122.0;
      if (isNaN(lat) || isNaN(lng) || !inBounds) {
        invalid++;
        if (errors.length < 5)
          errors.push(`Row ${i+2}: bad coords (${row[colMap.lat]}, ${row[colMap.lng]})`);
      } else {
        valid++;
      }
    });
    return { valid, invalid, errors };
  }

  // ── STATE ──────────────────────────────────────────────────────
  let _pendingRows    = [];
  let _pendingColMap  = {};
  let _pendingHeaders = [];
  let _uploadedCount  = 0;

  // ── PUBLIC API ─────────────────────────────────────────────────

  async function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          let headers, rows;
          if (file.name.toLowerCase().endsWith('.json')) {
            ({ headers, rows } = _parseJSON(text));
          } else {
            ({ headers, rows } = _parseCSV(text));
          }
          const colMap     = _detectColumns(headers);
          const missing    = _getMissing(colMap);
          const validation = _validateRows(rows, colMap);
          const preview    = rows.slice(0, 5);

          _pendingRows    = rows;
          _pendingColMap  = colMap;
          _pendingHeaders = headers;

          resolve({ headers, colMap, missing, rows, preview, validation,
                    totalRows: rows.length });
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read error.'));
      reader.readAsText(file);
    });
  }

  function updateColMap(field, headerName) {
    _pendingColMap[field] = headerName;
  }

  function importPending() {
    if (!_pendingRows.length) return { imported:0, skipped:0, newIncidents:[] };
    let imported = 0, skipped = 0;
    const newIncidents = [];

    _pendingRows.forEach(row => {
      const inc = _rowToIncident(row, _pendingColMap);
      if (inc) { newIncidents.push(inc); imported++; }
      else      { skipped++; }
    });

    ALL_INCIDENTS.push(...newIncidents);
    _uploadedCount += imported;
    _pendingRows   = [];
    _pendingColMap = {};

    return { imported, skipped, newIncidents };
  }

  function clearUploaded() {
    const removed = ALL_INCIDENTS.filter(i => i.uploaded).length;
    ALL_INCIDENTS.splice(0, ALL_INCIDENTS.length,
      ...ALL_INCIDENTS.filter(i => !i.uploaded));
    _uploadedCount  = 0;
    _paletteIdx     = 0;
    // Clear colour map and CRIME_TYPE_META so they rebuild fresh
    Object.keys(_typeColourMap).forEach(k => delete _typeColourMap[k]);
    Object.keys(CRIME_TYPE_META).forEach(k => delete CRIME_TYPE_META[k]);
    return removed;
  }

  function getUploadedCount() { return _uploadedCount; }

  function downloadTemplate() {
    const header = 'lat,lng,barangay,municipality,crime_type,date\n';
    const rows = [
      '12.3530,121.0700,Poblacion I,San Jose,Theft (RA 10883),2023-03-15',
      '12.8400,120.7600,Poblacion,Sablayan,Rape (RPC Art. 266-A),2023-07-22',
      '13.2200,120.6000,Fatima,Mamburao,Physical Injuries (RPC Art. 263),2022-11-05',
      '12.3500,121.0750,Bucayao,San Jose,Illegal Drugs (RA 9165),2023-09-01',
      '12.3600,121.0680,Poblacion II,San Jose,Viol. of VAWC (RA 9262),2023-04-18',
    ].join('\n');
    const blob = new Blob([header + rows], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'geocrime_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Expose shortener so it can be tested independently
  return { parseFile, updateColMap, importPending,
           clearUploaded, getUploadedCount, downloadTemplate,
           shortenCrimeLabel, labelToKey };

})();
