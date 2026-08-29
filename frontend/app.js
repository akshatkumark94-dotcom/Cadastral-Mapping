/**
 * Cadastral AI Mapper — Frontend Leaflet & Multi-City API Controller
 * Smart India Hackathon 2026
 * Supports Hierarchical Region (City) -> Mini-Segment (Sub-area) -> Parcels
 */

const API_BASE = "http://localhost:8000/api";

// Application State
let map;
let parcelsLayer;
let conflictsLayer;
let roadsLayer;
let allParcelsData = null;
let allConflictsData = null;
let selectedParcelId = null;
let activeFilter = "all";
let searchTerm = "";

// Hierarchical Region State
let selectedCity = "delhi";
let selectedSegment = "karol_bagh";
let regionsCache = [];

// Initialize Application on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupEventListeners();
  loadRegionsHierarchy();
});

/**
 * Initializes Leaflet map and base tile layers.
 */
function initMap() {
  map = L.map("map-container", {
    center: [28.6400, 77.2000],
    zoom: 17,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Basemap Providers
  const esriSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri &mdash; High-Res Satellite Imagery",
      maxZoom: 19
    }
  );

  const cartoDark = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "&copy; <a href='https://carto.com/'>CARTO</a>",
      maxZoom: 19
    }
  );

  const osmStandard = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }
  );

  esriSatellite.addTo(map);

  const baseMaps = {
    "Satellite Imagery": esriSatellite,
    "Carto Dark GIS": cartoDark,
    "OpenStreetMap": osmStandard
  };

  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  // Initialize Layer Groups
  parcelsLayer = L.geoJSON(null, {
    style: styleParcelFeature,
    onEachFeature: onEachParcelFeature
  }).addTo(map);

  conflictsLayer = L.geoJSON(null, {
    style: styleConflictFeature,
    onEachFeature: onEachConflictFeature
  }).addTo(map);

  roadsLayer = L.geoJSON(null, {
    style: {
      color: "#94a3b8",
      weight: 3,
      opacity: 0.7,
      dashArray: "4, 4"
    }
  }).addTo(map);
}

/**
 * Loads list of all configured city regions from backend and populates the City selector.
 */
async function loadRegionsHierarchy() {
  try {
    const res = await fetch(`${API_BASE}/regions`).then(r => r.json());
    regionsCache = res.regions || [];

    const citySelect = document.getElementById("city-select");
    citySelect.innerHTML = "";

    regionsCache.forEach(reg => {
      const opt = document.createElement("option");
      opt.value = reg.key;
      opt.textContent = `${reg.name} (${reg.segment_count} Segments)`;
      citySelect.appendChild(opt);
    });

    if (regionsCache.length > 0) {
      selectedCity = regionsCache[0].key;
      citySelect.value = selectedCity;
      await updateSegmentDropdown(selectedCity);
    }
  } catch (err) {
    console.warn("Could not fetch /api/regions from backend. Using static fallback.", err);
    setupStaticRegionsFallback();
  }
}

/**
 * Updates the Mini-Segment dropdown options based on the chosen city region.
 */
async function updateSegmentDropdown(cityKey) {
  try {
    const res = await fetch(`${API_BASE}/regions/${cityKey}/segments`).then(r => r.json());
    const segments = res.segments || [];

    const segmentSelect = document.getElementById("segment-select");
    segmentSelect.innerHTML = "";

    segments.forEach(seg => {
      const opt = document.createElement("option");
      opt.value = seg.key;
      opt.textContent = seg.name;
      segmentSelect.appendChild(opt);
    });

    if (segments.length > 0) {
      selectedSegment = segments[0].key;
      segmentSelect.value = selectedSegment;
    }

    await loadDataForCurrentSegment();
  } catch (err) {
    console.warn("Could not fetch segments for city", cityKey, err);
  }
}

/**
 * Styling logic for Cadastral Parcel Polygons.
 */
