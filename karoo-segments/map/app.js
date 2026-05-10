/* Karoo segments — webowy edytor mapy szutrów i asfaltów. */

const STORAGE_KEY = "karoo-segments-v1";
const BURST_GAP_SECONDS = 5;

const KIND_STYLE = {
  gravel: { color: "#c2410c", label: "Szuter" },
  asphalt: { color: "#1d4ed8", label: "Asfalt" },
};
const TIER_WEIGHT = { a: 7, b: 5, c: 3 };
const TIER_LABEL = { a: "A-tier", b: "B-tier", c: "C-tier" };

const state = {
  segments: [], // GeoJSON features
  filters: { kind: new Set(["gravel", "asphalt"]), tier: new Set(["a", "b", "c"]) },
  mode: "view", // view | draw | import
  draw: null, // { kind, tier, name, latlngs: [], previewLine }
  importPreview: null, // { trackLayer, markers: [], bursts: [], doneSet: Set }
};

// ----- map setup -----
const map = L.map("map").setView([52.0, 19.5], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const segmentsLayer = L.layerGroup().addTo(map);
const segmentLayers = new Map(); // id -> Leaflet layer

// ----- persistence -----
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data?.features)) return data.features;
    }
  } catch (e) {}
  return null;
}

function saveToStorage() {
  const fc = { type: "FeatureCollection", features: state.segments };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fc));
}

async function bootstrap() {
  const stored = loadFromStorage();
  if (stored) {
    state.segments = stored;
  } else {
    try {
      const resp = await fetch("segments.geojson", { cache: "no-store" });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.features)) state.segments = data.features;
      }
    } catch (e) {}
  }
  ensureIds();
  renderSegments();
  renderList();
  fitToSegments();
}

function ensureIds() {
  for (const f of state.segments) {
    if (!f.properties) f.properties = {};
    if (!f.properties.id) f.properties.id = crypto.randomUUID();
  }
}

function fitToSegments() {
  if (!state.segments.length) return;
  const fc = { type: "FeatureCollection", features: state.segments };
  const layer = L.geoJSON(fc);
  const bounds = layer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}

// ----- rendering segments -----
function styleFor(feature) {
  const kind = KIND_STYLE[feature.properties.kind] || { color: "#555" };
  return {
    color: kind.color,
    weight: TIER_WEIGHT[feature.properties.tier] || 4,
    opacity: 0.9,
  };
}

function visible(feature) {
  return (
    state.filters.kind.has(feature.properties.kind) &&
    state.filters.tier.has(feature.properties.tier)
  );
}

function renderSegments() {
  segmentsLayer.clearLayers();
  segmentLayers.clear();
  for (const f of state.segments) {
    if (!visible(f)) continue;
    const layer = L.geoJSON(f, { style: styleFor }).addTo(segmentsLayer);
    layer.bindPopup(() => popupHTML(f));
    layer.on("popupopen", () => {
      document.getElementById(`edit-${f.properties.id}`)?.addEventListener("click", () =>
        openEditModal(f)
      );
      document.getElementById(`del-${f.properties.id}`)?.addEventListener("click", () =>
        deleteSegment(f.properties.id)
      );
    });
    segmentLayers.set(f.properties.id, layer);
  }
}

function popupHTML(f) {
  const p = f.properties;
  const km = ((p.distance_m || 0) / 1000).toFixed(2);
  const kindLabel = KIND_STYLE[p.kind]?.label || p.kind;
  const date = (p.recorded_at || p.created_at || "").slice(0, 10);
  return `
    <strong>${escapeHTML(p.name || "(bez nazwy)")}</strong>
    ${kindLabel} &middot; ${TIER_LABEL[p.tier] || p.tier}<br>
    ${km} km${date ? ` &middot; <small>${date}</small>` : ""}
    <div style="margin-top:8px;display:flex;gap:6px">
      <button id="edit-${p.id}" class="btn small">Edytuj</button>
      <button id="del-${p.id}" class="btn small danger">Usuń</button>
    </div>
  `;
}

