/**
 * Cadastral AI Mapper — Frontend Leaflet & API Controller
 * Smart India Hackathon 2026
 * Hierarchical Multi-City & Mini-Segment Support (Delhi, Ghaziabad, Meerut, Panipat)
 * Rich Aesthetics: Animations, Toasts, Confetti, Micro-interactions
 */

const API_BASE = "http://localhost:8000/api";

let map;
let parcelsLayer;
let conflictsLayer;
let roadsLayer;

let allParcelsData = null;
let allConflictsData = null;
let selectedParcelId = null;
let activeFilter = "all";
let searchTerm = "";

let selectedCity = "delhi";
let selectedSegment = "karol_bagh";
let regionsCache = [];

let confettiCtx = null;
let confettiParticles = [];
let toastIdCounter = 0;

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  initEffects();
  setupEventListeners();
  await initHierarchySelectors();
  await loadDataForCurrentSegment();
});

function initMap() {
  // Default centered on Delhi (Karol Bagh)
  map = L.map("map-container", {
    center: [28.6480, 77.1850],
    zoom: 16,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  const esriSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community", maxZoom: 19 }
  );
  const cartoDark = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; <a href='https://carto.com/'>CARTO</a>", maxZoom: 19 }
  );
  const osmStandard = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }
  );

  esriSatellite.addTo(map);

  const baseMaps = {
    "Satellite Imagery": esriSatellite,
    "Carto Dark GIS": cartoDark,
    "OpenStreetMap": osmStandard
  };
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  parcelsLayer = L.geoJSON(null, { style: styleParcelFeature, onEachFeature: onEachParcelFeature }).addTo(map);
  conflictsLayer = L.geoJSON(null, { style: styleConflictFeature, onEachFeature: onEachConflictFeature }).addTo(map);
  roadsLayer = L.geoJSON(null, { style: { color: "#7C8A99", weight: 3, opacity: 0.7, dashArray: "4, 4" } }).addTo(map);

  map.on("load", () => { hideMapLoading(); });
  setTimeout(hideMapLoading, 1500);
}

function hideMapLoading() {
  const loader = document.getElementById("map-loading");
  if (loader) loader.classList.add("hidden");
}

function initEffects() {
  const canvas = document.getElementById("confetti-canvas");
  if (canvas) {
    confettiCtx = canvas.getContext("2d");
    resizeConfetti();
    window.addEventListener("resize", resizeConfetti);
    requestAnimationFrame(animateConfetti);
  }
}

function resizeConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

async function initHierarchySelectors() {
  const citySelect = document.getElementById("city-select");
  const segmentSelect = document.getElementById("segment-select");
  if (!citySelect || !segmentSelect) return;

  try {
    const res = await fetch(`${API_BASE}/regions`);
    if (res.ok) {
      const data = await res.json();
      regionsCache = data.regions || [];

      if (regionsCache.length > 0) {
        citySelect.innerHTML = regionsCache.map(r => `
          <option value="${r.key}" ${r.key === selectedCity ? "selected" : ""}>${r.name}</option>
        `).join("");

        await updateSegmentDropdown(selectedCity);
      }
    }
  } catch (err) {
    console.warn("Could not fetch regions hierarchy:", err);
  }
}

async function updateSegmentDropdown(cityKey) {
  const segmentSelect = document.getElementById("segment-select");
  if (!segmentSelect) return;

  try {
    const res = await fetch(`${API_BASE}/regions/${cityKey}/segments`);
    if (res.ok) {
      const data = await res.json();
      const segments = data.segments || [];

      if (segments.length > 0) {
        segmentSelect.innerHTML = segments.map((s, idx) => `
          <option value="${s.key}" ${idx === 0 ? "selected" : ""}>${s.name}</option>
        `).join("");
        selectedSegment = segmentSelect.value;
      }
    }
  } catch (err) {
    console.warn(`Could not fetch segments for ${cityKey}:`, err);
  }
}

