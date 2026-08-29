# Cadastral AI Mapper — Hackathon Live Demo Script

**Event:** Smart India Hackathon 2026  
**Time Limit:** 5 Minutes  
**Objective:** Demonstrate AI-enabled cadastral boundary extraction, automated ULPIN assignment, live topology conflict detection, and one-click surveyor arbitration.

---

## Act 1: The Problem & Vision (0:00 – 1:00)

1. **Opening Statement:**
   > *"Good morning, esteemed jury members. Over 60% of civil litigation in Indian courts stems from land disputes, boundary overlaps, and outdated paper cadastral records. Under the Digital India Land Records Modernization Programme (DILRMP), assigning a Unique Land Parcel Identification Number (ULPIN) to every parcel is a national priority. Today, we present **Cadastral AI Mapper** — an automated, AI-powered cadastral mapping and topology arbitration platform."*

2. **Highlight Core Pillars:**
   - Pretrained AI Footprint Segmentation (Meta SAM + High-Precision CV).
   - Geometric Topology Engine (Automatic overlap and sliver detection).
   - Automated 14-Digit ULPIN Generation based on centroid geohashes.
   - Real-time Surveyor Decision Dashboard.

---

## Act 2: Live Map & Parcel Inspection (1:00 – 2:15)

1. **Show the Web Dashboard (`http://localhost:3000`):**
   - Point out the dark glassmorphic UI, live KPI ribbon (Total Parcels, Surveyed Area in Hectares, Active Conflicts, AI Confidence Score).
   - Demonstrate the high-resolution satellite basemap overlay with cadastral parcel boundaries.

2. **Inspect an Approved Parcel:**
   - Click on `PARCEL-KA-BLR-001`.
   - Show the **Parcel Inspector Sidebar**:
     - 14-digit ULPIN: `29-572-0012-9841` (Highlight state code `29` for Karnataka, district code `572` for Bengaluru).
     - Accurate calculated metric area (`482.5 m²` / `11.92 Cents`) and perimeter.
     - Click the "Copy ULPIN" button to demonstrate clipboard integration.

---

## Act 3: AI Boundary Extraction & ULPIN Generation (2:15 – 3:30)

1. **Trigger AI Segmentation:**
   - Click the **"Extract Footprints"** button on the top header.
   - Explain to jury:
     > *"Our pipeline ingests the drone/satellite orthomosaic, executes deep segmentation via SAM, applies Douglas-Peucker polygon simplification, projects coordinates to EPSG:4326, computes area metrics in EPSG:3857, and automatically assigns a verified 14-digit ULPIN."*
   - Point out the newly generated candidate parcels appearing in amber ("Pending" status) on the map.

---

## Act 4: Topology Conflict Detection & Auto-Resolution (3:30 – 4:30)

1. **Highlight the Dispute:**
   - Switch to the **"Conflicts"** tab on the sidebar.
   - Click on `CONF-001` (Overlap Dispute between Survey No `103/A` and `103/B`).
   - Notice the flashing red overlap polygon rendered between the two parcels on the map.

2. **One-Click Arbitration:**
   - Click the **"Auto-Clip Boundary Overlap"** button.
   - Watch the backend compute the geometric difference in real-time, recalculate parcel areas, eliminate the overlap, and mark the parcels as resolved!
   - Show the conflicts counter drop to zero in the KPI ribbon.

---

## Act 5: Surveyor Approval & Data Export (4:30 – 5:00)

1. **Approve Parcel:**
   - Select the resolved parcel and click **"Approve"**.
   - The polygon turns crisp Emerald Green.

2. **Export Dataset:**
   - Click **"Export"** to download the finalized, validated cadastral GeoJSON dataset ready for ingestion into state land revenue databases (e.g. Karnataka Bhoomi / MahaBhumi).

3. **Closing Remark:**
   > *"Cadastral AI Mapper accelerates land survey workflows from months to seconds, eliminating boundary litigation before it even begins. Thank you!"*
