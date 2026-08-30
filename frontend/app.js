/* ==========================================================================
   Cadastral AI Mapper — Design Tokens
   Direction: dark glass control-room, ambient teal/cyan atmosphere,
   fine cadastral survey-grid texture as the signature motif.
   ========================================================================== */

:root {
  /* Surface */
  --bg-void:          #05070c;
  --bg-deep:           #0a0f18;
  --panel:             rgba(14, 19, 29, 0.62);
  --panel-strong:      rgba(12, 17, 26, 0.86);
  --glass:             rgba(255, 255, 255, 0.045);
  --glass-hover:       rgba(255, 255, 255, 0.075);
  --border-glass:      rgba(255, 255, 255, 0.09);
  --border-glass-strong: rgba(255, 255, 255, 0.17);

  /* Accent */
  --mint:     #3fe8b5;
  --cyan:     #22d3ee;
  --accent-gradient: linear-gradient(135deg, #3fe8b5 0%, #22d3ee 100%);
  --accent-glow: rgba(63, 232, 181, 0.35);

  /* Status */
  --status-success: #34d399;
  --status-pending: #fbbf24;
  --status-danger:  #f87171;
  --status-overlap: #a78bfa;
  --status-rejected: #64748b;

  /* Text */
  --text-primary:   #eef2f6;
  --text-secondary: #93a0b4;
  --text-tertiary:  #5b6577;

  /* Type */
  --font-display: 'Outfit', 'Inter', sans-serif;
  --font-body:    'Inter', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  /* Shape / motion */
  --r-lg: 20px;
  --r-md: 14px;
  --r-sm: 9px;
  --r-pill: 999px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

* { box-sizing: border-box; }

html, body {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--text-primary);
  background: var(--bg-void);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* Ambient atmosphere: soft teal/indigo glow blobs + fine survey-grid texture,
   standing in for the reference's lit 3D cityscape without literally copying it. */
body::before {
  content: "";
  position: fixed;
  inset: -6%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(900px 600px at 88% 92%, rgba(34, 211, 238, 0.10), transparent 60%),
    radial-gradient(700px 500px at 6% 8%, rgba(63, 232, 181, 0.08), transparent 60%),
    radial-gradient(1200px 800px at 50% 0%, rgba(99, 102, 241, 0.05), transparent 55%);
  animation: driftGlow 18s ease-in-out infinite;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(ellipse 80% 65% at 50% 40%, black 30%, transparent 78%);
}

button, input {
  font-family: inherit;
}

::selection {
  background: rgba(63, 232, 181, 0.28);
  color: #fff;
}

/* Scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: var(--r-pill);
}
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

.hidden { display: none !important; }

/* ==========================================================================
   Motion keyframes — page-load reveal, ambient drift, micro-interactions
   ========================================================================== */

@keyframes slideDownFade {
  from { opacity: 0; transform: translateY(-16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideRightFade {
  from { opacity: 0; transform: translateX(28px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes slideLeftFade {
  from { opacity: 0; transform: translateX(-18px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes scaleFade {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes softFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 4px 16px -4px rgba(63, 232, 181, 0.55); }
  50%      { box-shadow: 0 6px 26px -2px rgba(63, 232, 181, 0.85); }
}
@keyframes borderSheen {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes driftGlow {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(-2%, 2%); }
}
@keyframes meterFillIn {
  from { width: 0 !important; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/* ==========================================================================
   App shell
   ========================================================================== */

.app-container {
  position: relative;
  z-index: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ==========================================================================
   Header
   ========================================================================== */

.app-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 14px 24px;
  background: var(--panel-strong);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  border-bottom: 1px solid var(--border-glass);
  z-index: 20;
  animation: slideDownFade 0.6s var(--ease) both;
}

.app-header::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-glow) 35%, rgba(34,211,238,0.35) 60%, transparent);
}

.app-header::before {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
  background-size: 200% 100%;
  animation: borderSheen 6s linear infinite 1.2s;
  opacity: 0.5;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 24px;
  border-right: 1px solid var(--border-glass);
  animation: slideLeftFade 0.6s var(--ease) both 0.1s;
}

.brand-logo {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  background: var(--accent-gradient);
  color: #04140f;
  font-size: 18px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12) inset, 0 6px 18px -4px rgba(63, 232, 181, 0.55);
  animation: softFloat 4.5s ease-in-out infinite 1s;
}

.brand-text h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  white-space: nowrap;
}

.badge-tag {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* KPI ribbon — echoes the floating stat-pill bar from the reference hero */
.kpi-ribbon {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-md);
  padding: 6px 4px;
  flex: 1;
  max-width: 620px;
  animation: slideDownFade 0.6s var(--ease) both 0.15s;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 6px 20px;
  flex: 1;
  position: relative;
  animation: scaleFade 0.5s var(--ease) both;
  transition: transform 0.2s var(--ease);
}
.kpi-card:hover { transform: translateY(-1px); }

.kpi-card:nth-child(1) { animation-delay: 0.25s; }
.kpi-card:nth-child(2) { animation-delay: 0.32s; }
.kpi-card:nth-child(3) { animation-delay: 0.39s; }
.kpi-card:nth-child(4) { animation-delay: 0.46s; }

.kpi-value {
  transition: color 0.3s var(--ease);
}

.kpi-card + .kpi-card::before {
  content: "";
  position: absolute;
  left: 0; top: 8px; bottom: 8px;
  width: 1px;
  background: var(--border-glass);
}

.kpi-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

.kpi-value {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.text-accent { color: var(--mint); }
.text-danger { color: var(--status-danger); }
.text-success { color: var(--status-success); }

/* Header action buttons */
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

#btn-run-topology { animation: slideDownFade 0.6s var(--ease) both 0.37s; }
#btn-export-geojson { animation: slideDownFade 0.6s var(--ease) both 0.44s; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  letter-spacing: -0.005em;
  border-radius: var(--r-pill);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease), background 0.18s var(--ease), border-color 0.18s var(--ease);
}

.btn i { font-size: 15px; }

.btn:active { transform: translateY(1px) scale(0.98); }

.btn-primary {
  background: var(--accent-gradient);
  color: #04140f;
  box-shadow: 0 4px 16px -4px rgba(63, 232, 181, 0.55);
  animation: slideDownFade 0.6s var(--ease) both 0.3s, glowPulse 3.2s ease-in-out infinite 1.5s;
}
.btn-primary:hover {
  box-shadow: 0 6px 22px -4px rgba(63, 232, 181, 0.75);
  transform: translateY(-2px) scale(1.02);
  animation-play-state: paused;
}

.btn-secondary {
  background: var(--glass-hover);
  border-color: var(--border-glass-strong);
  color: var(--text-primary);
}
.btn-secondary:hover { background: rgba(255,255,255,0.12); }

.btn-outline {
  background: transparent;
  border-color: var(--border-glass);
  color: var(--text-secondary);
}
.btn-outline:hover {
  border-color: var(--border-glass-strong);
  color: var(--text-primary);
}

.btn-success {
  background: rgba(52, 211, 153, 0.14);
  border-color: rgba(52, 211, 153, 0.4);
  color: var(--status-success);
}
.btn-success:hover { background: rgba(52, 211, 153, 0.22); }

.btn-danger {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.38);
  color: var(--status-danger);
}
.btn-danger:hover { background: rgba(248, 113, 113, 0.2); }

.flex-1 { flex: 1; justify-content: center; }

/* ==========================================================================
   Main workspace
   ========================================================================== */

.main-workspace {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ==========================================================================
   Map viewport
   ========================================================================== */

.map-viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bg-deep);
  animation: scaleFade 0.9s var(--ease) both;
}

#map-container {
  width: 100%;
  height: 100%;
  background: var(--bg-deep) !important;
}

.leaflet-container {
  font-family: var(--font-body);
  background: var(--bg-deep) !important;
}

/* Leaflet zoom control restyle */
.leaflet-bar {
  border: 1px solid var(--border-glass) !important;
  border-radius: var(--r-sm) !important;
  overflow: hidden;
  box-shadow: 0 8px 24px -8px rgba(0,0,0,0.6) !important;
}
.leaflet-bar a {
  background: var(--panel-strong) !important;
  backdrop-filter: blur(16px);
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-glass) !important;
}
.leaflet-bar a:hover { background: var(--glass-hover) !important; }

.leaflet-control-layers {
  background: var(--panel-strong) !important;
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass) !important;
  border-radius: var(--r-md) !important;
  color: var(--text-primary) !important;
  box-shadow: 0 8px 24px -8px rgba(0,0,0,0.6) !important;
}
.leaflet-control-layers-toggle { filter: invert(1); }

.leaflet-popup-content-wrapper {
  background: #f5f7fa !important;
  border-radius: var(--r-sm) !important;
}
.leaflet-popup-tip { background: #f5f7fa !important; }

.custom-leaflet-tooltip {
  background: var(--panel-strong) !important;
  backdrop-filter: blur(14px);
  border: 1px solid var(--border-glass-strong) !important;
  color: var(--text-primary) !important;
  font-size: 11.5px !important;
  font-family: var(--font-body);
  border-radius: var(--r-sm) !important;
  padding: 8px 10px !important;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.7);
}
.custom-leaflet-tooltip::before { display: none !important; }

.leaflet-control-attribution {
  background: rgba(5, 7, 12, 0.6) !important;
  color: var(--text-tertiary) !important;
  backdrop-filter: blur(8px);
}
.leaflet-control-attribution a { color: var(--text-secondary) !important; }

/* ---- Floating overlay controls on top of the map ---- */

.map-overlay-controls {
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  pointer-events: none;
}

.map-overlay-controls > * { pointer-events: auto; }

.search-box {
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--panel-strong);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-pill);
  padding: 11px 16px;
  min-width: 260px;
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6);
  animation: slideDownFade 0.55s var(--ease) both 0.5s;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.search-box:focus-within {
  border-color: rgba(63, 232, 181, 0.45);
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6), 0 0 0 3px rgba(63, 232, 181, 0.12);
}