function renderList() {
  const ul = document.getElementById("seg-list");
  const sorted = [...state.segments].sort((a, b) =>
    (b.properties.recorded_at || b.properties.created_at || "").localeCompare(
      a.properties.recorded_at || a.properties.created_at || ""
    )
  );
  ul.innerHTML = "";
  for (const f of sorted) {
    if (!visible(f)) continue;
    const p = f.properties;
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="seg-tag tier-${p.tier}">${p.tier?.toUpperCase() || "?"}</span>
      <span class="seg-name">${escapeHTML(p.name || "(bez nazwy)")}</span>
      <span class="seg-kind">${KIND_STYLE[p.kind]?.label || ""}</span>
    `;
    li.addEventListener("click", () => focusSegment(p.id));
    ul.appendChild(li);
  }
  document.getElementById("seg-count").textContent = state.segments.length;
}

function focusSegment(id) {
  const layer = segmentLayers.get(id);
  if (!layer) return;
  map.fitBounds(layer.getBounds(), { padding: [60, 60] });
  layer.openPopup();
}

// ----- helpers -----
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function lineDistance(latlngs) {
  let d = 0;
  for (let i = 1; i < latlngs.length; i++) d += haversineM(latlngs[i - 1], latlngs[i]);
  return d;
}

function clickCountToTier(n) {
  if (n >= 3) return "a";
  if (n === 2) return "b";
  return "c";
}

// ----- segments CRUD -----
function addSegment({ kind, tier, name, latlngs, recordedAt, extra = {} }) {
  const feature = {
    type: "Feature",
    properties: {
      id: crypto.randomUUID(),
      name,
      kind,
      tier,
      distance_m: Math.round(lineDistance(latlngs)),
      recorded_at: recordedAt || null,
      created_at: new Date().toISOString(),
      ...extra,
    },
    geometry: {
      type: "LineString",
      coordinates: latlngs.map(([lat, lng]) => [lng, lat]),
    },
  };
  state.segments.push(feature);
  saveToStorage();
  renderSegments();
  renderList();
  return feature;
}

function updateSegment(id, updates) {
  const f = state.segments.find((x) => x.properties.id === id);
  if (!f) return;
  Object.assign(f.properties, updates);
  saveToStorage();
  renderSegments();
  renderList();
}

function deleteSegment(id) {
  if (!confirm("Usunąć ten segment?")) return;
  state.segments = state.segments.filter((f) => f.properties.id !== id);
  saveToStorage();
  renderSegments();
  renderList();
}

// ----- modal -----
function openModal({ title, body, actions }) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = body;
  const actionsEl = document.getElementById("modal-actions");
  actionsEl.innerHTML = "";
  for (const a of actions) {
    const btn = document.createElement("button");
    btn.className = "btn " + (a.variant || "");
    btn.textContent = a.label;
    btn.addEventListener("click", () => a.onClick());
    actionsEl.appendChild(btn);
  }
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
}

function segmentFormHTML({ kind = "gravel", tier = "a", name = "" } = {}) {
  const kindRow = ["gravel", "asphalt"]
    .map(
      (k) =>
        `<div class="choice ${k === kind ? "selected" : ""}" data-field="kind" data-value="${k}">${KIND_STYLE[k].label}</div>`
    )
    .join("");
  const tierRow = ["a", "b", "c"]
    .map(
      (t) =>
        `<div class="choice tier-${t} ${t === tier ? "selected" : ""}" data-field="tier" data-value="${t}">${t.toUpperCase()}</div>`
    )
    .join("");
  return `
    <label>Nawierzchnia</label>
    <div class="choice-row" data-group="kind">${kindRow}</div>
    <label>Tier</label>
    <div class="choice-row" data-group="tier">${tierRow}</div>
    <label>Nazwa</label>
    <input type="text" id="seg-name" value="${escapeHTML(name)}" placeholder="np. Stary trakt na Łysą Górę" />
  `;
}

function wireModalChoices() {
  document.querySelectorAll(".choice-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      const c = e.target.closest(".choice");
      if (!c || !row.contains(c)) return;
      row.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    });
  });
}

function readForm() {
  const get = (group) =>
    document
      .querySelector(`.choice-row[data-group="${group}"] .choice.selected`)
      ?.dataset.value;
  return {
    kind: get("kind"),
    tier: get("tier"),
    name: document.getElementById("seg-name").value.trim(),
  };
}

// ----- draw mode -----
function startDrawMode() {
  if (state.mode !== "view") return;
  openModal({
    title: "Nowy segment — wybierz parametry",
    body: segmentFormHTML(),
    actions: [
      { label: "Anuluj", variant: "ghost", onClick: closeModal },
      {
        label: "Rysuj na mapie",
        variant: "primary",
        onClick: () => {
          const { kind, tier, name } = readForm();
          if (!kind || !tier) { alert("Wybierz nawierzchnię i tier."); return; }
          closeModal();
          beginDrawing({ kind, tier, name });
        },
      },
    ],
  });
  wireModalChoices();
}

function beginDrawing({ kind, tier, name }) {
  state.mode = "draw";
  state.draw = {
    kind,
    tier,
    name,
    latlngs: [],
    previewLine: L.polyline([], {
      color: KIND_STYLE[kind].color,
      weight: TIER_WEIGHT[tier],
      opacity: 0.7,
      dashArray: "6 6",
    }).addTo(map),
  };
  document.getElementById("draw-banner").classList.remove("hidden");
  document.getElementById("draw-banner-text").textContent =
    `Rysowanie: ${KIND_STYLE[kind].label} / ${TIER_LABEL[tier]}. Klikaj punkty, dbl-klik = koniec.`;
  map.getContainer().style.cursor = "crosshair";
  map.on("click", onDrawClick);
  map.on("dblclick", onDrawDouble);
  map.doubleClickZoom.disable();
}

function onDrawClick(e) {
  if (!state.draw) return;
  state.draw.latlngs.push([e.latlng.lat, e.latlng.lng]);
  state.draw.previewLine.setLatLngs(state.draw.latlngs);
}

function onDrawDouble(e) {
  e.originalEvent.preventDefault();
  finishDrawing();
}

function finishDrawing() {
  if (!state.draw) return;
  const { kind, tier, name, latlngs } = state.draw;
  cleanupDrawing();
  if (latlngs.length < 2) {
    alert("Segment musi mieć co najmniej 2 punkty.");
    return;
  }
  const finalName = name || `${KIND_STYLE[kind].label} ${tier.toUpperCase()} ${new Date().toISOString().slice(0,10)}`;
  addSegment({ kind, tier, name: finalName, latlngs });
}

function cancelDrawing() {
  cleanupDrawing();
}

function cleanupDrawing() {
  if (state.draw?.previewLine) map.removeLayer(state.draw.previewLine);
  state.draw = null;
  state.mode = "view";
  document.getElementById("draw-banner").classList.add("hidden");
  map.getContainer().style.cursor = "";
  map.off("click", onDrawClick);
  map.off("dblclick", onDrawDouble);
  map.doubleClickZoom.enable();
}

// ----- edit modal -----
function openEditModal(feature) {
  const p = feature.properties;
  openModal({
    title: "Edytuj segment",
    body: segmentFormHTML({ kind: p.kind, tier: p.tier, name: p.name }),
    actions: [
      { label: "Anuluj", variant: "ghost", onClick: closeModal },
      {
        label: "Zapisz",
        variant: "primary",
        onClick: () => {
          const { kind, tier, name } = readForm();
          if (!kind || !tier) return;
          updateSegment(p.id, { kind, tier, name });
          closeModal();
        },
      },
    ],
  });
  wireModalChoices();
}

// ----- FIT import -----
async function handleFitFile(file) {
  const buf = await file.arrayBuffer();
  const parser = new FitParser({
    force: true,
    speedUnit: "km/h",
    lengthUnit: "m",
    elapsedRecordField: true,
  });
  parser.parse(buf, (err, data) => {
    if (err) {
      alert("Nie udało się sparsować pliku FIT: " + err);
      return;
    }
    startFitImport(data, file.name);
  });
}

function startFitImport(data, fileName) {
  cancelFitImport();
  const records = (data.records || []).filter(
    (r) => r.position_lat != null && r.position_long != null && r.timestamp
  );
  if (records.length < 2) {
    alert("Brak punktów GPS w tym pliku FIT.");
    return;
  }
  const laps = (data.laps || []).map((l) => new Date(l.start_time || l.timestamp));
  laps.sort((a, b) => a - b);
  const bursts = clusterBursts(laps, BURST_GAP_SECONDS * 1000);

  const trackLatlngs = records.map((r) => [r.position_lat, r.position_long]);
  const trackLayer = L.polyline(trackLatlngs, {
    color: "#0ea5e9",
    weight: 4,
    opacity: 0.5,
    dashArray: "4 6",
  }).addTo(map);

  map.fitBounds(trackLayer.getBounds(), { padding: [40, 40] });

  const markers = [];
  const burstInfo = bursts.map((b, idx) => {
    const at = findRecordAt(records, b.time);
    const tier = clickCountToTier(b.clicks);
    const segmentRecords = sliceRecordsBetween(
      records,
      idx === 0 ? null : bursts[idx - 1].time,
      b.time
    );
    return { ...b, idx, tier, point: at, segmentRecords };
  });

  for (const info of burstInfo) {
    if (!info.point) continue;
    const icon = L.divIcon({
      className: "",
      html: `<div class="burst-marker">${info.idx + 1}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const m = L.marker([info.point.position_lat, info.point.position_long], { icon })
      .addTo(map)
      .on("click", () => openBurstModal(info, m));
    markers.push(m);
  }

  state.importPreview = { trackLayer, markers, burstInfo, fileName };
  state.mode = "import";
  document.getElementById("import-banner").classList.remove("hidden");
  document.getElementById("import-banner-text").textContent =
    `Import: ${fileName} — ${bursts.length} burstów, kliknij numery na mapie.`;
}