function styleParcelFeature(feature) {
  const status = feature.properties.status || "pending";
  const isSelected = feature.id === selectedParcelId;

  let color = "#B4690E";
  let fillColor = "#B4690E";

  if (status === "approved") { color = "#1B7B3F"; fillColor = "#1B7B3F"; }
  else if (status === "flagged") { color = "#B3261E"; fillColor = "#B3261E"; }
  else if (status === "rejected") { color = "#6B7683"; fillColor = "#5A6570"; }

  return {
    color: isSelected ? "#0B3D6E" : color,
    weight: isSelected ? 3 : 2,
    opacity: 0.9,
    fillColor: fillColor,
    fillOpacity: isSelected ? 0.45 : 0.25,
    dashArray: status === "pending" ? "3, 3" : null
  };
}

function styleConflictFeature(feature) {
  return { color: "#7A1B14", weight: 2, opacity: 1.0, fillColor: "#B3261E", fillOpacity: 0.5, dashArray: "4, 4" };
}

function onEachParcelFeature(feature, layer) {
  layer.on({
    click: (e) => { L.DomEvent.stopPropagation(e); selectParcel(feature); },
    mouseover: () => { layer.setStyle({ fillOpacity: 0.5, weight: 3 }); },
    mouseout: () => { if (feature.id !== selectedParcelId) layer.setStyle({ fillOpacity: 0.25, weight: 2 }); }
  });

  const props = feature.properties;
  layer.bindTooltip(
    `<strong>Survey No:</strong> ${props.survey_no}<br><strong>ULPIN:</strong> ${props.ulpin}<br><strong>Area:</strong> ${props.area_sqm} m²`,
    { sticky: true, className: "custom-leaflet-tooltip" }
  );
}

function onEachConflictFeature(feature, layer) {
  const props = feature.properties;
  layer.bindPopup(`
    <div style="color: #14212E; font-family: 'Noto Sans', sans-serif;">
      <h4 style="color: #B3261E; margin-bottom: 4px;">⚠️ ${props.conflict_type || "OVERLAP CONFLICT"}</h4>
      <p style="font-size: 11px; margin-bottom: 6px;">${props.description}</p>
      <span style="font-size: 10px; font-weight: bold; background: #FDE9D2; color: #8A4A0E; padding: 2px 6px; border-radius: 4px;">
        Overlap Area: ${props.overlap_area_sqm} m²
      </span>
    </div>
  `);
}