.search-box i { color: var(--text-tertiary); font-size: 15px; }

.search-box input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  width: 100%;
}
.search-box input::placeholder { color: var(--text-tertiary); }

.filter-chips {
  display: flex;
  gap: 6px;
  background: var(--panel-strong);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-pill);
  padding: 5px;
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6);
  animation: slideDownFade 0.55s var(--ease) both 0.58s;
}

.chip {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 15px;
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: all 0.18s var(--ease);
}
.chip:hover { color: var(--text-primary); }
.chip:active { transform: scale(0.94); }
.chip.active {
  background: var(--accent-gradient);
  color: #04140f;
  animation: scaleFade 0.3s var(--ease) both;
}
.chip.chip-danger.active {
  background: linear-gradient(135deg, #f87171, #ef4444);
  color: #2a0505;
}

.layer-toggle-group {
  display: flex;
  gap: 6px;
  background: var(--panel-strong);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-pill);
  padding: 5px;
  margin-left: auto;
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6);
  animation: slideDownFade 0.55s var(--ease) both 0.66s;
}

.layer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 15px;
  transition: all 0.18s var(--ease);
}
.layer-btn:hover { color: var(--text-primary); background: var(--glass-hover); transform: translateY(-1px); }
.layer-btn:active { transform: scale(0.9); }
.layer-btn.active {
  background: rgba(63, 232, 181, 0.16);
  color: var(--mint);
}

