/**
 * GeoCRIME — Map Module v3 (js/map.js)
 *
 * Data-driven: heatmap and anchors only appear after data is uploaded.
 * Shows an empty-state overlay when ALL_INCIDENTS is empty.
 *
 * Layers (bottom → top):
 *  1. Google Maps tile base
 *  2. Leaflet.heat heatmap (uploaded incidents only)
 *  3. Municipality anchor markers (only for municipalities with data)
 *  4. Barangay dot layer (single barangay, shown after picker selection)
 */

const MapModule = (() => {

  // ── STATE ──────────────────────────────────────────────────────
  let _map              = null;
  let _heatLayer        = null;
  let _anchorLayer      = null;
  let _dotLayer         = null;
  let _suppressMapClick = false;

  let _currentYear      = 'all';
  let _currentCrimeType = 'total';
  let _currentMetric    = 'count';

  let _onMunicipalityClick = null;

  // ── HEAT OPTIONS ──────────────────────────────────────────────
  const HEAT_OPTIONS = {
    minOpacity: 0.4,
    maxZoom:    17,
    max:        1.0,
    radius:     30,
    blur:       24,
    gradient: {
      0.00: '#0000ff',
      0.20: '#00bfff',
      0.40: '#00ff00',
      0.60: '#ffff00',
      0.80: '#ff7700',
      1.00: '#ff0000',
    },
  };

  // ── EMPTY STATE ───────────────────────────────────────────────
  function _showEmptyState(visible) {
    const el = document.getElementById('map-empty-state');
    if (el) el.style.display = visible ? 'flex' : 'none';
  }

  // ── COLOUR LOOKUP ─────────────────────────────────────────────
  // Reads from dynamic CRIME_TYPE_META populated by upload.js
  function _dotColour(crimeType) {
    const meta = CRIME_TYPE_META[crimeType];
    return (meta && meta.color) ? meta.color : '#8b949e';
  }

  // ── HEAT LAYER ────────────────────────────────────────────────
  function _refreshHeat() {
    if (_heatLayer) { _map.removeLayer(_heatLayer); _heatLayer = null; }

    if (!ALL_INCIDENTS.length) { _showEmptyState(true); return; }

    _showEmptyState(false);
    const pts = getHeatPoints(_currentYear, _currentCrimeType);
    if (pts.length) _heatLayer = L.heatLayer(pts, HEAT_OPTIONS).addTo(_map);
  }

  // ── ANCHOR MARKERS ────────────────────────────────────────────
  // One pin per municipality that has at least one uploaded incident.
  function _buildAnchors() {
    if (_anchorLayer) { _map.removeLayer(_anchorLayer); _anchorLayer = null; }
    if (!ALL_INCIDENTS.length) return;

    _anchorLayer = L.layerGroup();

    CRIME_DATA.municipalities.forEach(muni => {
      const c     = MUNICIPALITY_CENTROIDS[muni.id];
      if (!c) return;

      const count = getMunicipalityIncidents(muni.id, _currentYear, _currentCrimeType).length;
      if (count === 0) return;   // skip municipalities with no matching data

      // Scale pin size by relative incident count
      const allCounts = CRIME_DATA.municipalities
        .map(m => getMunicipalityIncidents(m.id, _currentYear, _currentCrimeType).length);
      const maxCount  = Math.max(...allCounts, 1);
      const pct       = count / maxCount;
      const r         = Math.round(6 + pct * 10);   // 6–16px radius

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${r*2+6}" height="${r*2+6}" viewBox="0 0 ${r*2+6} ${r*2+6}">
          <circle cx="${r+3}" cy="${r+3}" r="${r+1}"
            fill="#e91e8c" fill-opacity="0.18" stroke="#e91e8c" stroke-width="1.5"/>
          <circle cx="${r+3}" cy="${r+3}" r="${Math.round(r*0.5)}"
            fill="white"/>
          <circle cx="${r+3}" cy="${r+3}" r="${Math.round(r*0.28)}"
            fill="#e91e8c"/>
        </svg>`;

      const icon = L.divIcon({
        html:       svg,
        className:  '',
        iconSize:   [r*2+6, r*2+6],
        iconAnchor: [r+3, r+3],
      });

      const marker = L.marker([c.lat, c.lng], { icon, title: muni.name })
        .bindTooltip(
          `<strong>${muni.name}</strong><br>${count.toLocaleString()} incident${count !== 1 ? 's' : ''}`,
          { className:'geocrime-tooltip', direction:'top', offset:[0,-14] }
        );

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        _suppressMapClick = true;
        _onAnchorClick(muni);
      });

      _anchorLayer.addLayer(marker);
    });

    _anchorLayer.addTo(_map);
  }

  function _onAnchorClick(muni) {
    if (_onMunicipalityClick) _onMunicipalityClick(muni, _getRiskTier(muni.id));
  }

  // ── BARANGAY DOT LAYER ────────────────────────────────────────
  function showBarangayDots(municipalityId, barangayName) {
    _clearDots();

    const incidents = ALL_INCIDENTS.filter(i => {
      if (i.municipalityId !== municipalityId || i.barangay !== barangayName) return false;
      if (_currentYear !== 'all' && i.year !== _currentYear) return false;
      if (_currentCrimeType !== 'total' && i.crimeType !== _currentCrimeType) return false;
      return true;
    });

    if (!incidents.length) return 0;

    _dotLayer = L.layerGroup();

    incidents.forEach(inc => {
      const colour = _dotColour(inc.crimeType);
      const meta   = CRIME_TYPE_META[inc.crimeType] || { icon: '📌', label: inc.crimeLabel || inc.crimeType };

      const marker = L.circleMarker([inc.lat, inc.lng], {
        radius:      8,
        fillColor:   colour,
        fillOpacity: 0.92,
        color:       '#ffffff',
        weight:      2,
      }).bindPopup(_buildPopup(inc, colour, meta), {
        className:    'geocrime-incident-popup',
        maxWidth:     260,
        closeButton:  true,
        autoClose:    false,
        closeOnClick: false,
      });

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        _suppressMapClick = true;
        marker.openPopup();
      });

      _dotLayer.addLayer(marker);
    });

    _dotLayer.addTo(_map);

    const c = MUNICIPALITY_CENTROIDS[municipalityId];
    if (c) _map.panTo([c.lat, c.lng], { animate: true });

    return incidents.length;
  }

  function _buildPopup(inc, colour, meta) {
    const [y, m, d] = inc.date.split('-');
    const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr   = `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
    const rawLine   = (inc.crimeRaw && inc.crimeRaw !== inc.crimeLabel)
      ? `<div class="inc-popup-row">
           <span class="inc-popup-key">Full Description</span>
           <span class="inc-popup-val" style="color:#8b949e;font-size:10px">${inc.crimeRaw}</span>
         </div>` : '';

    return `
      <div class="inc-popup">
        <div class="inc-popup-header" style="border-left:4px solid ${colour}">
          <span class="inc-popup-icon">${meta.icon || '📌'}</span>
          <span class="inc-popup-type">${meta.label || inc.crimeType}</span>
          <span style="font-size:9px;background:#1a3a5c;color:#58a6ff;padding:2px 7px;
                border-radius:10px;margin-left:6px;border:1px solid #3a7bd5">Uploaded</span>
        </div>
        <div class="inc-popup-row">
          <span class="inc-popup-key">Barangay</span>
          <span class="inc-popup-val">${inc.barangay}</span>
        </div>
        <div class="inc-popup-row">
          <span class="inc-popup-key">Municipality</span>
          <span class="inc-popup-val">${inc.municipality}</span>
        </div>
        <div class="inc-popup-row">
          <span class="inc-popup-key">Date</span>
          <span class="inc-popup-val">${dateStr}</span>
        </div>
        ${rawLine}
      </div>`;
  }

  // ── CLEAR DOTS ────────────────────────────────────────────────
  function _clearDots() {
    if (_dotLayer) { _map.removeLayer(_dotLayer); _dotLayer = null; }
  }

  // ── RISK TIER ─────────────────────────────────────────────────
  function _getRiskTier(municipalityId) {
    const counts = CRIME_DATA.municipalities
      .map(m => getMunicipalityIncidents(m.id, _currentYear, _currentCrimeType).length)
      .sort((a, b) => a - b);
    const val = getMunicipalityIncidents(municipalityId, _currentYear, _currentCrimeType).length;
    const pct = counts.length > 1 ? counts.indexOf(val) / (counts.length - 1) : 0;
    if (pct >= 0.67) return 'high';
    if (pct >= 0.34) return 'medium';
    return 'low';
  }
  function getRiskTier(id) { return _getRiskTier(id); }

  // ── LEGEND ────────────────────────────────────────────────────
  function _updateLegend() {
    const total = ALL_INCIDENTS.length;
    const counts = CRIME_DATA.municipalities
      .map(m => getMunicipalityIncidents(m.id, _currentYear, _currentCrimeType).length);
    const minV = counts.length ? Math.min(...counts) : 0;
    const maxV = counts.length ? Math.max(...counts) : 0;

    document.getElementById('legend-min').textContent = minV.toLocaleString();
    document.getElementById('legend-max').textContent = maxV.toLocaleString();
    document.getElementById('legend-mid').textContent = Math.round((minV + maxV) / 2).toLocaleString();

    const yearLabel = _currentYear === 'all' ? 'All years' : String(_currentYear);
    const typeLabel = _currentCrimeType === 'total' ? 'All types'
      : (CRIME_TYPE_META[_currentCrimeType]?.label || _currentCrimeType);
    document.getElementById('legend-note').textContent =
      total ? `${typeLabel} · ${yearLabel} · ${total.toLocaleString()} total incidents`
            : 'No data — upload a CSV to begin';
  }

  // ── PUBLIC API ────────────────────────────────────────────────

  function init(containerId, onClickCb) {
    _onMunicipalityClick = onClickCb;

    _map = L.map(containerId, {
      center: [12.9, 120.7], zoom: 8,
      zoomControl: true, attributionControl: true,
    });

    L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=AIzaSyBKCGXg4JwHkRITTlUAb9dHlsyF7jOJCc8',
      { attribution:'&copy; <a href="https://maps.google.com">Google Maps</a>',
        subdomains:['0','1','2','3'], maxZoom:20, tileSize:256 }
    ).addTo(_map);

    _map.on('click', () => {
      if (_suppressMapClick) { _suppressMapClick = false; return; }
      _clearDots();
    });

    _refreshHeat();
    _buildAnchors();
    _updateLegend();
    _map.fitBounds([[12.1,119.6],[14.1,121.3]], { padding:[20,20] });
  }

  function update(year, crimeType, metric) {
    _currentYear      = year === 'all' ? 'all' : parseInt(year, 10);
    _currentCrimeType = crimeType;
    _currentMetric    = metric;
    _clearDots();
    _refreshHeat();
    _buildAnchors();
    _updateLegend();
  }

  function highlightById(municipalityId) {
    const muni = CRIME_DATA.municipalities.find(m => m.id === municipalityId);
    if (muni) _onAnchorClick(muni);
  }

  return { init, update, highlightById, getRiskTier,
           showBarangayDots, clearDots: _clearDots,
           invalidateSize: () => _map && _map.invalidateSize() };

})();
