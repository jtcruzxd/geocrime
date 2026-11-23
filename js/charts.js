/**
 * GeoCRIME — Charts Module v3 (js/charts.js)
 *
 * All charts are now fully data-driven from ALL_INCIDENTS.
 * No hardcoded numbers anywhere.
 *
 *  bar    — municipality incident count comparison (filter-aware)
 *  trend  — year-over-year trend lines from uploaded data
 *  focus  — uploaded crime types by frequency (replaces hardcoded H1 2024)
 */

const ChartsModule = (() => {

  // ── DEFAULTS ──────────────────────────────────────────────────
  Chart.defaults.color                           = '#8b949e';
  Chart.defaults.borderColor                     = '#2a3447';
  Chart.defaults.font.family                     = "'Segoe UI', system-ui, sans-serif";
  Chart.defaults.font.size                       = 11;
  Chart.defaults.plugins.legend.labels.boxWidth  = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.padding   = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(16,20,30,0.97)';
  Chart.defaults.plugins.tooltip.borderColor     = '#334155';
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = { x:12, y:8 };
  Chart.defaults.plugins.tooltip.titleColor      = '#58a6ff';
  Chart.defaults.plugins.tooltip.bodyColor       = '#e6edf3';
  Chart.defaults.plugins.tooltip.cornerRadius    = 8;

  const RANK_COLS = [
    '#d7191c','#d7191c','#f46d43','#f46d43','#fdae61',
    '#fee08b','#a6d96a','#66bd63','#1a9850','#1a9850','#1a9850',
  ];
  function _rankColours(counts) {
    const indexed = counts.map((v,i) => ({v,i})).sort((a,b) => b.v-a.v);
    const out = new Array(counts.length);
    indexed.forEach(({i},rank) => { out[i] = RANK_COLS[Math.min(rank, RANK_COLS.length-1)]; });
    return out;
  }

  const EMPTY_MSG = 'Upload a CSV to see data here.';

  // ── SHARED AXIS CONFIG ────────────────────────────────────────
  const AXIS_X = {
    ticks:  { maxRotation:40, minRotation:30, font:{size:10}, color:'#8b949e', padding:2 },
    grid:   { color:'rgba(42,52,71,0.6)', drawTicks:false },
    border: { color:'#2a3447' },
  };
  const AXIS_Y = {
    beginAtZero: true,
    ticks:  { font:{size:10}, color:'#8b949e', maxTicksLimit:6, callback:v=>v.toLocaleString() },
    grid:   { color:'rgba(42,52,71,0.6)' },
    border: { dash:[3,3], color:'transparent' },
  };

  // ── CHART 1: MUNICIPALITY BAR ─────────────────────────────────
  let _barChart = null;

  function _buildBarChart(year, crimeType) {
    const ctx = document.getElementById('chart-bar').getContext('2d');
    if (_barChart) { _barChart.destroy(); _barChart = null; }

    if (!ALL_INCIDENTS.length) {
      _barChart = _buildEmptyChart(ctx, EMPTY_MSG); return;
    }

    const names  = CRIME_DATA.municipalities.map(m => m.name);
    const counts = CRIME_DATA.municipalities.map(m => getCrimeCount(m.id, year, crimeType));
    const colours = _rankColours(counts);
    const max     = Math.max(...counts, 1);

    const typeLabel = crimeType === 'total' ? 'All Crime Types'
      : (CRIME_TYPE_META[crimeType]?.label || crimeType);

    _barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          label:            typeLabel,
          data:             counts,
          backgroundColor:  colours.map(c => c + 'cc'),
          borderColor:      colours,
          borderWidth:      1.5,
          borderRadius:     4,
          borderSkipped:    false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding:{top:8,right:12,bottom:4,left:4} },
        animation: { duration:350 },
        plugins: {
          legend: { display:false },
          tooltip: { callbacks: {
            title:  items => items[0].label,
            label:  item  => `  ${typeLabel}: ${item.raw.toLocaleString()}`,
          }},
        },
        scales: { x:{...AXIS_X}, y:{...AXIS_Y, max: Math.ceil(max*1.12),
          title:{ display:true, text:typeLabel, color:'#4d5b6e', font:{size:10}, padding:{bottom:4} }
        }},
      },
    });
  }

  // ── CHART 2: YEAR-OVER-YEAR TREND ────────────────────────────
  let _trendChart = null;

  function _buildTrendChart() {
    const ctx = document.getElementById('chart-trend').getContext('2d');
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

    const years = getDataYears();

    if (!years.length) {
      _trendChart = _buildEmptyChart(ctx, EMPTY_MSG); return;
    }

    // Build one dataset per municipality that has data
    const muniSeries = CRIME_DATA.municipalities
      .map(m => ({
        name:   m.name,
        counts: years.map(y => getCrimeCount(m.id, y, 'total')),
      }))
      .filter(s => s.counts.some(c => c > 0));

    // If too many series, aggregate into province total
    let datasets;
    if (muniSeries.length <= 4) {
      datasets = muniSeries.map((s, i) => ({
        label:               s.name,
        data:                s.counts,
        borderColor:         RANK_COLS[i * 2] || '#3a7bd5',
        backgroundColor:     'transparent',
        fill:                false,
        tension:             0.4,
        pointRadius:         5,
        pointHoverRadius:    7,
        pointBackgroundColor: RANK_COLS[i * 2] || '#3a7bd5',
        pointBorderColor:    '#fff',
        pointBorderWidth:    2,
        borderWidth:         2,
      }));
    } else {
      // Aggregate to province level + top-3 municipalities
      const provinceTotals = years.map(y =>
        CRIME_DATA.municipalities.reduce((s, m) => s + getCrimeCount(m.id, y, 'total'), 0)
      );
      const top3 = [...muniSeries].sort((a,b) =>
        b.counts.reduce((s,c)=>s+c,0) - a.counts.reduce((s,c)=>s+c,0)
      ).slice(0, 3);

      datasets = [
        {
          label:'Province Total', data:provinceTotals,
          borderColor:'#3a7bd5', backgroundColor:'rgba(58,123,213,0.08)',
          fill:true, tension:0.4, pointRadius:5, pointHoverRadius:7,
          pointBackgroundColor:'#3a7bd5', pointBorderColor:'#fff',
          pointBorderWidth:2, borderWidth:2.5,
        },
        ...top3.map((s,i) => ({
          label:s.name, data:s.counts,
          borderColor: RANK_COLS[i] || '#f46d43',
          backgroundColor:'transparent', fill:false, tension:0.4,
          pointRadius:4, pointHoverRadius:6,
          pointBackgroundColor: RANK_COLS[i] || '#f46d43',
          pointBorderColor:'#fff', pointBorderWidth:1.5,
          borderWidth:1.5, borderDash:[5,3],
        })),
      ];
    }

    _trendChart = new Chart(ctx, {
      type: 'line',
      data: { labels: years.map(String), datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        layout:{ padding:{top:8,right:20,bottom:4,left:4} },
        animation:{duration:350},
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:true, position:'top', align:'end',
                   labels:{ font:{size:10}, color:'#8b949e' } },
          tooltip:{ callbacks:{
            label: item => `  ${item.dataset.label}: ${item.raw.toLocaleString()}`,
          }},
        },
        scales:{
          x:{ ...AXIS_X, ticks:{...AXIS_X.ticks, maxRotation:0, minRotation:0} },
          y:{ ...AXIS_Y, beginAtZero:false,
              title:{ display:true, text:'Incidents', color:'#4d5b6e', font:{size:10}, padding:{bottom:4} }
          },
        },
      },
    });
  }

  // ── CHART 3: CRIME TYPE BREAKDOWN (dynamic) ──────────────────
  let _focusChart = null;

  function _buildFocusChart() {
    const ctx = document.getElementById('chart-focus').getContext('2d');
    if (_focusChart) { _focusChart.destroy(); _focusChart = null; }

    const types = getActiveCrimeTypes();   // from incidents.js — sorted by count desc

    if (!types.length) {
      _focusChart = _buildEmptyChart(ctx, EMPTY_MSG); return;
    }

    const labels  = types.map(t => t.label || t.key);
    const counts  = types.map(t => t.count);
    const colours = types.map(t => t.color || '#888');

    _focusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets:[{
          label:           'Incidents',
          data:            counts,
          backgroundColor: colours.map(c => c + 'cc'),
          borderColor:     colours,
          borderWidth:     1.5,
          borderRadius:    4,
        }],
      },
      options:{
        indexAxis: 'y',
        responsive:true, maintainAspectRatio:false,
        layout:{ padding:{top:4, right:36, bottom:4, left:4} },
        animation:{duration:350},
        plugins:{
          legend:{ display:false },
          title:{
            display:  true,
            text:     `Crime Types by Frequency — ${ALL_INCIDENTS.length.toLocaleString()} total incidents`,
            color:    '#4d5b6e',
            font:     { size:10 },
            padding:  { top:4, bottom:8 },
            align:    'start',
          },
          tooltip:{ callbacks:{
            label: item => `  Incidents: ${item.raw.toLocaleString()}`,
            afterLabel: item => {
              const t = types[item.dataIndex];
              return t ? `  Key: ${t.key}` : '';
            },
          }},
        },
        scales:{
          x:{
            beginAtZero:true,
            ticks:{ color:'#8b949e', font:{size:10} },
            grid:{ color:'rgba(42,52,71,0.6)' },
            border:{ dash:[3,3], color:'transparent' },
          },
          y:{
            ticks:{ color:'#e6edf3', font:{size:11}, padding:6 },
            grid:{ color:'rgba(42,52,71,0.4)', drawTicks:false },
            border:{ color:'#2a3447' },
          },
        },
      },
    });
  }

  // ── EMPTY CHART PLACEHOLDER ───────────────────────────────────
  function _buildEmptyChart(ctx, message) {
    return new Chart(ctx, {
      type: 'bar',
      data: { labels:[], datasets:[{ data:[] }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ display:false },
          title:{ display:true, text:message, color:'#4d5b6e', font:{size:12}, padding:40 },
        },
        scales:{
          x:{ display:false },
          y:{ display:false },
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

  /** Rebuild ALL charts from scratch — called after import or clear. */
  function refreshAll() {
    _buildBarChart('all', 'total');
    _buildTrendChart();
    _buildFocusChart();
  }

  function showTab(tabName) {
    document.querySelectorAll('.chart-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('chart-view-' + tabName);
    if (target) target.classList.add('active');
    const chartMap = { bar:_barChart, trend:_trendChart, focus:_focusChart };
    if (chartMap[tabName]) requestAnimationFrame(() => chartMap[tabName].resize());
  }

  return { init, updateBar, refreshAll, showTab };

})();