/* ---- Map legend ---- */

.map-legend {
  position: absolute;
  bottom: 18px;
  left: 18px;
  z-index: 500;
  background: var(--panel-strong);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-md);
  padding: 14px 16px;
  min-width: 190px;
  box-shadow: 0 10px 30px -12px rgba(0,0,0,0.6);
  animation: slideUpFade 0.6s var(--ease) both 0.6s;
}

.map-legend h4 {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 0;
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
  animation: dotPulse 2.4s ease-in-out infinite;
}
@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.status-approved { background: var(--status-success); color: var(--status-success); }
.status-pending  { background: var(--status-pending); color: var(--status-pending); }
.status-flagged  { background: var(--status-danger); color: var(--status-danger); }
.status-overlap  { background: var(--status-overlap); color: var(--status-overlap); }

/* ==========================================================================
   Sidebar
   ========================================================================== */

.sidebar {
  position: relative;
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel-strong);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  border-left: 1px solid var(--border-glass);
  z-index: 15;
  overflow: hidden;
  animation: slideRightFade 0.65s var(--ease) both 0.2s;
}

.sidebar::before {
  content: "";
  position: absolute;
  top: 0; bottom: 0; left: -1px;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--accent-glow) 20%, rgba(34,211,238,0.3) 55%, transparent 90%);
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-glass);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 16px 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-tertiary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.18s var(--ease), border-color 0.25s var(--ease), background 0.25s var(--ease);
}