async function loadDataForCurrentSegment(autoFit = true) {
  const loader = document.getElementById("map-loading");
  if (loader) loader.classList.remove("hidden");

  try {
    const [parcelsRes, conflictsRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/parcels?region=${selectedCity}&segment=${selectedSegment}`).then(r => r.json()),
      fetch(`${API_BASE}/conflicts?region=${selectedCity}&segment=${selectedSegment}`).then(r => r.json()),
      fetch(`${API_BASE}/stats?region=${selectedCity}&segment=${selectedSegment}`).then(r => r.json())
    ]);

    allParcelsData = parcelsRes;
    allConflictsData = conflictsRes;

    renderParcels(autoFit);
    renderConflicts();
    renderStats(statsRes);
  } catch (err) {
    console.warn("Could not connect to FastAPI backend. Loading sample fallback.", err);
    showToast("Backend offline — check connection", "warning");
  } finally {
    hideMapLoading();
  }
}

function renderParcels(autoFit = false) {
  if (!allParcelsData) return;

  const filteredFeatures = (allParcelsData.features || []).filter(f => {
    const matchesFilter = activeFilter === "all" || f.properties.status === activeFilter;
    const matchesSearch = !searchTerm ||
      (f.properties.survey_no && f.properties.survey_no.toLowerCase().includes(searchTerm)) ||
      (f.properties.ulpin && f.properties.ulpin.toLowerCase().includes(searchTerm)) ||
      (f.properties.owner_name && f.properties.owner_name.toLowerCase().includes(searchTerm));
    return matchesFilter && matchesSearch;
  });

  parcelsLayer.clearLayers();
  parcelsLayer.addData({ type: "FeatureCollection", features: filteredFeatures });

  if (autoFit && filteredFeatures.length > 0) {
    try {
      const bounds = parcelsLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18, animate: true, duration: 1 });
      }
    } catch (e) {
      console.warn("Could not fit bounds to parcels:", e);
    }
  }
}

function renderConflicts() {
  if (!allConflictsData) return;

  conflictsLayer.clearLayers();
  const unresolvedConflicts = (allConflictsData.features || []).filter(c => c.properties.status !== "RESOLVED");
  conflictsLayer.addData({ type: "FeatureCollection", features: unresolvedConflicts });

  const badge = document.getElementById("conflicts-badge");
  if (badge) {
    badge.textContent = unresolvedConflicts.length;
    badge.classList.add("counting");
    setTimeout(() => badge.classList.remove("counting"), 500);
  }

  const container = document.getElementById("conflicts-container");
  if (!container) return;
  container.innerHTML = "";

  if (unresolvedConflicts.length === 0) {
    container.innerHTML = `
      <div class="empty-state animate-fadeInUp">
        <i class="ph-bold ph-check-circle" style="color: var(--status-success);"></i>
        <h3>Zero Topology Conflicts</h3>
        <p>All parcel boundaries in this segment conform to geometric non-overlapping topological rules.</p>
      </div>
    `;
    return;
  }

  unresolvedConflicts.forEach((conf, index) => {
    const props = conf.properties;
    const card = document.createElement("div");
    card.className = `conflict-card ${props.severity === "HIGH" ? "high-severity" : ""}`;
    card.style.animationDelay = `${index * 0.08}s`;
    card.innerHTML = `
      <div class="conflict-card-header">
        <span class="conflict-title">${props.conflict_type}</span>
        <span class="conflict-severity ${props.severity === "HIGH" ? "sev-high" : "sev-medium"}">${props.severity}</span>
      </div>
      <div class="conflict-desc">${props.description}</div>
      <div class="conflict-meta">Overlap Area: ${props.overlap_area_sqm} sq.m</div>
      <button class="btn-resolve" onclick="resolveConflict('${conf.id}', this)">
        <i class="ph-bold ph-magic-wand"></i> Auto-Clip Boundary Overlap
      </button>
    `;
    container.appendChild(card);
  });
}

function renderStats(stats) {
  if (!stats) return;
  animateCounter("val-parcels", stats.total_parcels || 0);
  animateCounter("val-area", stats.total_surveyed_area_hectares || 0, 2);
  animateCounter("val-conflicts", stats.total_conflicts || 0);
  animateCounter("val-confidence", Math.round((stats.ai_confidence_average || 0) * 100), 0, "%");
}

function animateCounter(elementId, targetValue, decimals = 0, suffix = "") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startValue = parseFloat(el.textContent) || 0;
  const duration = 800;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = startValue + (targetValue - startValue) * easeOut;
    el.textContent = decimals > 0 ? current.toFixed(decimals) + suffix : Math.round(current) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function selectParcel(feature) {
  selectedParcelId = feature.id;
  parcelsLayer.setStyle(styleParcelFeature);

  const props = feature.properties;

  const emptyState = document.getElementById("parcel-empty-state");
  const card = document.getElementById("parcel-details-card");
  if (emptyState) emptyState.classList.add("hidden");
  if (card) {
    card.classList.remove("hidden");
    card.classList.remove("animate-fadeInUp");
    void card.offsetWidth;
    card.classList.add("animate-fadeInUp");
  }

  switchTab("inspector-view");

  const regionEl = document.getElementById("detail-region");
  const segmentEl = document.getElementById("detail-segment");
  if (regionEl) regionEl.textContent = props.region_name || props.region || selectedCity.toUpperCase();
  if (segmentEl) segmentEl.textContent = props.segment_name || props.segment || selectedSegment.toUpperCase();

  const ulpinEl = document.getElementById("detail-ulpin");
  const surveyEl = document.getElementById("detail-survey-no");
  const landUseEl = document.getElementById("detail-land-use");
  const ownerEl = document.getElementById("detail-owner");
  const sourceEl = document.getElementById("detail-source");
  const areaEl = document.getElementById("detail-area");
  const perimeterEl = document.getElementById("detail-perimeter");

  if (ulpinEl) ulpinEl.textContent = props.ulpin || "--";
  if (surveyEl) surveyEl.textContent = props.survey_no || "--";
  if (landUseEl) landUseEl.textContent = props.land_use || "Residential";
  if (ownerEl) ownerEl.textContent = props.owner_name || "Unassigned";
  if (sourceEl) sourceEl.textContent = props.source || "AI-SAM";
  if (areaEl) areaEl.textContent = `${props.area_sqm} m² (${(props.area_sqm / 40.4686).toFixed(2)} Cents)`;
  if (perimeterEl) perimeterEl.textContent = `${props.perimeter_m} m`;

  const confScore = Math.round((props.confidence_score || 0.90) * 100);
  const confEl = document.getElementById("detail-confidence-val");
  const confBar = document.getElementById("detail-confidence-bar");
  if (confEl) confEl.textContent = `${confScore}%`;
  if (confBar) {
    confBar.style.width = "0%";
    confBar.className = "meter-fill " + (confScore >= 85 ? "high" : confScore >= 60 ? "medium" : "low");
    setTimeout(() => { confBar.style.width = `${confScore}%`; }, 100);
  }

  const badge = document.getElementById("detail-status-badge");
  if (badge) {
    badge.textContent = (props.status || "pending").toUpperCase();
    badge.className = `status-badge badge-${props.status || "pending"}`;
  }

  try {
    const layer = parcelsLayer.getLayers().find(l => l.feature && l.feature.id === feature.id);
    if (layer) {
      const bounds = layer.getBounds();
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.0, easeLinearity: 0.25 });
    }
  } catch (e) { /* silent */ }
}

async function resolveConflict(conflictId, btnEl) {
  if (btnEl) {
    btnEl.classList.add("resolving");
    btnEl.innerHTML = `<i class="ph-bold ph-spinner" style="animation: spin 1s linear infinite;"></i> Resolving...`;
  }
  try {
    const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution_method: "CLIP_TO_MEDIAN_EDGE" })
    });
    if (res.ok) {
      if (btnEl) {
        btnEl.classList.remove("resolving");
        btnEl.classList.add("resolved");
        btnEl.innerHTML = `<i class="ph-bold ph-check"></i> Resolved`;
      }
      showToast("Conflict resolved successfully", "success");
      await loadDataForCurrentSegment(false);
    } else {
      throw new Error("Resolve failed");
    }
  } catch (err) {
    console.error("Error resolving conflict:", err);
    showToast("Failed to resolve conflict", "error");
    if (btnEl) {
      btnEl.classList.remove("resolving");
      btnEl.innerHTML = `<i class="ph-bold ph-magic-wand"></i> Auto-Clip Boundary Overlap`;
    }
  }
}

function switchTab(targetTabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === targetTabId);
  });
  const homeBtn = document.getElementById("nav-home");
  if (homeBtn) homeBtn.classList.remove("active");
  document.querySelectorAll(".tab-content").forEach(content => {
    const isActive = content.id === targetTabId;
    if (isActive) {
      content.classList.add("active");
      content.style.animation = "none";
      void content.offsetWidth;
      content.style.animation = "";
    } else {
      content.classList.remove("active");
    }
  });
}

function showToast(message, type = "info", title = "") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "ph-check-circle", error: "ph-x-circle", warning: "ph-warning", info: "ph-info" };
  const titles = { success: title || "Success", error: title || "Error", warning: title || "Warning", info: title || "Info" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.id = `toast-${++toastIdCounter}`;
  toast.innerHTML = `
    <i class="ph-bold ${icons[type]} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="removeToast('${toast.id}')"><i class="ph-bold ph-x"></i></button>
  `;

  container.appendChild(toast);
  setTimeout(() => removeToast(toast.id), 4000);
}

function removeToast(id) {
  const toast = document.getElementById(id);
  if (!toast) return;
  toast.classList.add("removing");
  setTimeout(() => toast.remove(), 300);
}

function triggerConfetti(x, y) {
  const colors = ["#0B3D6E", "#E17A1F", "#1B7B3F", "#B3261E", "#5B3E8E", "#6B7683"];
  for (let i = 0; i < 60; i++) {
    confettiParticles.push({
      x: x || window.innerWidth / 2,
      y: y || window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 1) * 12 - 4,
      life: 1,
      decay: 0.01 + Math.random() * 0.02,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }
}

function animateConfetti() {
  if (!confettiCtx) return;
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  confettiCtx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles = confettiParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life -= p.decay;
    p.rotation += p.rotationSpeed;

    if (p.life > 0) {
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.globalAlpha = p.life;
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      confettiCtx.restore();
      return true;
    }
    return false;
  });

  requestAnimationFrame(animateConfetti);
}

function setupEventListeners() {
  // City Region Dropdown
  const citySelect = document.getElementById("city-select");
  if (citySelect) {
    citySelect.addEventListener("change", async (e) => {
      selectedCity = e.target.value;
      await updateSegmentDropdown(selectedCity);
      await loadDataForCurrentSegment(true);
      showToast(`Switched region to ${citySelect.options[citySelect.selectedIndex].text}`, "info");
    });
  }

  // Mini-Segment Dropdown
  const segmentSelect = document.getElementById("segment-select");
  if (segmentSelect) {
    segmentSelect.addEventListener("change", async (e) => {
      selectedSegment = e.target.value;
      await loadDataForCurrentSegment(true);
      showToast(`Loaded segment: ${segmentSelect.options[segmentSelect.selectedIndex].text}`, "info");
    });
  }

  // Tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => { switchTab(btn.dataset.tab); });
  });

  // Filter chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderParcels(false);
    });
  });

  // Search box
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      renderParcels(false);
    });
  }

  // Trigger SAM AI Segmentation
  const samBtn = document.getElementById("btn-run-sam");
  if (samBtn) {
    samBtn.addEventListener("click", async (e) => {
      const origHtml = samBtn.innerHTML;
      samBtn.innerHTML = `<i class="ph-bold ph-spinner" style="animation: spin 1s infinite linear;"></i> Extracting...`;
      samBtn.classList.add("btn-shimmer");
      showToast(`Extracting AI footprints for ${selectedSegment}...`, "info");
      try {
        await fetch(`${API_BASE}/parcels/run-segmentation?region=${selectedCity}&segment=${selectedSegment}`, { method: "POST" });
        await loadDataForCurrentSegment(true);
        showToast("Footprint extraction complete", "success");
      } catch (err) {
        console.error(err);
        showToast("Segmentation failed — check backend connection", "error");
      } finally {
        samBtn.innerHTML = origHtml;
        samBtn.classList.remove("btn-shimmer");
      }
    });
  }

  // Trigger Topology Overlap Matrix Check
  const topoBtn = document.getElementById("btn-run-topology");
  if (topoBtn) {
    topoBtn.addEventListener("click", async () => {
      showToast("Running topology validation matrix...", "info");
      try {
        await fetch(`${API_BASE}/conflicts/detect?region=${selectedCity}&segment=${selectedSegment}`, { method: "POST" });
        await loadDataForCurrentSegment(false);
        switchTab("conflicts-view");
        showToast("Topology check complete", "success");
      } catch (err) {
        console.error(err);
        showToast("Topology check failed", "error");
      }
    });
  }

  // Export GeoJSON
  const exportBtn = document.getElementById("btn-export-geojson");
  if (exportBtn) exportBtn.addEventListener("click", exportGeoJSON);
  const navExport = document.getElementById("nav-export");
  if (navExport) navExport.addEventListener("click", exportGeoJSON);

  // Home and Reset view
  const navHome = document.getElementById("nav-home");
  if (navHome) navHome.addEventListener("click", () => { resetWorkspace(); });
  const fab = document.getElementById("scroll-fab");
  if (fab) fab.addEventListener("click", () => { resetWorkspace(); });

  // Help
  const helpBtn = document.getElementById("nav-help");
  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      showToast("Select a City & Mini-Segment to inspect cadastral boundaries, run SAM extraction, or arbitrate topology overlaps.", "info", "About this workspace");
    });
  }

  // Approve Parcel
  const approveBtn = document.getElementById("btn-approve-parcel");
  if (approveBtn) {
    approveBtn.addEventListener("click", async (e) => {
      if (!selectedParcelId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      triggerConfetti(rect.left + rect.width / 2, rect.top);
      try {
        await fetch(`${API_BASE}/parcels/${selectedParcelId}/approve`, { method: "POST" });
        await loadDataForCurrentSegment(false);
        if (allParcelsData) {
          const updated = (allParcelsData.features || []).find(p => p.id === selectedParcelId);
          if (updated) selectParcel(updated);
        }
        showToast("Parcel approved and registered", "success");
      } catch (err) {
        console.error(err);
        showToast("Approval failed", "error");
      }
    });
  }

  // Reject Parcel
  const rejectBtn = document.getElementById("btn-reject-parcel");
  if (rejectBtn) {
    rejectBtn.addEventListener("click", async () => {
      if (!selectedParcelId) return;
      try {
        await fetch(`${API_BASE}/parcels/${selectedParcelId}/reject`, { method: "POST" });
        await loadDataForCurrentSegment(false);
        if (allParcelsData) {
          const updated = (allParcelsData.features || []).find(p => p.id === selectedParcelId);
          if (updated) selectParcel(updated);
        }
        showToast("Parcel rejected", "warning");
      } catch (err) {
        console.error(err);
        showToast("Rejection failed", "error");
      }
    });
  }

  // Copy ULPIN
  const copyBtn = document.getElementById("btn-copy-ulpin");
  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      const code = document.getElementById("detail-ulpin").textContent;
      navigator.clipboard.writeText(code);
      copyBtn.classList.add("copied");
      copyBtn.innerHTML = `<i class="ph-bold ph-check" style="color: #1B7B3F;"></i>`;
      showToast("ULPIN copied to clipboard", "success");
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.innerHTML = `<i class="ph-bold ph-copy"></i>`;
      }, 1500);
    });
  }

  // Layer Toggles
  const toggleP = document.getElementById("toggle-parcels");
  if (toggleP) toggleP.addEventListener("click", (e) => { toggleLayer(parcelsLayer, e.currentTarget); });
  const toggleC = document.getElementById("toggle-conflicts");
  if (toggleC) toggleC.addEventListener("click", (e) => { toggleLayer(conflictsLayer, e.currentTarget); });
  const toggleR = document.getElementById("toggle-roads");
  if (toggleR) toggleR.addEventListener("click", (e) => { toggleLayer(roadsLayer, e.currentTarget); });
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

function exportGeoJSON() {
  if (!allParcelsData) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allParcelsData, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `cadastral_parcels_${selectedCity}_${selectedSegment}.geojson`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("GeoJSON export downloaded", "success");
}

function resetWorkspace() {
  activeFilter = "all";
  searchTerm = "";
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  const allChip = document.querySelector('.chip[data-filter="all"]');
  if (allChip) allChip.classList.add("active");

  selectedParcelId = null;
  parcelsLayer.setStyle(styleParcelFeature);
  const card = document.getElementById("parcel-details-card");
  const empty = document.getElementById("parcel-empty-state");
  if (card) card.classList.add("hidden");
  if (empty) empty.classList.remove("hidden");
  switchTab("inspector-view");

  document.querySelectorAll(".gov-nav .nav-item").forEach(n => n.classList.remove("active"));
  const homeBtn = document.getElementById("nav-home");
  if (homeBtn) homeBtn.classList.add("active");

  renderParcels(true);
  showToast("Workspace reset to default view", "info");
}
