/**
 * GeoCRIME — App Controller (js/app.js)
 * All stats derived from ALL_INCIDENTS (upload-only).
 */

(function () {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────────
  let state = {
    year:      'all',
    crimeType: 'total',
    metric:    'count',
  };

  let _activeMunicipalityId = null;

  // ── INIT ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    MapModule.init('map', _onMunicipalityClick);
    ChartsModule.init(state.year, state.crimeType);
    _bindFilters();
    _bindChartTabs();
    _bindInfoPanel();
    _bindXaiPanel();
    _bindBrgyPicker();
    _bindUploadPanel();
    _updateOverlayTitle();
    _updateSummaryStats();
    _renderRankingList();
  });

  // ── FILTER BINDINGS ───────────────────────────────────────────
  function _bindFilters() {
    document.getElementById('filter-year').addEventListener('change', e => {
      state.year = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
      _applyFilters();
    });
    document.getElementById('filter-crime-type').addEventListener('change', e => {
      state.crimeType = e.target.value;
      _applyFilters();
    });
    document.getElementById('filter-metric').addEventListener('change', e => {
      state.metric = e.target.value;
      _applyFilters();
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      state = { year: 'all', crimeType: 'total', metric: 'count' };
      document.getElementById('filter-year').value       = 'all';
      document.getElementById('filter-crime-type').value = 'total';
      document.getElementById('filter-metric').value     = 'count';
      document.getElementById('dot-hint').classList.remove('visible');
      document.getElementById('info-panel').classList.add('hidden');
      _applyFilters();
    });
  }

  function _applyFilters() {
    MapModule.update(state.year, state.crimeType, state.metric);
    ChartsModule.updateBar(state.year, state.crimeType);
    _renderRankingList();
    _updateOverlayTitle();
    _updateSummaryStats();
  }

  // ── REFRESH YEAR FILTER ───────────────────────────────────────
  function _refreshYearFilter() {
    const sel   = document.getElementById('filter-year');
    const years = getDataYears();
    // Keep "All Years" option; rebuild year options from uploaded data
    sel.innerHTML = '<option value="all">All Years</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });
    sel.value = 'all';
    state.year = 'all';
  }

  // ── REFRESH CRIME TYPE FILTER ─────────────────────────────────
  function _refreshCrimeTypeFilter() {
    const sel   = document.getElementById('filter-crime-type');
    const types = getActiveCrimeTypes();   // from incidents.js
    // Keep "Total" option; add one option per unique uploaded crime type
    sel.innerHTML = '<option value="total">All Crime Types</option>';
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label || t.key;
      sel.appendChild(opt);
    });
    sel.value = 'total';
    state.crimeType = 'total';
  }

  // ── MAP OVERLAY TITLE ─────────────────────────────────────────
  function _updateOverlayTitle() {
    const yearLabel = state.year === 'all' ? 'All Years' : String(state.year);
    const typeMeta  = CRIME_TYPE_META[state.crimeType];
    const typeLabel = state.crimeType === 'total'
      ? 'All Types'
      : (typeMeta ? typeMeta.label : state.crimeType);
    document.getElementById('map-overlay-title').textContent =
      `Crime Heatmap — ${yearLabel} — ${typeLabel}`;
  }

  // ── SUMMARY STATS ─────────────────────────────────────────────
  function _updateSummaryStats() {
    const total    = ALL_INCIDENTS.length;
    const years    = getDataYears();
    const topMuni  = getTopMunicipality();
    const types    = getActiveCrimeTypes();

    document.getElementById('stat-total').textContent =
      total > 0 ? total.toLocaleString() : '—';

    // Show number of unique crime types instead of "index crimes"
    document.getElementById('stat-index').textContent =
      types.length > 0 ? types.length : '—';

    document.getElementById('stat-hotspot').textContent =
      topMuni ? topMuni.name : '—';

    // Show year range instead of CSE
    const yearRange = years.length > 1
      ? `${years[0]}–${years[years.length-1]}`
      : years.length === 1
        ? String(years[0])
        : '—';
    document.getElementById('stat-cse').textContent = yearRange;

    // Update label for stat cards
    const indexLabel = document.querySelector('[data-stat="index-label"]');
    if (indexLabel) indexLabel.textContent = 'Crime Types';
    const cseLabel = document.querySelector('[data-stat="cse-label"]');
    if (cseLabel) cseLabel.textContent = 'Year Range';
  }

  // ── RANKING LIST ──────────────────────────────────────────────
  function _renderRankingList() {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';

    if (!ALL_INCIDENTS.length) {
      list.innerHTML = '<li style="color:#4d5b6e;font-size:11px;padding:8px;text-align:center">No data uploaded yet.</li>';
      return;
    }

    const munis = CRIME_DATA.municipalities.map(m => ({
      ...m,
      count: getCrimeCount(m.id, state.year, state.crimeType),
      rate:  getCrimeRate(m.id),
    })).sort((a, b) => {
      return state.metric === 'rate' ? b.rate - a.rate : b.count - a.count;
    });

    const maxVal = state.metric === 'rate' ? munis[0].rate : munis[0].count;
    const RANK_COLS = ['#d7191c','#d7191c','#f46d43','#f46d43','#fdae61',
                       '#fee08b','#a6d96a','#66bd63','#1a9850','#1a9850','#1a9850'];

    munis.forEach((m, rank) => {
      const val    = state.metric === 'rate' ? m.rate : m.count;
      const pct    = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const colour = RANK_COLS[Math.min(rank, RANK_COLS.length - 1)];
      const label  = state.metric === 'rate' ? val.toFixed(1) : val.toLocaleString();

      const li = document.createElement('li');
      li.dataset.id = m.id;
      li.title      = `${m.name} — click to view on map`;
      li.innerHTML  = `
        <span class="rank-name">${m.name}</span>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${pct.toFixed(1)}%;background:${colour}"></div>
        </div>
        <span class="rank-count">${label}</span>`;
      li.addEventListener('click', () => MapModule.highlightById(m.id));
      list.appendChild(li);
    });
  }

  // ── INFO PANEL ────────────────────────────────────────────────
  function _onMunicipalityClick(mData, riskTier) {
    _activeMunicipalityId = mData.id;

    // Populate info panel with live counts from uploaded data
    const panel = document.getElementById('info-panel');
    document.getElementById('info-name').textContent = mData.name;

    const badge = document.getElementById('info-risk-badge');
    badge.textContent = riskTier === 'high' ? '🔴 High Risk'
                      : riskTier === 'medium' ? '🟠 Medium Risk' : '🟢 Low Risk';
    badge.className   = 'info-risk-badge risk-' + riskTier;

    document.getElementById('info-pop').textContent    = mData.population.toLocaleString();
    document.getElementById('info-police').textContent = mData.police;
    document.getElementById('info-rate').textContent   = getCrimeRate(mData.id).toFixed(1) + ' per 10,000';

    // Dynamic year counts from uploaded data
    const years = getDataYears();
    const y0 = years[0], y1 = years[1], y2 = years[2];
    document.getElementById('info-c2021').textContent =
      y0 ? getCrimeCount(mData.id, y0, 'total').toLocaleString() : '—';
    document.getElementById('info-c2022').textContent =
      y1 ? getCrimeCount(mData.id, y1, 'total').toLocaleString() : '—';
    document.getElementById('info-c2023').textContent =
      y2 ? getCrimeCount(mData.id, y2, 'total').toLocaleString() : '—';

    // Update year row labels dynamically
    const rows = document.querySelectorAll('.info-row .info-key');
    if (rows[3]) rows[3].textContent = y0 ? `Crimes (${y0})` : 'Crimes (Yr 1)';
    if (rows[4]) rows[4].textContent = y1 ? `Crimes (${y1})` : 'Crimes (Yr 2)';
    if (rows[5]) rows[5].textContent = y2 ? `Crimes (${y2})` : 'Crimes (Yr 3)';

    // Top crime types for this municipality
    const typeCounts = {};
    ALL_INCIDENTS
      .filter(i => i.municipalityId === mData.id)
      .forEach(i => { typeCounts[i.crimeType] = (typeCounts[i.crimeType]||0) + 1; });

    const focusGrid = document.getElementById('info-focus-grid');
    focusGrid.innerHTML = '';
    Object.entries(typeCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([key, count]) => {
        const meta  = CRIME_TYPE_META[key] || {};
        const label = meta.label || key;
        const item  = document.createElement('div');
        item.className = 'focus-item';
        item.style.borderLeft = `3px solid ${meta.color || '#3a7bd5'}`;
        item.innerHTML = `<span class="focus-label" title="${label}">${label}</span>
                          <span class="focus-count">${count}</span>`;
        focusGrid.appendChild(item);
      });

    // Total uploaded count
    const totalForMuni = getCrimeCount(mData.id, 'all', 'total');
    document.getElementById('info-index2023').textContent =
      totalForMuni > 0 ? totalForMuni.toLocaleString() : '—';

    document.getElementById('info-desc').textContent = mData.description || '';
    panel.classList.remove('hidden');

    _openBrgyPicker(mData);
    _openXaiPanel(mData);
  }

  function _bindInfoPanel() {
    document.getElementById('info-close').addEventListener('click', () => {
      document.getElementById('info-panel').classList.add('hidden');
      document.getElementById('dot-hint').classList.remove('visible');
    });
  }

  // ── CHART TABS ────────────────────────────────────────────────
  function _bindChartTabs() {
    document.querySelectorAll('.chart-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ChartsModule.showTab(btn.dataset.chart);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // XAI PANEL
  // ══════════════════════════════════════════════════════════════

  function _bindXaiPanel() {
    document.getElementById('xai-close').addEventListener('click', _closeXaiPanel);
    document.getElementById('xai-barangay-select').addEventListener('change', e => {
      if (e.target.value && _activeMunicipalityId) {
        _runXaiPrediction(_activeMunicipalityId, e.target.value);
      }
    });
  }

  function _openXaiPanel(mData) {
    if (!ALL_INCIDENTS.length) return;   // no data yet

    const panel     = document.getElementById('xai-panel');
    const barangays = getUploadedBarangays(mData.id);

    document.getElementById('xai-municipality-name').textContent = mData.name;

    const sel = document.getElementById('xai-barangay-select');
    sel.innerHTML = '<option value="">— Select barangay —</option>';
    barangays.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      sel.appendChild(opt);
    });

    ['xai-gauge-section','xai-explanation-section','xai-factors-section',
     'xai-shap-section','xai-features-section','xai-ranking-section'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    _renderBrgyRanking(mData.id);
    panel.classList.remove('hidden');

    if (barangays.length) {
      sel.value = barangays[0];
      _runXaiPrediction(mData.id, barangays[0]);
    }
  }

  function _closeXaiPanel() {
    document.getElementById('xai-panel').classList.add('hidden');
  }

  function _runXaiPrediction(municipalityId, barangayName) {
    // Only run if there is data for this barangay
    const count = ALL_INCIDENTS.filter(
      i => i.municipalityId === municipalityId && i.barangay === barangayName
    ).length;

    if (count === 0) {
      ['xai-gauge-section','xai-explanation-section','xai-factors-section',
       'xai-shap-section','xai-features-section'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });
      return;
    }

    const result = XAI.predict(municipalityId, barangayName);
    _renderGauge(result);
    _renderExplanation(result);
    _renderTopFactors(result);
    _renderShapBars(result);
    _renderFeatureTable(result);

    ['xai-gauge-section','xai-explanation-section','xai-factors-section',
     'xai-shap-section','xai-features-section','xai-ranking-section'].forEach(id => {
      document.getElementById(id).style.display = '';
    });

    document.querySelectorAll('.xai-brgy-item').forEach(el => {
      el.classList.toggle('active', el.dataset.brgy === barangayName);
    });
  }

  function _renderExplanation(result) {
    const ex = result.explanation;
    if (!ex) return;
    document.getElementById('xai-explanation-headline').textContent   = ex.headline;
    document.getElementById('xai-explanation-summary').textContent    = ex.summary;
    document.getElementById('xai-explanation-conclusion').textContent = ex.conclusion;
    const cards = document.getElementById('xai-reason-cards');
    cards.innerHTML = '';
    ex.reasons.forEach(r => {
      const card = document.createElement('div');
      card.className = `xai-reason-card ${r.type}`;
      card.innerHTML = `
        <div class="xai-reason-icon">${r.icon}</div>
        <div class="xai-reason-body">
          <div class="xai-reason-title">${r.title}</div>
          <div class="xai-reason-text">${r.text}</div>
        </div>`;
      cards.appendChild(card);
    });
  }

  function _renderGauge(result) {
    const arc        = document.getElementById('xai-gauge-arc');
    const scoreEl    = document.getElementById('xai-gauge-score');
    const riskBadge  = document.getElementById('xai-risk-badge');
    const trendBadge = document.getElementById('xai-trend-badge');
    const forecastEl = document.getElementById('xai-forecast-period');

    const arcLen = 251.2;
    arc.style.strokeDashoffset = arcLen - (result.riskScore / 100) * arcLen;
    arc.style.stroke           = result.riskColour;
    scoreEl.textContent        = result.riskScore;
    scoreEl.style.fill         = result.riskColour;

    const badgeColours = {
      Critical:{ bg:'rgba(215,25,28,.2)',   border:'#d7191c', text:'#ff6b6b' },
      High:    { bg:'rgba(244,109,67,.2)',  border:'#f46d43', text:'#ffa07a' },
      Moderate:{ bg:'rgba(254,224,139,.15)',border:'#fee08b', text:'#ffd700' },
      Low:     { bg:'rgba(26,152,80,.2)',   border:'#1a9850', text:'#4ade80' },
    };
    const bc = badgeColours[result.riskLevel] || badgeColours.Low;
    riskBadge.textContent   = result.riskLevel + ' Risk';
    riskBadge.style.cssText = `background:${bc.bg};border:1px solid ${bc.border};color:${bc.text};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;`;

    const trendIcon = { Rising:'↑', Stable:'→', Declining:'↓' }[result.forecast.trend] || '→';
    const trendCol  = { Rising:'#e74c3c', Stable:'#f39c12', Declining:'#27ae60' }[result.forecast.trend];
    trendBadge.textContent    = `${trendIcon} ${result.forecast.trend}`;
    trendBadge.style.color    = trendCol;
    trendBadge.style.borderColor = trendCol;
    forecastEl.textContent    = result.forecast.nextPeriod;
  }

  function _renderTopFactors(result) {
    const ul = document.getElementById('xai-factors-list');
    ul.innerHTML = '';
    result.topFactors.forEach((f, i) => {
      const li = document.createElement('li');
      li.textContent = `${['🥇','🥈','🥉'][i]||'•'} ${f}`;
      ul.appendChild(li);
    });
  }

  function _renderShapBars(result) {
    const container = document.getElementById('xai-shap-bars');
    container.innerHTML = '';
    const maxAbs = Math.max(...result.features.map(f => Math.abs(f.shapValue)), 0.001);
    result.features.forEach(feat => {
      const pct    = (Math.abs(feat.shapValue) / maxAbs) * 100;
      const colour = feat.shapValue >= 0 ? '#e74c3c' : '#27ae60';
      const valStr = (feat.shapValue >= 0 ? '+' : '') + feat.shapValue.toFixed(3);
      const row    = document.createElement('div');
      row.className = 'xai-shap-row';
      row.innerHTML = `
        <span class="xai-shap-feat-name" title="${feat.desc}">${feat.name}</span>
        <div class="xai-shap-bar-wrap">
          <div class="xai-shap-bar" style="width:${pct.toFixed(1)}%;background:${colour}"></div>
        </div>
        <span class="xai-shap-val" style="color:${colour}">${valStr}</span>`;
      container.appendChild(row);
    });
  }

  function _renderFeatureTable(result) {
    const tbody = document.getElementById('xai-feat-tbody');
    tbody.innerHTML = '';
    result.features.forEach(feat => {
      const tr      = document.createElement('tr');
      const rawDisp = typeof feat.value === 'number'
        ? (Number.isInteger(feat.value) ? feat.value.toLocaleString() : feat.value.toFixed(1))
        : feat.value;
      const shapCol = feat.shapValue >= 0 ? '#e74c3c' : '#27ae60';
      const shapStr = (feat.shapValue >= 0 ? '+' : '') + feat.shapValue.toFixed(3);
      tr.innerHTML  = `
        <td><span class="feat-desc-tooltip" title="${feat.desc}">${feat.name}</span></td>
        <td>${rawDisp} <small style="color:#4d5b6e">${feat.unit}</small></td>
        <td style="color:#8b949e">${feat.normalised.toFixed(2)}</td>
        <td style="color:${shapCol};font-weight:600">${shapStr}</td>`;
      tbody.appendChild(tr);
    });
  }

  function _renderBrgyRanking(municipalityId) {
    const container = document.getElementById('xai-brgy-list');
    container.innerHTML = '<div style="color:#4d5b6e;font-size:10px;padding:4px">Computing…</div>';
    setTimeout(() => {
      if (!ALL_INCIDENTS.length) {
        container.innerHTML = '<div style="color:#4d5b6e;font-size:10px;padding:4px">Upload data to see predictions.</div>';
        return;
      }
      const report = XAI.getMunicipalityReport(municipalityId);
      container.innerHTML = '';
      report.forEach(r => {
        const item = document.createElement('div');
        item.className    = 'xai-brgy-item';
        item.dataset.brgy = r.barangay;
        item.innerHTML    = `
          <span class="xai-brgy-name">${r.barangay}</span>
          <div class="xai-brgy-bar-wrap">
            <div class="xai-brgy-bar" style="width:${r.riskScore}%;background:${r.riskColour}"></div>
          </div>
          <span class="xai-brgy-score" style="color:${r.riskColour}">${r.riskScore}</span>`;
        item.addEventListener('click', () => {
          document.getElementById('xai-barangay-select').value = r.barangay;
          _runXaiPrediction(municipalityId, r.barangay);
        });
        container.appendChild(item);
      });
      document.getElementById('xai-ranking-section').style.display = '';
    }, 50);
  }

  // ══════════════════════════════════════════════════════════════
  // BARANGAY PICKER
  // ══════════════════════════════════════════════════════════════

  let _pickerMuniData = null;

  function _bindBrgyPicker() {
    document.getElementById('brgy-picker-close')
      .addEventListener('click', _closeBrgyPicker);

    document.getElementById('brgy-picker-showall').addEventListener('click', () => {
      if (_pickerMuniData) {
        _closeBrgyPicker();
        const barangays = getUploadedBarangays(_pickerMuniData.id);
        barangays.forEach(b => MapModule.showBarangayDots(_pickerMuniData.id, b));
        document.getElementById('dot-hint').classList.add('visible');
      }
    });

    document.getElementById('brgy-picker-search').addEventListener('input', e => {
      _filterBrgyList(e.target.value.toLowerCase());
    });
  }

  function _openBrgyPicker(mData) {
    _pickerMuniData = mData;
    MapModule.clearDots();

    document.getElementById('brgy-picker-muni-name').textContent = mData.name;
    document.getElementById('brgy-picker-search').value = '';

    // Only show barangays that have uploaded data
    const barangays = getUploadedBarangays(mData.id);
    if (!barangays.length) {
      document.getElementById('brgy-picker-list').innerHTML =
        '<div style="color:#4d5b6e;font-size:11px;padding:12px;text-align:center">No uploaded data for this municipality.</div>';
      document.getElementById('brgy-picker').classList.remove('hidden');
      return;
    }

    _renderBrgyList(barangays, mData.id);
    document.getElementById('brgy-picker').classList.remove('hidden');
  }

  function _closeBrgyPicker() {
    document.getElementById('brgy-picker').classList.add('hidden');
    _pickerMuniData = null;
  }

  function _renderBrgyList(barangays, municipalityId) {
    const list = document.getElementById('brgy-picker-list');
    list.innerHTML = '';

    barangays.forEach(b => {
      const count = ALL_INCIDENTS.filter(
        i => i.municipalityId === municipalityId && i.barangay === b
      ).length;

      const item = document.createElement('div');
      item.className    = 'brgy-picker-item';
      item.dataset.brgy = b;
      item.innerHTML    = `
        <span class="brgy-picker-name">${b}</span>
        <div class="brgy-picker-meta">
          <span class="brgy-uploaded-tag">Uploaded</span>
          <span class="brgy-picker-count">${count} incidents</span>
        </div>`;

      item.addEventListener('click', () => {
        list.querySelectorAll('.brgy-picker-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        MapModule.showBarangayDots(municipalityId, b);
        document.getElementById('dot-hint').classList.add('visible');

        const sel = document.getElementById('xai-barangay-select');
        if (sel) { sel.value = b; _runXaiPrediction(municipalityId, b); }
      });

      list.appendChild(item);
    });
  }

  function _filterBrgyList(query) {
    document.querySelectorAll('.brgy-picker-item').forEach(item => {
      item.style.display = item.dataset.brgy.toLowerCase().includes(query) ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════════
  // UPLOAD PANEL
  // ══════════════════════════════════════════════════════════════

  function _bindUploadPanel() {
    const dropzone  = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('upload-file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) _handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => { if (e.target.files[0]) _handleFile(e.target.files[0]); });

    document.getElementById('btn-download-template')
      .addEventListener('click', () => UploadModule.downloadTemplate());
    document.getElementById('btn-import')
      .addEventListener('click', _doImport);
    document.getElementById('btn-upload-cancel')
      .addEventListener('click', _resetUploadPanel);
    document.getElementById('btn-clear-uploaded').addEventListener('click', () => {
      UploadModule.clearUploaded();
      _resetUploadPanel();
      _afterDataChange();
      document.getElementById('upload-imported-summary').classList.add('hidden');
      document.getElementById('btn-clear-uploaded').classList.add('hidden');
      _showUploadToast('Uploaded data cleared.', 'info');
    });
  }

  async function _handleFile(file) {
    if (!['csv','json'].includes(file.name.split('.').pop().toLowerCase())) {
      _showUploadToast('Only CSV and JSON files are supported.', 'error'); return;
    }
    _showUploadLoading(true);
    try {
      const result = await UploadModule.parseFile(file);
      _showUploadLoading(false);
      _renderUploadMapper(file.name, result);
    } catch (err) {
      _showUploadLoading(false);
      _showUploadToast('Parse error: ' + err.message, 'error');
    }
  }

  function _renderUploadMapper(fileName, result) {
    document.getElementById('upload-mapper').classList.remove('hidden');
    document.getElementById('upload-dropzone').style.display = 'none';
    document.getElementById('upload-file-info').textContent =
      `📄 ${fileName} — ${result.totalRows.toLocaleString()} rows, ${result.headers.length} columns`;

    const grid = document.getElementById('upload-col-grid');
    grid.innerHTML = '';
    const FIELD_LABELS = {
      lat:'Latitude', lng:'Longitude', barangay:'Barangay',
      municipality:'Municipality', crimeType:'Crime Type / Offense', date:'Date'
    };
    Object.entries(FIELD_LABELS).forEach(([field, label]) => {
      const detected = result.colMap[field] || '';
      const row      = document.createElement('div');
      row.className  = 'upload-col-row';
      row.innerHTML  = `
        <span class="upload-col-label">${label}</span>
        <select class="upload-col-select filter-select" data-field="${field}">
          <option value="">— not mapped —</option>
          ${result.headers.map(h =>
            `<option value="${h}" ${h === detected ? 'selected' : ''}>${h}</option>`
          ).join('')}
        </select>`;
      grid.appendChild(row);
    });
    grid.querySelectorAll('.upload-col-select').forEach(sel => {
      sel.addEventListener('change', e => UploadModule.updateColMap(e.target.dataset.field, e.target.value));
    });

    const val   = result.validation;
    const valEl = document.getElementById('upload-validation');
    valEl.className = 'upload-validation ' + (val.invalid > 0 ? 'has-errors' : 'all-ok');
    valEl.innerHTML = `✔ ${val.valid} valid rows`
      + (val.invalid > 0 ? ` &nbsp; ⚠ ${val.invalid} bad coords` : '')
      + (val.errors.length ? `<br><small>${val.errors.slice(0,3).join('<br>')}</small>` : '');

    _renderPreviewTable(result.preview, result.headers);
  }

  function _renderPreviewTable(rows, headers) {
    const tbl   = document.getElementById('upload-preview-table');
    tbl.innerHTML = '';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = headers.map(h => `<td>${row[h] ?? ''}</td>`).join('');
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
  }

  function _doImport() {
    const result = UploadModule.importPending();
    _resetUploadPanel();
    _afterDataChange();

    const summary = document.getElementById('upload-imported-summary');
    summary.classList.remove('hidden');
    summary.innerHTML = `✔ Imported <strong>${result.imported}</strong> records`
      + (result.skipped > 0 ? ` &nbsp;·&nbsp; ⚠ ${result.skipped} skipped` : '')
      + `<br><small>Total in store: ${UploadModule.getUploadedCount()}</small>`;

    document.getElementById('btn-clear-uploaded').classList.remove('hidden');
    _showUploadToast(`${result.imported} records imported.`, 'success');
  }

  /** Called after any data change — refreshes all dynamic UI */
  function _afterDataChange() {
    _refreshYearFilter();
    _refreshCrimeTypeFilter();
    MapModule.update(state.year, state.crimeType, state.metric);
    ChartsModule.refreshAll();
    _renderRankingList();
    _updateOverlayTitle();
    _updateSummaryStats();
    _refreshCrimeLegend();
  }

  function _resetUploadPanel() {
    document.getElementById('upload-mapper').classList.add('hidden');
    document.getElementById('upload-dropzone').style.display = '';
    document.getElementById('upload-file-input').value = '';
  }

  function _showUploadLoading(on) {
    document.getElementById('upload-dropzone')
      .querySelector('.upload-drop-text').textContent = on
        ? 'Parsing file…'
        : 'Drop CSV / JSON here\nor click to browse';
  }

  // ── DYNAMIC CRIME LEGEND ──────────────────────────────────────
  function _refreshCrimeLegend() {
    const container = document.getElementById('crime-type-legend-items');
    if (!container) return;
    container.innerHTML = '';
    const types = getActiveCrimeTypes();
    if (!types.length) {
      container.innerHTML = '<div class="crime-legend-item" style="color:#4d5b6e">No data uploaded</div>';
      return;
    }
    types.forEach(t => {
      const div = document.createElement('div');
      div.className = 'crime-legend-item';
      div.innerHTML = `
        <div class="crime-legend-dot" style="background:${t.color || '#888'}"></div>
        <span title="${t.label}">${t.label || t.key}</span>`;
      container.appendChild(div);
    });
  }

  function _showUploadToast(msg, type) {
    const existing = document.getElementById('geocrime-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'geocrime-toast';
    toast.className = `geocrime-toast geocrime-toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3500);
  }

})();