.tab-btn i { font-size: 15px; }

.tab-btn:hover { color: var(--text-secondary); }

.tab-btn.active {
  color: var(--mint);
  border-bottom-color: var(--mint);
  background: rgba(63, 232, 181, 0.05);
}

.tab-content {
  display: none;
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.tab-content.active {
  display: block;
  animation: slideUpFade 0.4s var(--ease) both;
}

/* ---- Empty state ---- */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 56px 24px;
  color: var(--text-tertiary);
  animation: scaleFade 0.5s var(--ease) both;
}

.empty-state i { animation: softFloat 3.5s ease-in-out infinite; }

.empty-state i {
  font-size: 34px;
  color: var(--text-tertiary);
  opacity: 0.6;
  margin-bottom: 4px;
}

.empty-state h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  max-width: 240px;
}

/* ---- Parcel inspector card ---- */

.parcel-card { animation: slideUpFade 0.45s var(--ease) both; }
.parcel-card .ulpin-banner   { animation: slideUpFade 0.4s var(--ease) both 0.05s; }
.parcel-card .prop-grid      { animation: slideUpFade 0.4s var(--ease) both 0.12s; }
.parcel-card .confidence-meter-container { animation: slideUpFade 0.4s var(--ease) both 0.18s; }
.parcel-card .surveyor-actions { animation: slideUpFade 0.4s var(--ease) both 0.24s; }

.ulpin-banner {
  background: linear-gradient(160deg, rgba(63, 232, 181, 0.12), rgba(34, 211, 238, 0.05));
  border: 1px solid rgba(63, 232, 181, 0.28);
  border-radius: var(--r-md);
  padding: 14px 16px;
  margin-bottom: 18px;
}

.ulpin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.ulpin-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 9px;
  border-radius: var(--r-pill);
  background: rgba(251, 191, 36, 0.16);
  color: var(--status-pending);
  border: 1px solid rgba(251, 191, 36, 0.35);
  transition: background 0.3s var(--ease), color 0.3s var(--ease), border-color 0.3s var(--ease);
  animation: scaleFade 0.3s var(--ease) both;
}
.status-badge.badge-approved {
  background: rgba(52, 211, 153, 0.16);
  color: var(--status-success);
  border-color: rgba(52, 211, 153, 0.35);
}
.status-badge.badge-flagged {
  background: rgba(248, 113, 113, 0.16);
  color: var(--status-danger);
  border-color: rgba(248, 113, 113, 0.35);
}
.status-badge.badge-rejected {
  background: rgba(100, 116, 139, 0.16);
  color: var(--status-rejected);
  border-color: rgba(100, 116, 139, 0.35);
}

.ulpin-code-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ulpin-code {
  font-family: var(--font-mono);
  font-size: 16.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  word-break: break-all;
}

