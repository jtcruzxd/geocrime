/**
 * GeoCRIME — App Controller (js/app.js)
 * Wires all UI elements to MapModule, ChartsModule, and XAI panel.
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
    _renderRankingList();
    _bindFilters();
    _bindChartTabs();
    _bindInfoPanel();
    _bindXaiPanel();
    _updateOverlayTitle();
    _updateSummaryStats();
  });

  // ── FILTER BINDINGS ────────────────────────────────────────────
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

  // ── MAP OVERLAY TITLE ──────────────────────────────────────────
  function _updateOverlayTitle() {
    const yearLabel  = state.year === 'all' ? 'All Years (2021–2023)' : String(state.year);
    const typeLabels = { total:'Total Volume', index:'Index Crimes', nonIndex:'Non-Index Crimes' };
    const metLabel   = state.metric === 'rate' ? '· Rate /10,000' : '';
    document.getElementById('map-overlay-title').textContent =
      `Crime Heatmap — ${yearLabel} — ${typeLabels[state.crimeType]} ${metLabel}`.trim();
  }

  // ── SUMMARY STATS ──────────────────────────────────────────────
  function _updateSummaryStats() {
    let total = 0, index = 0;
    if (state.year === 'all') {
      [2021,2022,2023].forEach(y => {
        CRIME_DATA.municipalities.forEach(m => { total += m.crimes[y]; index += m.indexCrimes[y]; });
      });
    } else {
      CRIME_DATA.municipalities.forEach(m => {
        total += m.crimes[state.year] || 0;
        index += m.indexCrimes[state.year] || 0;
      });
    }
    const sorted = [...CRIME_DATA.municipalities].sort((a, b) => {
      const va = state.metric === 'rate' ? getCrimeRate(a.id) : getCrimeCount(a.id, state.year, state.crimeType);
      const vb = state.metric === 'rate' ? getCrimeRate(b.id) : getCrimeCount(b.id, state.year, state.crimeType);
      return vb - va;
    });
    document.getElementById('stat-total').textContent   = total.toLocaleString();
    document.getElementById('stat-index').textContent   = index.toLocaleString();
    document.getElementById('stat-hotspot').textContent = sorted[0].name;
    document.getElementById('stat-cse').textContent     = '72.98%';
  }

  // ── RANKING LIST ───────────────────────────────────────────────
  function _renderRankingList() {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';
    const sorted = [...CRIME_DATA.municipalities].sort((a, b) => {
      const va = state.metric === 'rate' ? getCrimeRate(a.id) : getCrimeCount(a.id, state.year, state.crimeType);
      const vb = state.metric === 'rate' ? getCrimeRate(b.id) : getCrimeCount(b.id, state.year, state.crimeType);
      return vb - va;
    });
    const maxVal = state.metric === 'rate'
      ? getCrimeRate(sorted[0].id)
      : getCrimeCount(sorted[0].id, state.year, state.crimeType);
    const RANK_COLS = ['#d7191c','#d7191c','#f46d43','#f46d43','#fdae61','#fee08b','#a6d96a','#66bd63','#1a9850','#1a9850','#1a9850'];

    sorted.forEach((m, rank) => {
      const val    = state.metric === 'rate' ? getCrimeRate(m.id) : getCrimeCount(m.id, state.year, state.crimeType);
      const pct    = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const colour = RANK_COLS[Math.min(rank, RANK_COLS.length - 1)];
      const label  = state.metric === 'rate' ? val.toFixed(1) : val.toLocaleString();
      const li     = document.createElement('li');
      li.dataset.id = m.id;
      li.title      = `Click to highlight ${m.name}`;
      li.innerHTML  = `
        <span class="rank-name">${m.name}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct.toFixed(1)}%;background:${colour}"></div></div>
        <span class="rank-count">${label}</span>`;
      li.addEventListener('click', () => MapModule.highlightById(m.id));
      list.appendChild(li);
    });
  }

  // ── INFO PANEL ─────────────────────────────────────────────────
  function _onMunicipalityClick(mData, riskTier) {
    _activeMunicipalityId = mData.id;

    document.getElementById('dot-hint').classList.add('visible');

    // Info panel
    const panel = document.getElementById('info-panel');
    document.getElementById('info-name').textContent = mData.name;
    const badge = document.getElementById('info-risk-badge');
    badge.textContent = riskTier === 'high' ? '🔴 High Risk' : riskTier === 'medium' ? '🟠 Medium Risk' : '🟢 Low Risk';
    badge.className   = 'info-risk-badge risk-' + riskTier;
    document.getElementById('info-pop').textContent       = mData.population.toLocaleString();
    document.getElementById('info-police').textContent    = mData.police;
    document.getElementById('info-rate').textContent      = mData.ratePerTenThousand.toFixed(1) + ' per 10,000';
    document.getElementById('info-c2021').textContent     = mData.crimes[2021].toLocaleString();
    document.getElementById('info-c2022').textContent     = mData.crimes[2022].toLocaleString();
    document.getElementById('info-c2023').textContent     = mData.crimes[2023].toLocaleString();
    document.getElementById('info-index2023').textContent = mData.indexCrimes[2023].toLocaleString();
    const focusGrid = document.getElementById('info-focus-grid');
    focusGrid.innerHTML = '';
    Object.entries(mData.focusCrimes).forEach(([key, count]) => {
      const item = document.createElement('div');
      item.className = 'focus-item';
      item.innerHTML = `<span class="focus-label">${FOCUS_CRIME_LABELS[key]||key}</span><span class="focus-count">${count}</span>`;
      focusGrid.appendChild(item);
    });
    document.getElementById('info-desc').textContent = mData.description || '';
    panel.classList.remove('hidden');

    // Open XAI panel and populate barangay selector
    _openXaiPanel(mData);
  }

  function _bindInfoPanel() {
    document.getElementById('info-close').addEventListener('click', () => {
      document.getElementById('info-panel').classList.add('hidden');
      document.getElementById('dot-hint').classList.remove('visible');
    });
  }

  // ── CHART TABS ─────────────────────────────────────────────────
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
    const panel = document.getElementById('xai-panel');
    document.getElementById('xai-municipality-name').textContent = mData.name;

    // Populate barangay selector
    const sel      = document.getElementById('xai-barangay-select');
    const barangays = BARANGAY_NAMES[mData.id] || ['Poblacion'];
    sel.innerHTML  = '<option value="">— Select barangay —</option>';
    barangays.forEach(b => {
      const opt    = document.createElement('option');
      opt.value    = b;
      opt.textContent = b;
      sel.appendChild(opt);
    });

    // Hide result sections until a barangay is chosen
    ['xai-gauge-section','xai-explanation-section','xai-factors-section',
     'xai-shap-section','xai-features-section','xai-ranking-section'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    // Pre-compute and show municipality ranking in background
    _renderBrgyRanking(mData.id);

    panel.classList.remove('hidden');

    // Auto-select top barangay
    if (barangays.length) {
      sel.value = barangays[0];
      _runXaiPrediction(mData.id, barangays[0]);
    }
  }

  function _closeXaiPanel() {
    document.getElementById('xai-panel').classList.add('hidden');
  }

  // ── RUN PREDICTION FOR ONE BARANGAY ──────────────────────────
  function _runXaiPrediction(municipalityId, barangayName) {
    const result = XAI.predict(municipalityId, barangayName);
    _renderGauge(result);
    _renderExplanation(result);
    _renderTopFactors(result);
    _renderShapBars(result);
    _renderFeatureTable(result);

    // Show all sections
    ['xai-gauge-section','xai-explanation-section','xai-factors-section',
     'xai-shap-section','xai-features-section','xai-ranking-section'].forEach(id => {
      document.getElementById(id).style.display = '';
    });

    // Highlight active barangay in ranking
    document.querySelectorAll('.xai-brgy-item').forEach(el => {
      el.classList.toggle('active', el.dataset.brgy === barangayName);
    });
  }

  // ── EXPLANATION NARRATIVE ─────────────────────────────────────
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

  // ── GAUGE ────────────────────────────────────────────────────
  function _renderGauge(result) {
    const arc        = document.getElementById('xai-gauge-arc');
    const scoreEl    = document.getElementById('xai-gauge-score');
    const riskBadge  = document.getElementById('xai-risk-badge');
    const trendBadge = document.getElementById('xai-trend-badge');
    const forecastEl = document.getElementById('xai-forecast-period');

    // Arc: total arc length ≈ 251.2 (π × r where r=80, half circle)
    const arcLen    = 251.2;
    const offset    = arcLen - (result.riskScore / 100) * arcLen;
    arc.style.strokeDashoffset = offset;
    arc.style.stroke           = result.riskColour;

    scoreEl.textContent        = result.riskScore;
    scoreEl.style.fill         = result.riskColour;

    // Risk badge styling
    const badgeColours = {
      Critical: { bg:'rgba(215,25,28,.2)', border:'#d7191c', text:'#ff6b6b' },
      High:     { bg:'rgba(244,109,67,.2)', border:'#f46d43', text:'#ffa07a' },
      Moderate: { bg:'rgba(254,224,139,.15)', border:'#fee08b', text:'#ffd700' },
      Low:      { bg:'rgba(26,152,80,.2)', border:'#1a9850', text:'#4ade80' },
    };
    const bc = badgeColours[result.riskLevel] || badgeColours.Low;
    riskBadge.textContent   = result.riskLevel + ' Risk';
    riskBadge.style.cssText = `background:${bc.bg};border:1px solid ${bc.border};color:${bc.text};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;`;

    // Trend badge
    const trendIcon = { Rising:'↑', Stable:'→', Declining:'↓' }[result.forecast.trend] || '→';
    const trendCol  = { Rising:'#e74c3c', Stable:'#f39c12', Declining:'#27ae60' }[result.forecast.trend] || '#8b949e';
    trendBadge.textContent   = `${trendIcon} ${result.forecast.trend}`;
    trendBadge.style.color   = trendCol;
    trendBadge.style.borderColor = trendCol;

    forecastEl.textContent   = result.forecast.nextPeriod;
  }

  // ── TOP FACTORS ──────────────────────────────────────────────
  function _renderTopFactors(result) {
    const ul = document.getElementById('xai-factors-list');
    ul.innerHTML = '';
    result.topFactors.forEach((f, i) => {
      const li   = document.createElement('li');
      const icon = ['🥇','🥈','🥉'][i] || '•';
      li.textContent = `${icon} ${f}`;
      ul.appendChild(li);
    });
  }

  // ── SHAP BARS ────────────────────────────────────────────────
  function _renderShapBars(result) {
    const container = document.getElementById('xai-shap-bars');
    container.innerHTML = '';

    const maxAbs = Math.max(...result.features.map(f => Math.abs(f.shapValue)), 0.001);

    result.features.forEach(feat => {
      const pct    = (Math.abs(feat.shapValue) / maxAbs) * 100;
      const colour = feat.shapValue >= 0 ? '#e74c3c' : '#27ae60';
      const valStr = (feat.shapValue >= 0 ? '+' : '') + feat.shapValue.toFixed(3);

      const row = document.createElement('div');
      row.className = 'xai-shap-row';
      row.innerHTML = `
        <span class="xai-shap-feat-name" title="${feat.desc}">${feat.name}</span>
        <div class="xai-shap-bar-wrap">
          <div class="xai-shap-bar" style="width:${pct.toFixed(1)}%;background:${colour};"></div>
        </div>
        <span class="xai-shap-val" style="color:${colour}">${valStr}</span>`;
      container.appendChild(row);
    });
  }

  // ── FEATURE TABLE ────────────────────────────────────────────
  function _renderFeatureTable(result) {
    const tbody = document.getElementById('xai-feat-tbody');
    tbody.innerHTML = '';
    result.features.forEach(feat => {
      const tr       = document.createElement('tr');
      const rawDisp  = typeof feat.value === 'number'
        ? (Number.isInteger(feat.value) ? feat.value.toLocaleString() : feat.value.toFixed(1))
        : feat.value;
      const shapCol  = feat.shapValue >= 0 ? '#e74c3c' : '#27ae60';
      const shapStr  = (feat.shapValue >= 0 ? '+' : '') + feat.shapValue.toFixed(3);
      tr.innerHTML = `
        <td><span class="feat-desc-tooltip" title="${feat.desc}">${feat.name}</span></td>
        <td>${rawDisp} <small style="color:#4d5b6e">${feat.unit}</small></td>
        <td style="color:#8b949e">${feat.normalised.toFixed(2)}</td>
        <td style="color:${shapCol};font-weight:600">${shapStr}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── BARANGAY RISK RANKING ─────────────────────────────────────
  function _renderBrgyRanking(municipalityId) {
    const container = document.getElementById('xai-brgy-list');
    container.innerHTML = '<div style="color:#4d5b6e;font-size:10px;padding:4px">Computing…</div>';

    // Defer to avoid blocking render
    setTimeout(() => {
      const report = XAI.getMunicipalityReport(municipalityId);
      container.innerHTML = '';

      report.forEach(r => {
        const item = document.createElement('div');
        item.className     = 'xai-brgy-item';
        item.dataset.brgy  = r.barangay;
        item.innerHTML = `
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

})();