function styleParcelFeature(feature) {
  const status = feature.properties.status || "pending";
  const isSelected = feature.id === selectedParcelId;

  let color = "#f59e0b"; // Pending default (amber)
  let fillColor = "#f59e0b";

  if (status === "approved") {
    color = "#10b981";
    fillColor = "#10b981";
  } else if (status === "flagged") {
    color = "#ef4444";
    fillColor = "#ef4444";
  } else if (status === "rejected") {
    color = "#6b7280";
    fillColor = "#4b5563";
  }

  return {
    color: isSelected ? "#06b6d4" : color,
    weight: isSelected ? 3 : 2,
    opacity: 0.9,
    fillColor: fillColor,
    fillOpacity: isSelected ? 0.45 : 0.25,
    dashArray: status === "pending" ? "3, 3" : null
  };
}

/**
 * Styling logic for Overlay Conflict Polygons.
 */
function styleConflictFeature(feature) {
  return {
    color: "#ff0055",
    weight: 2,
    opacity: 1.0,
    fillColor: "#ff0055",
    fillOpacity: 0.5,
    dashArray: "4, 4"
  };
}

/**
 * Event binding on parcel features.
 */
function onEachParcelFeature(feature, layer) {
  layer.on({
    click: (e) => {
      L.DomEvent.stopPropagation(e);
      selectParcel(feature);
    },
    mouseover: () => {
      layer.setStyle({ fillOpacity: 0.5 });
    },
    mouseout: () => {
      if (feature.id !== selectedParcelId) {
        layer.setStyle({ fillOpacity: 0.25 });
      }
    }
  });

  const props = feature.properties;
  layer.bindTooltip(
    `<strong>${props.segment_name || props.segment || "Segment"}</strong><br><strong>Survey No:</strong> ${props.survey_no}<br><strong>ULPIN:</strong> ${props.ulpin}<br><strong>Area:</strong> ${props.area_sqm} m²`,
    { sticky: true, className: "custom-leaflet-tooltip" }
  );
}

/**
 * Event binding on conflict overlay features.
 */
function onEachConflictFeature(feature, layer) {
  const props = feature.properties;
  layer.bindPopup(`
    <div style="color: #111;">
      <h4 style="color: #ef4444; margin-bottom: 4px;">⚠️ ${props.conflict_type || "OVERLAP CONFLICT"}</h4>
      <p style="font-size: 11px; margin-bottom: 4px;">${props.description}</p>
      <span style="font-size: 10px; font-weight: bold; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px;">
        Overlap Area: ${props.overlap_area_sqm} m²
      </span>
    </div>
  `);
}

/**
 * Loads parcels, conflicts, and KPI stats scoped to the currently selected City & Mini-Segment.
 */