.btn-copy {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-glass);
  background: var(--glass);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.18s var(--ease);
}
.btn-copy:hover { background: var(--glass-hover); color: var(--text-primary); }

.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

.prop-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: var(--glass);
  border: 1px solid var(--border-glass);
  border-radius: var(--r-sm);
  padding: 10px 12px;
  transition: background 0.2s var(--ease), border-color 0.2s var(--ease), transform 0.2s var(--ease);
}
.prop-item:hover {
  background: var(--glass-hover);
  border-color: var(--border-glass-strong);
  transform: translateY(-1px);
}

.prop-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}
.prop-label i { font-size: 12px; }

.prop-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.prop-val.highlight {
  font-family: var(--font-mono);
  color: var(--mint);
}

.confidence-meter-container {
  margin-bottom: 20px;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.meter-header span#detail-confidence-val {
  font-family: var(--font-mono);
  color: var(--mint);
  font-size: 13px;
}

.meter-bar {
  height: 6px;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: var(--r-pill);
  background: var(--accent-gradient);
  box-shadow: 0 0 12px var(--accent-glow);
  transition: width 0.4s var(--ease);
  animation: meterFillIn 0.9s var(--ease) both 0.35s;
}

.surveyor-actions {
  border-top: 1px solid var(--border-glass);
  padding-top: 16px;
}

.surveyor-actions h4 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.action-buttons {
  display: flex;
  gap: 10px;
}

/* ---- Conflicts tab ---- */

.conflicts-header {
  margin-bottom: 16px;
}
.conflicts-header h3 {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.conflicts-header p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary);
}

.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conflict-card {
  position: relative;
  background: var(--glass);
  border: 1px solid var(--border-glass);
  border-left: 3px solid rgba(251, 191, 36, 0.6);
  border-radius: var(--r-sm);
  padding: 13px 14px;
  animation: slideUpFade 0.4s var(--ease) both;
  transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.conflict-card:nth-child(1) { animation-delay: 0.02s; }
.conflict-card:nth-child(2) { animation-delay: 0.08s; }
.conflict-card:nth-child(3) { animation-delay: 0.14s; }
.conflict-card:nth-child(4) { animation-delay: 0.2s; }
.conflict-card:nth-child(5) { animation-delay: 0.26s; }
.conflict-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-glass-strong);
}
.conflict-card.high-severity {
  border-left-color: var(--status-danger);
  background: rgba(248, 113, 113, 0.06);
}

.conflict-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.conflict-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.conflict-severity {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: var(--r-pill);
  flex-shrink: 0;
}
.sev-high {
  background: rgba(248, 113, 113, 0.18);
  color: var(--status-danger);
}
.sev-medium {
  background: rgba(251, 191, 36, 0.18);
  color: var(--status-pending);
}

.conflict-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.conflict-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.btn-resolve {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(63, 232, 181, 0.3);
  background: rgba(63, 232, 181, 0.1);
  color: var(--mint);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s var(--ease);
}
.btn-resolve:hover {
  background: rgba(63, 232, 181, 0.18);
  border-color: rgba(63, 232, 181, 0.5);
  transform: translateY(-1px);
}
.btn-resolve:active { transform: scale(0.97); }

/* ==========================================================================
   Utility animations
   ========================================================================== */

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ==========================================================================
   Responsive
   ========================================================================== */

@media (max-width: 1100px) {
  .kpi-ribbon { display: none; }
  .header-brand { border-right: none; padding-right: 0; }
}

@media (max-width: 880px) {
  .app-header { flex-wrap: wrap; gap: 12px; }
  .header-actions { width: 100%; justify-content: flex-start; }
  .main-workspace { flex-direction: column; }
  .sidebar {
    width: 100%;
    max-height: 46vh;
    border-left: none;
    border-top: 1px solid var(--border-glass);
  }
  .sidebar::before { display: none; }
  .map-overlay-controls { position: absolute; }
  .layer-toggle-group { margin-left: 0; }
}
