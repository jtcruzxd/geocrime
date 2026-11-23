/**
 * GeoCRIME — Map Module v2 (js/map.js)
 *
 * Layers (bottom → top):
 *  1. Google Maps tile base
 *  2. Leaflet.heat heatmap (all filtered incidents)
 *  3. Municipality anchor markers (clickable pins)
 *  4. Incident dot layer (shown when a municipality is clicked)
 */

const MapModule = (() => {

  // ── STATE ──────────────────────────────────────────────────────
  let _map            = null;
  let _heatLayer      = null;
  let _anchorLayer    = null;
  let _dotLayer       = null;
  let _activeMuniId   = null;
  let _suppressMapClick = false;   // flag to block map click after marker click

  let _currentYear      = 'all';
  let _currentCrimeType = 'total';
  let _currentMetric    = 'count';

  let _onMunicipalityClick = null;

  // ── CRIME TYPE COLOURS (dot layer) ────────────────────────────
  const TYPE_COLOUR = {
    theft:          '#f39c12',
    rape:           '#e74c3c',
    physicalInjury: '#e67e22',
    robbery:        '#c0392b',
    murder:         '#8e1c1c',
    homicide:       '#922b21',
    carnapping:     '#2980b9',
    nonIndex:       '#7f8c8d',
  };

  // ── HEAT OPTIONS ──────────────────────────────────────────────
  const HEAT_OPTIONS = {
    minOpacity:  0.35,
    maxZoom:     16,
    max:         1.0,
    radius:      28,
    blur:        22,
    gradient: {
      0.00: '#0000ff',   // blue  — very low
      0.20: '#00bfff',   // cyan
      0.40: '#00ff00',   // green
      0.60: '#ffff00',   // yellow
      0.80: '#ff7700',   // orange
      1.00: '#ff0000',   // red   — very high
    },
  };

  // ── BUILD / REFRESH HEAT LAYER ─────────────────────────────────
  function _refreshHeat() {
    const pts = getHeatPoints(_currentYear, _currentCrimeType);

    if (_heatLayer) {
      _map.removeLayer(_heatLayer);
      _heatLayer = null;
    }

    if (pts.length === 0) return;

    _heatLayer = L.heatLayer(pts, HEAT_OPTIONS).addTo(_map);
  }

  // ── MUNICIPALITY ANCHOR MARKERS ───────────────────────────────
  // One pink/white dot per municipality — matches the reference screenshot style.
  function _buildAnchors() {
    if (_anchorLayer) {
      _map.removeLayer(_anchorLayer);
      _anchorLayer = null;
    }

    _anchorLayer = L.layerGroup();

    CRIME_DATA.municipalities.forEach(muni => {
      const c = MUNICIPALITY_CENTROIDS[muni.id];
      if (!c) return;

      // Outer ring + inner dot  (SVG circle icon)
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="9"  fill="#e91e8c" fill-opacity="0.25" stroke="#e91e8c" stroke-width="1.5"/>
          <circle cx="11" cy="11" r="4"  fill="white"/>
          <circle cx="11" cy="11" r="2"  fill="#e91e8c"/>
        </svg>`;

      const icon = L.divIcon({
        html:        svg,
        className:   '',
        iconSize:    [22, 22],
        iconAnchor:  [11, 11],
      });

      const count = getMunicipalityIncidents(muni.id, _currentYear, _currentCrimeType).length;

      const marker = L.marker([c.lat, c.lng], { icon, title: muni.name })
        .bindTooltip(`<strong>${muni.name}</strong><br>${count} incidents`, {
          className:  'geocrime-tooltip',
          direction:  'top',
          offset:     [0, -12],
        });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        _suppressMapClick = true;
        _onAnchorClick(muni);
      });

      _anchorLayer.addLayer(marker);
    });

    _anchorLayer.addTo(_map);
  }

  // ── ANCHOR CLICK → SHOW INCIDENT DOTS ─────────────────────────
  function _onAnchorClick(muni) {
    _activeMuniId = muni.id;

    // Clear previous dot layer
    _clearDots();

    const incidents = getMunicipalityIncidents(muni.id, _currentYear, _currentCrimeType);

    _dotLayer = L.layerGroup();

    incidents.forEach(inc => {
      const colour = TYPE_COLOUR[inc.crimeType] || '#aaa';
      const meta   = CRIME_TYPE_META[inc.crimeType] || { icon: '•', label: inc.crimeType };

      // Use CircleMarker with autoClose:false so popup stays open
      const marker = L.circleMarker([inc.lat, inc.lng], {
        radius:      7,
        fillColor:   colour,
        fillOpacity: 0.90,
        color:       'white',
        weight:      2,
        dashArray:   '4 2',
      }).bindPopup(_buildIncidentPopup(inc), {
        className:    'geocrime-incident-popup',
        maxWidth:     240,
        closeButton:  true,
        autoClose:    false,   // keep popup open when map is clicked
        closeOnClick: false,   // do not close on map click
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        _suppressMapClick = true;   // block map click handler
        marker.openPopup();
      });

      _dotLayer.addLayer(marker);
    });

    _dotLayer.addTo(_map);

    // Pan to municipality centre
    const c = MUNICIPALITY_CENTROIDS[muni.id];
    if (c) _map.panTo([c.lat, c.lng], { animate: true });

    // Fire external callback (info panel in app.js)
    if (_onMunicipalityClick) {
      _onMunicipalityClick(muni, _getRiskTier(muni.id));
    }
  }

  // ── INCIDENT POPUP HTML ───────────────────────────────────────
  function _buildIncidentPopup(inc) {
    const meta   = CRIME_TYPE_META[inc.crimeType] || { icon: '•', label: inc.crimeType };
    const colour = TYPE_COLOUR[inc.crimeType] || '#aaa';

    // Format date nicely
    const [y, m, d] = inc.date.split('-');
    const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr   = `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;

    return `
      <div class="inc-popup">
        <div class="inc-popup-header" style="border-left:4px solid ${colour}">
          <span class="inc-popup-icon">${meta.icon}</span>
          <span class="inc-popup-type">${meta.label}</span>
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
        <div class="inc-popup-row">
          <span class="inc-popup-key">Year</span>
          <span class="inc-popup-val">${inc.year}</span>
        </div>
      </div>`;
  }

  // ── CLEAR DOTS ────────────────────────────────────────────────
  function _clearDots() {
    if (_dotLayer) {
      _map.removeLayer(_dotLayer);
      _dotLayer     = null;
      _activeMuniId = null;
    }
  }

  // ── RISK TIER (for info panel badge) ─────────────────────────
  function _getRiskTier(municipalityId) {
    const counts = CRIME_DATA.municipalities.map(m =>
      getMunicipalityIncidents(m.id, _currentYear, _currentCrimeType).length
    ).sort((a, b) => a - b);

    const val = getMunicipalityIncidents(municipalityId, _currentYear, _currentCrimeType).length;
    const idx = counts.indexOf(val);
    const pct = idx / (counts.length - 1);
    if (pct >= 0.67) return 'high';
    if (pct >= 0.34) return 'medium';
    return 'low';
  }

  // keep public for app.js
  function getRiskTier(municipalityId) {
    return _getRiskTier(municipalityId);
  }

  // ── LEGEND TICKS ─────────────────────────────────────────────
  function _updateLegend() {
    const counts  = CRIME_DATA.municipalities.map(m =>
      getMunicipalityIncidents(m.id, _currentYear, _currentCrimeType).length
    );
    const minV = Math.min(...counts);
    const maxV = Math.max(...counts);
    const midV = Math.round((minV + maxV) / 2);

    document.getElementById('legend-min').textContent = minV.toLocaleString();
    document.getElementById('legend-max').textContent = maxV.toLocaleString();
    document.getElementById('legend-mid').textContent = midV.toLocaleString();

    const yearLabel = _currentYear === 'all' ? 'All years' : String(_currentYear);
    const typeLabel = { total:'Total volume', index:'Index crimes', nonIndex:'Non-index crimes' }[_currentCrimeType];
    document.getElementById('legend-note').textContent =
      `${typeLabel} · ${yearLabel} · incident density`;
  }

  // ── PUBLIC API ────────────────────────────────────────────────

  function init(containerId, onClickCb) {
    _onMunicipalityClick = onClickCb;

    _map = L.map(containerId, {
      center:           [12.9, 120.7],
      zoom:             8,
      zoomControl:      true,
      attributionControl: true,
    });

    // Google Maps roadmap tiles
    L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=AIzaSyBKCGXg4JwHkRITTlUAb9dHlsyF7jOJCc8',
      {
        attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
        subdomains:  ['0','1','2','3'],
        maxZoom:     20,
        tileSize:    256,
      }
    ).addTo(_map);

    // Click anywhere on bare map → clear dots
    // Uses flag to ignore clicks that originated from a marker
    _map.on('click', () => {
      if (_suppressMapClick) {
        _suppressMapClick = false;   // consume the flag, don't clear
        return;
      }
      _clearDots();
    });

    _refreshHeat();
    _buildAnchors();
    _updateLegend();

    // Fit to Occidental Mindoro extent
    _map.fitBounds([[12.1, 119.6],[14.1, 121.3]], { padding: [20, 20] });
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

  return { init, update, highlightById, getRiskTier };

})();
