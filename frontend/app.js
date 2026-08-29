/**
 * Cadastral AI Mapper — Frontend Leaflet & API Controller
 * Smart India Hackathon 2026
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

// Initialize Application on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupEventListeners();
  loadData();
});

/**
 * Initializes the Leaflet map and base tile layers.
 */
function initMap() {
  // Center on sample survey area (Bengaluru Urban Zone)
  map = L.map("map-container", {
    center: [12.9348, 77.6207],
    zoom: 17,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Basemap Providers
  const esriSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
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

  // Default Basemap: High Resolution Satellite Imagery
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

  // Popup Preview
  const props = feature.properties;
  layer.bindTooltip(
    `<strong>Survey No:</strong> ${props.survey_no}<br><strong>ULPIN:</strong> ${props.ulpin}<br><strong>Area:</strong> ${props.area_sqm} m²`,
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
      <p style="font-size: 11px; margin-bottom: 6px;">${props.description}</p>
      <span style="font-size: 10px; font-weight: bold; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px;">
        Overlap Area: ${props.overlap_area_sqm} m²
      </span>
    </div>
  `);
}

/**
 * Loads parcels, conflicts, and system stats from the backend.
 */
async function loadData() {
  try {
    const [parcelsRes, conflictsRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/parcels`).then(r => r.json()),
      fetch(`${API_BASE}/conflicts`).then(r => r.json()),
      fetch(`${API_BASE}/stats`).then(r => r.json())
    ]);

    allParcelsData = parcelsRes;
    allConflictsData = conflictsRes;

    renderParcels();
    renderConflicts();
    renderStats(statsRes);
  } catch (err) {
    console.warn("Could not connect to FastAPI backend. Loading embedded sample fallback.", err);
    loadSampleFallback();
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
 * Renders conflict polygons and sidebar cards.
 */
function renderConflicts() {
  if (!allConflictsData) return;

  conflictsLayer.clearLayers();
  const unresolvedConflicts = allConflictsData.features.filter(c => c.properties.status !== "RESOLVED");
  conflictsLayer.addData({
    type: "FeatureCollection",
    features: unresolvedConflicts
  });

  // Update Badge
  document.getElementById("conflicts-badge").textContent = unresolvedConflicts.length;

  // Render Sidebar Cards
  const container = document.getElementById("conflicts-container");
  container.innerHTML = "";

  if (unresolvedConflicts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph-bold ph-check-circle" style="color: var(--status-success);"></i>
        <h3>Zero Topology Conflicts</h3>
        <p>All parcel boundaries conform to strict geometric non-overlapping topological rules.</p>
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
 * Updates header KPI counters.
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

  // Switch to inspector tab
  switchTab("inspector-view");

  // Populate data
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
      await loadData();
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
 * Setup event listeners for toolbar, tabs, search, and action buttons.
 */
function setupEventListeners() {
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

  // Action: Trigger AI SAM Segmentation
  document.getElementById("btn-run-sam").addEventListener("click", async () => {
    const btn = document.getElementById("btn-run-sam");
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="ph-bold ph-spinner" style="animation: spin 1s infinite linear;"></i> Extracting...`;
    try {
      await fetch(`${API_BASE}/parcels/run-segmentation`, { method: "POST" });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      btn.innerHTML = origHtml;
    }
  });

  // Action: Trigger Conflict Matrix Check
  document.getElementById("btn-run-topology").addEventListener("click", async () => {
    try {
      await fetch(`${API_BASE}/conflicts/detect`, { method: "POST" });
      await loadData();
      switchTab("conflicts-view");
    } catch (err) {
      console.error(err);
    }
  });

  // Action: Export GeoJSON
  document.getElementById("btn-export-geojson").addEventListener("click", () => {
    if (!allParcelsData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allParcelsData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "cadastral_ai_parcels_sih2026.geojson");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Action: Approve Parcel
  document.getElementById("btn-approve-parcel").addEventListener("click", async () => {
    if (!selectedParcelId) return;
    try {
      await fetch(`${API_BASE}/parcels/${selectedParcelId}/approve`, { method: "POST" });
      await loadData();
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
      await loadData();
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

/**
 * Fallback loader for static local execution without backend.
 */
function loadSampleFallback() {
  fetch("../data/sample_area/sample_parcels.geojson")
    .then(r => r.json())
    .then(data => {
      allParcelsData = data;
      renderParcels();
      renderStats({
        total_parcels: data.features.length,
        approved_parcels: data.features.filter(f => f.properties.status === "approved").length,
        pending_parcels: data.features.filter(f => f.properties.status === "pending").length,
        flagged_parcels: data.features.filter(f => f.properties.status === "flagged").length,
        total_conflicts: 1,
        total_surveyed_area_hectares: 0.45,
        ai_confidence_average: 0.92
      });
    })
    .catch(() => {});

  fetch("../data/sample_area/sample_conflicts.geojson")
    .then(r => r.json())
    .then(data => {
      allConflictsData = data;
      renderConflicts();
    })
    .catch(() => {});
}