async function loadDataForCurrentSegment() {
  try {
    const urlParams = `region=${encodeURIComponent(selectedCity)}&segment=${encodeURIComponent(selectedSegment)}`;

    const [parcelsRes, conflictsRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/parcels?${urlParams}`).then(r => r.json()),
      fetch(`${API_BASE}/conflicts?${urlParams}`).then(r => r.json()),
      fetch(`${API_BASE}/stats?${urlParams}`).then(r => r.json())
    ]);

    allParcelsData = parcelsRes;
    allConflictsData = conflictsRes;

    renderParcels();
    renderConflicts();
    renderStats(statsRes);

    // Auto-focus / re-center map to the bounds of the loaded segment features
    if (parcelsLayer.getLayers().length > 0) {
      map.fitBounds(parcelsLayer.getBounds(), { padding: [40, 40], maxZoom: 18 });
    }
  } catch (err) {
    console.warn("Could not connect to FastAPI backend.", err);
  }
}

/**
 * Renders parcels onto the map applying active filters.
 */
function renderParcels() {
  if (!allParcelsData) return;

  const filteredFeatures = allParcelsData.features.filter(f => {
    const matchesFilter = activeFilter === "all" || f.properties.status === activeFilter;
    const matchesSearch = !searchTerm ||
      (f.properties.survey_no && f.properties.survey_no.toLowerCase().includes(searchTerm)) ||
      (f.properties.ulpin && f.properties.ulpin.toLowerCase().includes(searchTerm)) ||
      (f.properties.owner_name && f.properties.owner_name.toLowerCase().includes(searchTerm));
    return matchesFilter && matchesSearch;
  });

  parcelsLayer.clearLayers();
  parcelsLayer.addData({
    type: "FeatureCollection",
    features: filteredFeatures
  });
}

/**
 * Renders conflict polygons and sidebar cards for the active mini-segment.
 */
function renderConflicts() {
  if (!allConflictsData) return;

  conflictsLayer.clearLayers();
  const unresolvedConflicts = allConflictsData.features.filter(c => c.properties.status !== "RESOLVED");
  conflictsLayer.addData({
    type: "FeatureCollection",
    features: unresolvedConflicts
  });

  document.getElementById("conflicts-badge").textContent = unresolvedConflicts.length;

  const container = document.getElementById("conflicts-container");
  container.innerHTML = "";

  if (unresolvedConflicts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph-bold ph-check-circle" style="color: var(--status-success);"></i>
        <h3>Zero Topology Conflicts</h3>
        <p>All parcel boundaries in <strong>${selectedSegment.replace('_', ' ').title()}</strong> conform to strict topological rules.</p>
      </div>
    `;
    return;
  }

  unresolvedConflicts.forEach(conf => {
    const props = conf.properties;
    const card = document.createElement("div");
    card.className = `conflict-card ${props.severity === "HIGH" ? "high-severity" : ""}`;
    card.innerHTML = `
      <div class="conflict-card-header">
        <span class="conflict-title">${props.conflict_type}</span>
        <span class="conflict-severity ${props.severity === "HIGH" ? "sev-high" : "sev-medium"}">${props.severity}</span>
      </div>
      <div class="conflict-desc">${props.description}</div>
      <div class="conflict-meta">Overlap Area: ${props.overlap_area_sqm} sq.m</div>
      <button class="btn-resolve" onclick="resolveConflict('${conf.id}')">
        <i class="ph-bold ph-magic-wand"></i> Auto-Clip Boundary Overlap
      </button>
    `;
    container.appendChild(card);
  });
}

/**
 * Updates header KPI counters for current segment.
 */
function renderStats(stats) {
  if (!stats) return;
  document.getElementById("val-parcels").textContent = stats.total_parcels;
  document.getElementById("val-area").textContent = stats.total_surveyed_area_hectares;
  document.getElementById("val-conflicts").textContent = stats.total_conflicts;
  document.getElementById("val-confidence").textContent = `${Math.round(stats.ai_confidence_average * 100)}%`;
}

/**
 * Selects a parcel and populates the Parcel Inspector sidebar.
 */
function selectParcel(feature) {
  selectedParcelId = feature.id;
  parcelsLayer.setStyle(styleParcelFeature);

  const props = feature.properties;

  document.getElementById("parcel-empty-state").classList.add("hidden");
  document.getElementById("parcel-details-card").classList.remove("hidden");

  switchTab("inspector-view");

  document.getElementById("detail-region").textContent = props.region_name || props.region || selectedCity.toUpperCase();
  document.getElementById("detail-segment").textContent = props.segment_name || props.segment || selectedSegment.toUpperCase();
  document.getElementById("detail-ulpin").textContent = props.ulpin || "--";
  document.getElementById("detail-survey-no").textContent = props.survey_no || "--";
  document.getElementById("detail-land-use").textContent = props.land_use || "Residential";
  document.getElementById("detail-owner").textContent = props.owner_name || "Unassigned";
  document.getElementById("detail-source").textContent = props.source || "AI-SAM";
  document.getElementById("detail-area").textContent = `${props.area_sqm} m² (${(props.area_sqm / 40.4686).toFixed(2)} Cents)`;
  document.getElementById("detail-perimeter").textContent = `${props.perimeter_m} m`;

  const confScore = Math.round((props.confidence_score || 0.90) * 100);
  document.getElementById("detail-confidence-val").textContent = `${confScore}%`;
  document.getElementById("detail-confidence-bar").style.width = `${confScore}%`;

  const badge = document.getElementById("detail-status-badge");
  badge.textContent = props.status || "PENDING";
  badge.className = `status-badge badge-${props.status || "pending"}`;
}

/**
 * Resolves an active topology conflict.
 */
async function resolveConflict(conflictId) {
  try {
    const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolution_method: "CLIP_TO_MEDIAN_EDGE"
      })
    });
    if (res.ok) {
      await loadDataForCurrentSegment();
    }
  } catch (err) {
    console.error("Error resolving conflict:", err);
  }
}

/**
 * Tab switching helper.
 */
function switchTab(targetTabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === targetTabId);
  });
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("active", content.id === targetTabId);
  });
}