function clusterBursts(laps, gapMs) {
  const out = [];
  for (const t of laps) {
    if (out.length && t - out[out.length - 1].time <= gapMs) {
      out[out.length - 1].clicks += 1;
    } else {
      out.push({ time: t, clicks: 1 });
    }
  }
  return out;
}

function findRecordAt(records, time) {
  let best = null;
  let bestDiff = Infinity;
  for (const r of records) {
    const d = Math.abs(new Date(r.timestamp) - time);
    if (d < bestDiff) { best = r; bestDiff = d; }
  }
  return best;
}

function sliceRecordsBetween(records, fromTime, toTime) {
  return records.filter((r) => {
    const t = new Date(r.timestamp);
    return (!fromTime || t > fromTime) && t <= toTime;
  });
}

function openBurstModal(info, marker) {
  const recs = info.segmentRecords;
  const km = recs.length > 1
    ? lineDistance(recs.map((r) => [r.position_lat, r.position_long])) / 1000
    : 0;
  const defaultName = `${new Date(info.time).toISOString().slice(0, 10)} — burst ${info.idx + 1}`;
  const stats = `Burst #${info.idx + 1} · ${info.clicks}× lap · sugerowany ${TIER_LABEL[info.tier]} · długość fragmentu ~${km.toFixed(2)} km`;
  openModal({
    title: "Zapisz fragment z FIT",
    body: `
      <p style="font-size:12px;color:#6b7280;margin:0 0 8px">${stats}</p>
      ${segmentFormHTML({ kind: "gravel", tier: info.tier, name: defaultName })}
    `,
    actions: [
      { label: "Pomiń", variant: "ghost", onClick: () => {
        marker.getElement()?.querySelector(".burst-marker")?.classList.add("skipped");
        closeModal();
      }},
      {
        label: "Zapisz",
        variant: "primary",
        onClick: () => {
          const { kind, tier, name } = readForm();
          if (!kind || !tier || recs.length < 2) { alert("Wybierz nawierzchnię/tier."); return; }
          addSegment({
            kind,
            tier,
            name: name || defaultName,
            latlngs: recs.map((r) => [r.position_lat, r.position_long]),
            recordedAt: new Date(recs[0].timestamp).toISOString(),
            extra: { source: "fit", source_file: state.importPreview?.fileName, clicks: info.clicks },
          });
          marker.getElement()?.querySelector(".burst-marker")?.classList.add("handled");
          closeModal();
        },
      },
    ],
  });
  wireModalChoices();
}

