/**
 * GeoCRIME — Charts Module v2 (js/charts.js)
 *
 * Three Chart.js charts in the bottom panel:
 *   bar   — municipality crime count comparison (filter-aware)
 *   trend — provincial annual trend lines 2021–2023
 *   focus — focus crime type horizontal bar, H1 2024
 */

const ChartsModule = (() => {

  // ── SHARED DEFAULTS ───────────────────────────────────────────
  Chart.defaults.color                            = '#8b949e';
  Chart.defaults.borderColor                      = '#2a3447';
  Chart.defaults.font.family                      = "'Segoe UI', system-ui, sans-serif";
  Chart.defaults.font.size                        = 11;
  Chart.defaults.plugins.legend.labels.boxWidth   = 10;
  Chart.defaults.plugins.legend.labels.boxHeight  = 10;
  Chart.defaults.plugins.legend.labels.padding    = 16;
  Chart.defaults.plugins.tooltip.backgroundColor  = 'rgba(16,20,30,0.97)';
  Chart.defaults.plugins.tooltip.borderColor      = '#334155';
  Chart.defaults.plugins.tooltip.borderWidth      = 1;
  Chart.defaults.plugins.tooltip.padding          = { x:12, y:8 };
  Chart.defaults.plugins.tooltip.titleColor       = '#58a6ff';
  Chart.defaults.plugins.tooltip.bodyColor        = '#e6edf3';
  Chart.defaults.plugins.tooltip.cornerRadius     = 8;

  // ── HEAT-RANK COLOURS for bar chart ──────────────────────────
  // Assigned by rank position (0=highest) so gradient always maps correctly
  const RANK_COLOURS = [
    '#d7191c', '#d7191c',   // rank 0–1  → deep red
    '#f46d43',              // rank 2    → orange-red
    '#f46d43',              // rank 3
    '#fdae61',              // rank 4    → orange
    '#fee08b',              // rank 5    → yellow
    '#a6d96a',              // rank 6    → yellow-green
    '#66bd63',              // rank 7    → green
    '#1a9850',              // rank 8    → dark green
    '#1a9850',              // rank 9
    '#1a9850',              // rank 10
  ];

  function _rankColours(counts) {
    const indexed = counts.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const result  = new Array(counts.length);
    indexed.forEach(({ i }, rank) => {
      result[i] = RANK_COLOURS[Math.min(rank, RANK_COLOURS.length - 1)];
    });
    return result;
  }

  function _crimeTypeLabel(ct) {
    return { total:'Total Crime Volume', index:'Index Crimes', nonIndex:'Non-Index Crimes' }[ct] || 'Crimes';
  }

  // ── CHART 1: MUNICIPALITY BAR ─────────────────────────────────
  let _barChart = null;

  function _buildBarChart(year, crimeType) {
    const names   = CRIME_DATA.municipalities.map(m => m.name);
    const counts  = CRIME_DATA.municipalities.map(m => getCrimeCount(m.id, year, crimeType));
    const colours = _rankColours(counts);
    const max     = Math.max(...counts);

    const ctx = document.getElementById('chart-bar').getContext('2d');
    if (_barChart) { _barChart.destroy(); _barChart = null; }

    _barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label:            _crimeTypeLabel(crimeType),
          data:             counts,
          backgroundColor:  colours.map(c => c + 'cc'),
          borderColor:      colours,
          borderWidth:      1.5,
          borderRadius:     4,
          borderSkipped:    false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title:  (items) => items[0].label,
              label:  (item)  => `  ${_crimeTypeLabel(crimeType)}: ${item.raw.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 40,
              minRotation: 30,
              font:  { size: 10 },
              color: '#8b949e',
              padding: 2,
            },
            grid:  { color: 'rgba(42,52,71,0.6)', drawTicks: false },
            border: { color: '#2a3447' },
          },
          y: {
            beginAtZero: true,
            max: Math.ceil(max * 1.12),
            ticks: {
              font:     { size: 10 },
              color:    '#8b949e',
              maxTicksLimit: 6,
              callback: (v) => v.toLocaleString(),
            },
            grid:  { color: 'rgba(42,52,71,0.6)' },
            border: { dash: [3, 3], color: 'transparent' },
            title: {
              display: true,
              text:    _crimeTypeLabel(crimeType),
              color:   '#4d5b6e',
              font:    { size: 10 },
              padding: { bottom: 4 },
            },
          },
        },
      },
    });
  }

  // ── CHART 2: PROVINCIAL TREND ─────────────────────────────────
  let _trendChart = null;

  function _buildTrendChart() {
    const years = ['2021', '2022', '2023'];
    const ctx   = document.getElementById('chart-trend').getContext('2d');
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

    const DS_TOTAL = {
      label:               'Total Crime Volume',
      data:                getProvinceTrend('total'),
      borderColor:         '#3a7bd5',
      backgroundColor:     'rgba(58,123,213,0.10)',
      fill:                true,
      tension:             0.4,
      pointRadius:         6,
      pointHoverRadius:    8,
      pointBackgroundColor:'#3a7bd5',
      pointBorderColor:    '#fff',
      pointBorderWidth:    2,
      borderWidth:         2.5,
    };
    const DS_INDEX = {
      label:               'Index Crimes',
      data:                getProvinceTrend('index'),
      borderColor:         '#e74c3c',
      backgroundColor:     'transparent',
      fill:                false,
      tension:             0.4,
      pointRadius:         6,
      pointHoverRadius:    8,
      pointBackgroundColor:'#e74c3c',
      pointBorderColor:    '#fff',
      pointBorderWidth:    2,
      borderWidth:         2,
      borderDash:          [6, 3],
    };
    const DS_NONINDEX = {
      label:               'Non-Index Crimes',
      data:                getProvinceTrend('nonIndex'),
      borderColor:         '#27ae60',
      backgroundColor:     'transparent',
      fill:                false,
      tension:             0.4,
      pointRadius:         6,
      pointHoverRadius:    8,
      pointBackgroundColor:'#27ae60',
      pointBorderColor:    '#fff',
      pointBorderWidth:    2,
      borderWidth:         2,
      borderDash:          [3, 3],
    };

    _trendChart = new Chart(ctx, {
      type: 'line',
      data: { labels: years, datasets: [DS_TOTAL, DS_INDEX, DS_NONINDEX] },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 20, bottom: 4, left: 4 } },
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display:  true,
            position: 'top',
            align:    'end',
            labels:   { font: { size: 11 }, color: '#8b949e' },
          },
          tooltip: {
            callbacks: {
              label: (item) => `  ${item.dataset.label}: ${item.raw.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            ticks:  { color: '#8b949e', font: { size: 11 }, padding: 6 },
            grid:   { color: 'rgba(42,52,71,0.6)' },
            border: { color: '#2a3447' },
          },
          y: {
            beginAtZero: false,
            ticks: {
              color:         '#8b949e',
              font:          { size: 10 },
              maxTicksLimit: 6,
              callback:      (v) => v.toLocaleString(),
            },
            grid:   { color: 'rgba(42,52,71,0.6)' },
            border: { dash: [3, 3], color: 'transparent' },
            title: {
              display: true,
              text:    'Crime Volume',
              color:   '#4d5b6e',
              font:    { size: 10 },
              padding: { bottom: 4 },
            },
          },
        },
      },
    });
  }

  // ── CHART 3: FOCUS CRIMES H1 2024 ────────────────────────────
  // Source: PIA (2024) — Jan 1 – Jun 15, 2024
  const FOCUS_H1 = [
    { label: 'Theft',           val: 17, colour: '#f39c12' },
    { label: 'Rape',            val: 15, colour: '#e74c3c' },
    { label: 'Physical Injury', val:  7, colour: '#e67e22' },
    { label: 'Carnapping',      val:  7, colour: '#2980b9' },
    { label: 'Murder',          val:  5, colour: '#8e1c1c' },
    { label: 'Robbery',         val:  5, colour: '#c0392b' },
    { label: 'Homicide',        val:  4, colour: '#922b21' },
  ].sort((a, b) => b.val - a.val);

  let _focusChart = null;

  function _buildFocusChart() {
    const ctx = document.getElementById('chart-focus').getContext('2d');
    if (_focusChart) { _focusChart.destroy(); _focusChart = null; }

    _focusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: FOCUS_H1.map(x => x.label),
        datasets: [{
          label:           'Cases (H1 2024)',
          data:            FOCUS_H1.map(x => x.val),
          backgroundColor: FOCUS_H1.map(x => x.colour + 'cc'),
          borderColor:     FOCUS_H1.map(x => x.colour),
          borderWidth:     1.5,
          borderRadius:    4,
        }],
      },
      options: {
        indexAxis:           'y',
        responsive:          true,
        maintainAspectRatio: false,
        layout: { padding: { top: 4, right: 32, bottom: 4, left: 4 } },
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text:    'Focus Crimes · Occidental Mindoro · H1 2024  (Source: PIA 2024)',
            color:   '#4d5b6e',
            font:    { size: 10 },
            padding: { top: 4, bottom: 8 },
            align:   'start',
          },
          tooltip: {
            callbacks: {
              label:       (item) => `  Cases: ${item.raw}`,
              afterLabel:  ()     => '  Jan 1 – Jun 15, 2024',
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            beginAtZero:  true,
            max:          20,
            ticks: {
              stepSize:  2,
              color:     '#8b949e',
              font:      { size: 10 },
            },
            grid:   { color: 'rgba(42,52,71,0.6)' },
            border: { dash: [3, 3], color: 'transparent' },
          },
          y: {
            ticks: {
              color:  '#e6edf3',
              font:   { size: 11 },
              padding: 6,
            },
            grid:   { color: 'rgba(42,52,71,0.4)', drawTicks: false },
            border: { color: '#2a3447' },
          },
        },
      },
    });
  }

  // ── PUBLIC API ────────────────────────────────────────────────

  function init(year, crimeType) {
    _buildBarChart(year, crimeType);
    _buildTrendChart();
    _buildFocusChart();
  }

  function updateBar(year, crimeType) {
    _buildBarChart(year, crimeType);
  }

  function showTab(tabName) {
    // Toggle chart-view wrappers (not raw canvases)
    document.querySelectorAll('.chart-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('chart-view-' + tabName);
    if (target) target.classList.add('active');

    // Tell Chart.js to resize now that the wrapper is visible
    const chartMap = { bar: _barChart, trend: _trendChart, focus: _focusChart };
    if (chartMap[tabName]) {
      requestAnimationFrame(() => chartMap[tabName].resize());
    }
  }

  return { init, updateBar, showTab };

})();