/**
 * Setup event listeners for toolbar, city dropdown, search, and action buttons.
 */
function setupEventListeners() {
  // City Region Dropdown Change
  document.getElementById("city-select").addEventListener("change", async (e) => {
    selectedCity = e.target.value;
    await updateSegmentDropdown(selectedCity);
  });

  // Mini-Segment Dropdown Change
  document.getElementById("segment-select").addEventListener("change", async (e) => {
    selectedSegment = e.target.value;
    await loadDataForCurrentSegment();
  });

  // Tab Navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Filter Chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderParcels();
    });
  });

  // Search Input
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderParcels();
  });

  // Action: Trigger AI SAM Segmentation for selected segment
  document.getElementById("btn-run-sam").addEventListener("click", async () => {
    const btn = document.getElementById("btn-run-sam");
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="ph-bold ph-spinner" style="animation: spin 1s infinite linear;"></i> Extracting...`;
    try {
      await fetch(`${API_BASE}/parcels/run-segmentation?region=${selectedCity}&segment=${selectedSegment}`, { method: "POST" });
      await loadDataForCurrentSegment();
    } catch (err) {
      console.error(err);
    } finally {
      btn.innerHTML = origHtml;
    }
  });

  // Action: Trigger Conflict Matrix Check for selected segment
  document.getElementById("btn-run-topology").addEventListener("click", async () => {
    try {
      await fetch(`${API_BASE}/conflicts/detect?region=${selectedCity}&segment=${selectedSegment}`, { method: "POST" });
      await loadDataForCurrentSegment();
      switchTab("conflicts-view");
    } catch (err) {
      console.error(err);
    }
  });

  // Action: Export GeoJSON for current segment
  document.getElementById("btn-export-geojson").addEventListener("click", () => {
    if (!allParcelsData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allParcelsData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cadastral_parcels_${selectedCity}_${selectedSegment}.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Action: Approve Parcel
  document.getElementById("btn-approve-parcel").addEventListener("click", async () => {
    if (!selectedParcelId) return;
    try {
      await fetch(`${API_BASE}/parcels/${selectedParcelId}/approve`, { method: "POST" });
      await loadDataForCurrentSegment();
      if (allParcelsData) {
        const updated = allParcelsData.features.find(p => p.id === selectedParcelId);
        if (updated) selectParcel(updated);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Action: Reject Parcel
  document.getElementById("btn-reject-parcel").addEventListener("click", async () => {
    if (!selectedParcelId) return;
    try {
      await fetch(`${API_BASE}/parcels/${selectedParcelId}/reject`, { method: "POST" });
      await loadDataForCurrentSegment();
      if (allParcelsData) {
        const updated = allParcelsData.features.find(p => p.id === selectedParcelId);
        if (updated) selectParcel(updated);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Action: Copy ULPIN
  document.getElementById("btn-copy-ulpin").addEventListener("click", () => {
    const code = document.getElementById("detail-ulpin").textContent;
    navigator.clipboard.writeText(code);
    const copyBtn = document.getElementById("btn-copy-ulpin");
    copyBtn.innerHTML = `<i class="ph-bold ph-check" style="color: #10b981;"></i>`;
    setTimeout(() => {
      copyBtn.innerHTML = `<i class="ph-bold ph-copy"></i>`;
    }, 1500);
  });

  // Layer Toggles
  document.getElementById("toggle-parcels").addEventListener("click", (e) => {
    toggleLayer(parcelsLayer, e.currentTarget);
  });
  document.getElementById("toggle-conflicts").addEventListener("click", (e) => {
    toggleLayer(conflictsLayer, e.currentTarget);
  });
}

function toggleLayer(layer, buttonEl) {
  if (map.hasLayer(layer)) {
    map.removeLayer(layer);
    buttonEl.classList.remove("active");
  } else {
    map.addLayer(layer);
    buttonEl.classList.add("active");
  }
}

function setupStaticRegionsFallback() {
  const citySelect = document.getElementById("city-select");
  citySelect.innerHTML = `
    <option value="delhi">Delhi</option>
    <option value="ghaziabad">Ghaziabad</option>
    <option value="meerut">Meerut</option>
    <option value="panipat">Panipat</option>
  `;
}
