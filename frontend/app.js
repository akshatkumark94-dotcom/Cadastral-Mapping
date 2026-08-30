/**
 * Cadastral AI Mapper — Frontend Leaflet & API Controller
 * Smart India Hackathon 2026
 * ENHANCED: Animations, Toasts, Confetti, Micro-interactions
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

let confettiCtx = null;
let confettiParticles = [];
let toastIdCounter = 0;

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initEffects();
  setupEventListeners();
  loadData();
});

function initMap() {
  map = L.map("map-container", {
    center: [12.9348, 77.6207],
    zoom: 17,
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
    showToast("Backend offline — loaded sample dataset", "warning");
    loadSampleFallback();
  }
}

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
  parcelsLayer.addData({ type: "FeatureCollection", features: filteredFeatures });
}

function renderConflicts() {
  if (!allConflictsData) return;

  conflictsLayer.clearLayers();
  const unresolvedConflicts = allConflictsData.features.filter(c => c.properties.status !== "RESOLVED");
  conflictsLayer.addData({ type: "FeatureCollection", features: unresolvedConflicts });

  const badge = document.getElementById("conflicts-badge");
  if (badge) {
    badge.textContent = unresolvedConflicts.length;
    badge.classList.add("counting");
    setTimeout(() => badge.classList.remove("counting"), 500);
  }

  const container = document.getElementById("conflicts-container");
  container.innerHTML = "";

  if (unresolvedConflicts.length === 0) {
    container.innerHTML = `
      <div class="empty-state animate-fadeInUp">
        <i class="ph-bold ph-check-circle" style="color: var(--status-success);"></i>
        <h3>Zero Topology Conflicts</h3>
        <p>All parcel boundaries conform to strict geometric non-overlapping topological rules.</p>
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

  document.getElementById("parcel-empty-state").classList.add("hidden");
  const card = document.getElementById("parcel-details-card");
  card.classList.remove("hidden");
  card.classList.remove("animate-fadeInUp");
  void card.offsetWidth;
  card.classList.add("animate-fadeInUp");

  switchTab("inspector-view");

  document.getElementById("detail-ulpin").textContent = props.ulpin || "--";
  document.getElementById("detail-survey-no").textContent = props.survey_no || "--";
  document.getElementById("detail-land-use").textContent = props.land_use || "Residential";
  document.getElementById("detail-owner").textContent = props.owner_name || "Unassigned";
  document.getElementById("detail-source").textContent = props.source || "AI-SAM";
  document.getElementById("detail-area").textContent = `${props.area_sqm} m² (${(props.area_sqm / 40.4686).toFixed(2)} Cents)`;
  document.getElementById("detail-perimeter").textContent = `${props.perimeter_m} m`;

  const confScore = Math.round((props.confidence_score || 0.90) * 100);
  const confEl = document.getElementById("detail-confidence-val");
  const confBar = document.getElementById("detail-confidence-bar");
  confEl.textContent = `${confScore}%`;
  confBar.style.width = "0%";
  confBar.className = "meter-fill " + (confScore >= 85 ? "high" : confScore >= 60 ? "medium" : "low");
  setTimeout(() => { confBar.style.width = `${confScore}%`; }, 100);

  const badge = document.getElementById("detail-status-badge");
  badge.textContent = props.status || "PENDING";
  badge.className = `status-badge badge-${props.status || "pending"}`;

  try {
    const layer = parcelsLayer.getLayers().find(l => l.feature.id === feature.id);
    if (layer) {
      const bounds = layer.getBounds();
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2, easeLinearity: 0.25 });
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
      await loadData();
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
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => { switchTab(btn.dataset.tab); });
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderParcels();
    });
  });

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderParcels();
  });

  document.getElementById("btn-run-sam").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const origHtml = btn.innerHTML;
    btn.innerHTML = `<i class="ph-bold ph-spinner" style="animation: spin 1s infinite linear;"></i> Extracting...`;
    btn.classList.add("btn-shimmer");
    showToast("SAM segmentation started — processing drone imagery", "info");
    try {
      await fetch(`${API_BASE}/parcels/run-segmentation`, { method: "POST" });
      await loadData();
      showToast("Footprint extraction complete", "success");
    } catch (err) {
      console.error(err);
      showToast("Segmentation failed — check backend connection", "error");
    } finally {
      btn.innerHTML = origHtml;
      btn.classList.remove("btn-shimmer");
    }
  });

  document.getElementById("btn-run-topology").addEventListener("click", async () => {
    showToast("Running topology validation matrix...", "info");
    try {
      await fetch(`${API_BASE}/conflicts/detect`, { method: "POST" });
      await loadData();
      switchTab("conflicts-view");
      showToast("Topology check complete", "success");
    } catch (err) {
      console.error(err);
      showToast("Topology check failed", "error");
    }
  });

  document.getElementById("btn-export-geojson").addEventListener("click", exportGeoJSON);
  document.getElementById("nav-export").addEventListener("click", exportGeoJSON);

  document.getElementById("nav-home").addEventListener("click", () => { resetWorkspace(); });
  document.getElementById("scroll-fab").addEventListener("click", () => { resetWorkspace(); });

  document.getElementById("nav-help").addEventListener("click", () => {
    showToast("Click any parcel on the map to inspect its record, or open the Conflicts tab to arbitrate boundary overlaps.", "info", "About this workspace");
  });

  document.getElementById("btn-approve-parcel").addEventListener("click", async (e) => {
    if (!selectedParcelId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    triggerConfetti(rect.left + rect.width / 2, rect.top);
    try {
      await fetch(`${API_BASE}/parcels/${selectedParcelId}/approve`, { method: "POST" });
      await loadData();
      if (allParcelsData) {
        const updated = allParcelsData.features.find(p => p.id === selectedParcelId);
        if (updated) selectParcel(updated);
      }
      showToast("Parcel approved and registered", "success");
    } catch (err) {
      console.error(err);
      showToast("Approval failed", "error");
    }
  });

  document.getElementById("btn-reject-parcel").addEventListener("click", async () => {
    if (!selectedParcelId) return;
    try {
      await fetch(`${API_BASE}/parcels/${selectedParcelId}/reject`, { method: "POST" });
      await loadData();
      if (allParcelsData) {
        const updated = allParcelsData.features.find(p => p.id === selectedParcelId);
        if (updated) selectParcel(updated);
      }
      showToast("Parcel rejected", "warning");
    } catch (err) {
      console.error(err);
      showToast("Rejection failed", "error");
    }
  });

  document.getElementById("btn-copy-ulpin").addEventListener("click", (e) => {
    const code = document.getElementById("detail-ulpin").textContent;
    navigator.clipboard.writeText(code);
    const copyBtn = e.currentTarget;
    copyBtn.classList.add("copied");
    copyBtn.innerHTML = `<i class="ph-bold ph-check" style="color: #1B7B3F;"></i>`;
    showToast("ULPIN copied to clipboard", "success");
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.innerHTML = `<i class="ph-bold ph-copy"></i>`;
    }, 1500);
  });

  document.getElementById("toggle-parcels").addEventListener("click", (e) => { toggleLayer(parcelsLayer, e.currentTarget); });
  document.getElementById("toggle-conflicts").addEventListener("click", (e) => { toggleLayer(conflictsLayer, e.currentTarget); });
  document.getElementById("toggle-roads").addEventListener("click", (e) => { toggleLayer(roadsLayer, e.currentTarget); });
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
  downloadAnchor.setAttribute("download", "cadastral_ai_parcels_sih2026.geojson");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("GeoJSON export downloaded", "success");
}

function resetWorkspace() {
  // Clear filters and search
  activeFilter = "all";
  searchTerm = "";
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  const allChip = document.querySelector('.chip[data-filter="all"]');
  if (allChip) allChip.classList.add("active");
  renderParcels();

  // Clear parcel selection
  selectedParcelId = null;
  parcelsLayer.setStyle(styleParcelFeature);
  const card = document.getElementById("parcel-details-card");
  const empty = document.getElementById("parcel-empty-state");
  if (card) card.classList.add("hidden");
  if (empty) empty.classList.remove("hidden");
  switchTab("inspector-view");

  // Mark Home as the active nav item
  document.querySelectorAll(".gov-nav .nav-item").forEach(n => n.classList.remove("active"));
  const homeBtn = document.getElementById("nav-home");
  if (homeBtn) homeBtn.classList.add("active");

  // Recentre the map
  if (map) map.flyTo([12.9348, 77.6207], 17, { duration: 1 });

  showToast("Workspace reset to default view", "info");
}

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