function cancelFitImport() {
  if (!state.importPreview) return;
  map.removeLayer(state.importPreview.trackLayer);
  state.importPreview.markers.forEach((m) => map.removeLayer(m));
  state.importPreview = null;
  state.mode = "view";
  document.getElementById("import-banner").classList.add("hidden");
}

// ----- export / import .geojson -----
function exportGeojson() {
  const fc = { type: "FeatureCollection", features: state.segments };
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `segments-${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importGeojsonFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      alert("To nie wygląda na FeatureCollection.");
      return;
    }
    if (!confirm(`Dodać ${data.features.length} segmentów do bazy?`)) return;
    for (const f of data.features) {
      if (!f.properties) f.properties = {};
      if (!f.properties.id) f.properties.id = crypto.randomUUID();
      state.segments.push(f);
    }
    saveToStorage();
    renderSegments();
    renderList();
    fitToSegments();
  } catch (e) {
    alert("Błąd importu: " + e.message);
  }
}

// ----- wire up -----
document.getElementById("draw-btn").addEventListener("click", startDrawMode);
document.getElementById("draw-finish").addEventListener("click", finishDrawing);
document.getElementById("draw-cancel").addEventListener("click", cancelDrawing);
document.getElementById("export-btn").addEventListener("click", exportGeojson);
document.getElementById("import-close").addEventListener("click", cancelFitImport);

document.getElementById("fit-input").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) handleFitFile(f);
  e.target.value = "";
});

document.getElementById("geojson-input").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) importGeojsonFile(f);
  e.target.value = "";
});

document.querySelectorAll("[data-filter-kind]").forEach((cb) => {
  cb.addEventListener("change", () => {
    const k = cb.dataset.filterKind;
    cb.checked ? state.filters.kind.add(k) : state.filters.kind.delete(k);
    renderSegments();
    renderList();
  });
});

document.querySelectorAll("[data-filter-tier]").forEach((cb) => {
  cb.addEventListener("change", () => {
    const t = cb.dataset.filterTier;
    cb.checked ? state.filters.tier.add(t) : state.filters.tier.delete(t);
    renderSegments();
    renderList();
  });
});

document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

bootstrap();
