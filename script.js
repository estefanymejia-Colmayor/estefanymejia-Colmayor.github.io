// =============================
// PROYECCIÓN EPSG:9377
// =============================
proj4.defs("EPSG:9377",
  "+proj=tmerc +lat_0=4.0 +lon_0=-73.0 +k=0.9992 +x_0=5000000 +y_0=2000000 " +
  "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);

function wgs84A9377(lng, lat) {
  return proj4("EPSG:4326", "EPSG:9377", [lng, lat]);
}

// =============================
// MAPA
// =============================
var map = L.map('map').setView([6.28, -75.54], 15);

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
var satelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri' }
);
var topografico = L.tileLayer(
  'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  { maxZoom: 17, attribution: '© OpenTopoMap' }
);
osm.addTo(map);

// =============================
// DIBUJO
// =============================
var drawnItems = new L.FeatureGroup().addTo(map);
var drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems } });
map.addControl(drawControl);
map.on('draw:created', function(e) { drawnItems.addLayer(e.layer); });

// =============================
// VARIABLES
// =============================
var anioSeleccionado = null;
var capasGeoJSON = {};
var capasLeaflet = {};
var controlCapas;

// =============================
// TABLA
// =============================
function llenarTabla(data) {
  let cont = document.getElementById("tablaContenido");
  if (!cont) return;
  cont.innerHTML = "";
  if (!data.features.length) { cont.innerHTML = "<p>No hay datos</p>"; return; }
  let columnas = Object.keys(data.features[0].properties);
  let html = "<table><thead><tr>";
  columnas.forEach(c => html += `<th>${c}</th>`);
  html += "</tr></thead><tbody>";
  data.features.forEach((f, index) => {
    html += `<tr data-index="${index}">`;
    columnas.forEach(c => { html += `<td>${f.properties[c] ?? ""}</td>`; });
    html += "</tr>";
  });
  html += "</tbody></table>";
  cont.innerHTML = html;
  cont.querySelectorAll("tbody tr").forEach(fila => {
    fila.addEventListener("click", function () {
      let i = this.getAttribute("data-index");
      let geo = L.geoJSON(data.features[i]);
      map.fitBounds(geo.getBounds());
    });
  });
}

// =============================
// DASHBOARD
// =============================
function llenarDashboard(data) {
  var cont = document.getElementById("dashboardContenido");
  if (!cont) return;
  var features = data.features;
  var porAnio = {
    2005: { areaConst:0, areaVerde:0, viviendas:0 },
    2010: { areaConst:0, areaVerde:0, viviendas:0 },
    2020: { areaConst:0, areaVerde:0, viviendas:0 },
    2025: { areaConst:0, areaVerde:0, viviendas:0 }
  };
  var totalAreaConst = 0, totalAreaVerde = 0, totalViviendas = 0;

  features.forEach(function(f) {
    var anio = f.properties["Año"];
    var tipo = (f.properties["Tipo"] || "").toLowerCase();
    var area = parseFloat(f.properties["Aream2"] || f.properties["Shape_Area"] || 0);
    if (!porAnio[anio]) return;
    if (tipo.includes("verde")) {
      porAnio[anio].areaVerde += area;
      totalAreaVerde += area;
    } else if (tipo === "vivienda") {
      porAnio[anio].viviendas++;
      totalViviendas++;
    } else if (tipo.includes("poligono") || tipo.includes("polígono")) {
      porAnio[anio].areaConst += area;
      totalAreaConst += area;
    }
  });

  var anios = [2005, 2010, 2020, 2025];
  var maxArea = Math.max.apply(null, anios.map(function(a){ return porAnio[a].areaConst + porAnio[a].areaVerde; }));

  function fmt(n) {
    if (n >= 1000000) return (n/1000000).toFixed(2) + ' km²';
    if (n >= 1000)    return (n/1000).toFixed(1) + ' k m²';
    return Math.round(n) + ' m²';
  }

  var areaBase  = porAnio[2005].areaConst;
  var areaFinal = porAnio[2025].areaConst;
  var crecConst = areaBase > 0 ? (((areaFinal - areaBase) / areaBase) * 100).toFixed(1) : null;

  var verdeBase  = porAnio[2005].areaVerde;
  var verdeFinal = porAnio[2025].areaVerde;
  var crecVerde  = verdeBase > 0 ? (((verdeFinal - verdeBase) / verdeBase) * 100).toFixed(1) : null;

  var constColor = (parseFloat(crecConst) >= 0) ? '#e74c3c' : '#27ae60';
  var constIcono = (parseFloat(crecConst) >= 0) ? '↑' : '↓';
  var verdeColor = (parseFloat(crecVerde) >= 0) ? '#27ae60' : '#e74c3c';
  var verdeIcono = (parseFloat(crecVerde) >= 0) ? '↑' : '↓';

  // Construir barras
  var barras = '';
  anios.forEach(function(a) {
    var pctConst = maxArea > 0 ? (porAnio[a].areaConst / maxArea * 100).toFixed(1) : 0;
    var pctVerde = maxArea > 0 ? (porAnio[a].areaVerde / maxArea * 100).toFixed(1) : 0;
    var activo   = anioSeleccionado == a ? 'db-bar-row--active' : '';
    barras += '<div class="db-bar-row ' + activo + '">' +
      '<div class="db-bar-label">' + a + '</div>' +
      '<div class="db-bar-stack">' +
        '<div class="db-bar-seg db-bar-const" style="width:' + pctConst + '%"></div>' +
        '<div class="db-bar-seg db-bar-verde" style="width:' + pctVerde + '%"></div>' +
      '</div>' +
      '<div class="db-bar-val">' + fmt(porAnio[a].areaConst + porAnio[a].areaVerde) + '</div>' +
    '</div>';
  });

  // Construir filas detalle
  var filas = '';
  anios.forEach(function(a) {
    var activo = anioSeleccionado == a ? 'db-ta-row--active' : '';
    filas += '<div class="db-ta-row ' + activo + '">' +
      '<span><b>' + a + '</b></span>' +
      '<span>' + fmt(porAnio[a].areaConst) + '</span>' +
      '<span>' + fmt(porAnio[a].areaVerde) + '</span>' +
      '<span>' + porAnio[a].viviendas + '</span>' +
    '</div>';
  });

  cont.innerHTML =
    '<div class="db-wrap">' +

      '<div class="db-kpis">' +
        '<div class="db-kpi db-kpi--blue">' +
          '<div class="db-kpi-icon">🏙️</div>' +
          '<div class="db-kpi-val">' + fmt(totalAreaConst) + '</div>' +
          '<div class="db-kpi-label">Área construida total</div>' +
        '</div>' +
        '<div class="db-kpi db-kpi--green">' +
          '<div class="db-kpi-icon">🌿</div>' +
          '<div class="db-kpi-val">' + fmt(totalAreaVerde) + '</div>' +
          '<div class="db-kpi-label">Zonas verdes totales</div>' +
        '</div>' +
        '<div class="db-kpi db-kpi--gray">' +
          '<div class="db-kpi-icon">🏠</div>' +
          '<div class="db-kpi-val">' + totalViviendas + '</div>' +
          '<div class="db-kpi-label">Viviendas identificadas</div>' +
        '</div>' +
        '<div class="db-kpi db-kpi--orange">' +
          '<div class="db-kpi-icon">📦</div>' +
          '<div class="db-kpi-val">' + features.length + '</div>' +
          '<div class="db-kpi-label">Registros totales</div>' +
        '</div>' +
      '</div>' +

      '<div class="db-section-title">📈 Cambio 2005 → 2025</div>' +
      '<div class="db-cambios">' +
        '<div class="db-cambio-row">' +
          '<span class="db-cambio-label">🏗️ Construcciones</span>' +
          '<span class="db-cambio-val" style="color:' + constColor + '">' + constIcono + ' ' + Math.abs(crecConst) + '%</span>' +
          '<span class="db-cambio-sub">' + fmt(areaBase) + ' → ' + fmt(areaFinal) + '</span>' +
        '</div>' +
        '<div class="db-cambio-row">' +
          '<span class="db-cambio-label">🌿 Zonas verdes</span>' +
          '<span class="db-cambio-val" style="color:' + verdeColor + '">' + verdeIcono + ' ' + Math.abs(crecVerde) + '%</span>' +
          '<span class="db-cambio-sub">' + fmt(verdeBase) + ' → ' + fmt(verdeFinal) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="db-section-title">📊 Área por año</div>' +
      '<div class="db-bars">' + barras + '</div>' +
      '<div class="db-leyenda">' +
        '<span class="db-ley-dot" style="background:#e74c3c"></span> Construcciones ' +
        '<span class="db-ley-dot" style="background:#2ecc71; margin-left:8px"></span> Zonas verdes ' +
        '<span class="db-ley-dot" style="background:#3498db; margin-left:8px"></span> Viviendas' +
      '</div>' +

      '<div class="db-section-title">🗓️ Detalle por año</div>' +
      '<div class="db-tabla-anios">' +
        '<div class="db-ta-head"><span>Año</span><span>Construido</span><span>Verde</span><span>Viviendas</span></div>' +
        filas +
      '</div>' +

    '</div>';
}


// =============================
// POPUP MEJORADO EVOLUCIÓN
// =============================
function mostrarPopupEvolucion(feature, latlng) {
  let p = feature.properties;
  let tipo = (p["Tipo"] || "").toLowerCase();
  let esVerde = tipo.includes("verde");
  let anio = p["Año"] || "—";
  let area = parseFloat(p["Aream2"] || p["Shape_Area"] || 0);
  let fmt = n => n >= 10000 ? (n / 10000).toFixed(4) + ' ha' : Math.round(n) + ' m²';

  // Convertir centroide a EPSG:9377
  let coords9377 = wgs84A9377(latlng.lng, latlng.lat);
  let e = coords9377[0].toFixed(2);
  let n = coords9377[1].toFixed(2);

  // Crecimiento respecto al año anterior
  let anios = [2005, 2010, 2020, 2025];
  let idx = anios.indexOf(parseInt(anio));
  let evolucionHtml = '';
  if (idx > 0 && capasGeoJSON['evolucion']) {
    let anioAnt = anios[idx - 1];
    let featuresAnt = capasGeoJSON['evolucion'].features.filter(f =>
      f.properties["Año"] == anioAnt && (f.properties["Tipo"] || "").toLowerCase().includes(esVerde ? "verde" : "poligono")
    );
    let areaAnt = featuresAnt.reduce((s, f) => s + parseFloat(f.properties["Aream2"] || 0), 0);
    let featuresAct = capasGeoJSON['evolucion'].features.filter(f =>
      f.properties["Año"] == anio && (f.properties["Tipo"] || "").toLowerCase().includes(esVerde ? "verde" : "poligono")
    );
    let areaAct = featuresAct.reduce((s, f) => s + parseFloat(f.properties["Aream2"] || 0), 0);
    let diff = areaAct - areaAnt;
    let pct = areaAnt > 0 ? ((diff / areaAnt) * 100).toFixed(1) : null;
    if (pct !== null) {
      let color = diff >= 0 ? '#27ae60' : '#e74c3c';
      let icon = diff >= 0 ? '↑' : '↓';
      evolucionHtml = `
        <div class="pevo-cambio">
          <span class="pevo-cambio-label">Cambio vs ${anioAnt}</span>
          <span class="pevo-cambio-val" style="color:${color}">${icon} ${Math.abs(pct)}% (${fmt(Math.abs(diff))})</span>
        </div>`;
    }
  }

  let colorBadge = esVerde ? '#27ae60' : (
    anio == 2005 ? '#b8860b' : anio == 2010 ? '#e6a817' : anio == 2020 ? '#e07b39' : '#c0392b'
  );

  let popup = document.getElementById("popupEvolucion");
  let header = document.getElementById("popupTipo");
  let body = document.getElementById("popupBody");

  header.innerHTML = `<span class="pevo-badge" style="background:${colorBadge}">${esVerde ? '🌿 Zona Verde' : '🏗️ Construcción'}</span> <span class="pevo-anio">Año ${anio}</span>`;

  body.innerHTML = `
    <div class="pevo-grid">
      <div class="pevo-item">
        <div class="pevo-item-label">Área</div>
        <div class="pevo-item-val">${fmt(area)}</div>
      </div>
      <div class="pevo-item">
        <div class="pevo-item-label">Tipo</div>
        <div class="pevo-item-val">${p["Tipo"] || "—"}</div>
      </div>
      <div class="pevo-item">
        <div class="pevo-item-label">OBJECTID</div>
        <div class="pevo-item-val">${p["OBJECTID"] || "—"}</div>
      </div>
      <div class="pevo-item">
        <div class="pevo-item-label">Perím. (m)</div>
        <div class="pevo-item-val">${p["lenght"] ? parseFloat(p["lenght"]).toFixed(1) : "—"}</div>
      </div>
    </div>

    <div class="pevo-coords">
      <div class="pevo-coords-title">📍 Coordenadas del punto — EPSG:9377</div>
      <div class="pevo-coords-row"><span>Este (E):</span><b>${e} m</b></div>
      <div class="pevo-coords-row"><span>Norte (N):</span><b>${n} m</b></div>
      <div class="pevo-coords-row"><span>Sistema:</span><b>MAGNA-SIRGAS / Colombia Bogotá Zone</b></div>
      <div class="pevo-coords-row"><span>WGS84:</span><b>${latlng.lat.toFixed(6)}°, ${latlng.lng.toFixed(6)}°</b></div>
    </div>

    ${evolucionHtml}
  `;

  popup.style.display = "block";
}

function cerrarPopup() {
  document.getElementById("popupEvolucion").style.display = "none";
}

// =============================
// TOGGLES
// =============================
function toggleTabla() {
  let t = document.getElementById("tablaAtributos");
  t.style.display = (t.style.display === "none") ? "block" : "none";
}
function toggleDashboard() {
  let d = document.getElementById("dashboard");
  let cont = document.getElementById("dashboardContenido");
  if (d.style.display === "none") {
    d.style.display = "flex";
    // forzar altura y scroll directo por JS, sin depender del CSS
    let panelH = document.getElementById("panelInferior").offsetHeight;
    d.style.height = (panelH - 16) + "px";
    cont.style.overflowY = "auto";
    cont.style.flex = "1";
    cont.style.minHeight = "0";
  } else {
    d.style.display = "none";
  }
}
function maximizarTabla() {
  document.getElementById("tablaAtributos").classList.toggle("grande");
}

// =============================
// EVOLUCIÓN MAPA
// =============================
function actualizarEvolucionMapa() {
  if (!capasGeoJSON['evolucion']) return;
  if (capasLeaflet['evolucion']) map.removeLayer(capasLeaflet['evolucion']);

  let features = capasGeoJSON['evolucion'].features.filter(f =>
    anioSeleccionado ? f.properties["Año"] == anioSeleccionado : true
  );

  let layer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: function (f) {
      let a = f.properties["Año"];
      let tipo = (f.properties["Tipo"] || "").toLowerCase();

      // 🟢 Zonas verdes — verde
      if (tipo.includes("verde")) return { fillColor: '#2ecc71', color: '#1a7a40', weight: 2, fillOpacity: 0.45 };

      // 🔵 Viviendas individuales — azul cielo, claramente diferente a construcciones y zonas verdes
      if (tipo === "vivienda") return { fillColor: '#3498db', color: '#1a5276', weight: 2, fillOpacity: 0.8, dashArray: '4,3' };

      // Polígono general de construcciones — colores más saturados por año
      let color = a == 2005 ? '#f4d03f' : a == 2010 ? '#e67e22' : a == 2020 ? '#c0392b' : a == 2025 ? '#7b241c' : '#1a5ff3';
      return { fillColor: color, color: '#222', weight: 2, fillOpacity: 0.6 };
    },
    onEachFeature: function (f, l) {
      l.on('click', function (e) {
        mostrarPopupEvolucion(f, e.latlng);
        L.DomEvent.stopPropagation(e);
      });
    }
  });

  capasLeaflet['evolucion'] = layer;
  layer.addTo(map);
  layer.bringToFront();
  reconstruirControl();
}

// Cerrar popup al hacer clic en el mapa
map.on('click', function() { cerrarPopup(); });

// =============================
// CONTROL CAPAS
// =============================
function reconstruirControl() {
  if (controlCapas) map.removeControl(controlCapas);
  let baseMaps = { "Mapa (Calles)": osm, "Satélite": satelite, "Topográfico": topografico };
  let overlays = {};
  capasConfig.forEach(c => { overlays[c.nombre] = capasLeaflet[c.key]; });
  controlCapas = L.control.layers(baseMaps, overlays, { collapsed: false, position: 'bottomright' }).addTo(map);
}

// =============================
// CONFIG
// =============================
var capasConfig = [
  { key: 'barrio',    nombre: 'Barrio María Cano', url: 'data/Limite_Maria_cano5.geojson', estilo: { color: 'blue' } },
  { key: 'expansion', nombre: 'Expansión',          url: 'data/Expansion.json',             estilo: { color: '#FF5733' } },
  { key: 'evolucion', nombre: 'Evolución Urbana',   url: 'data/Evolucion_Urbana.geojson',   estilo: { color: '#000' } }
];

// =============================
// ORTOIMÁGENES
// =============================
var bounds = [[6.276085, -75.548253], [6.287580, -75.528547]];
var orto2005 = L.imageOverlay('data/Mariacano_2005_ProjectRas.jpg', bounds, { opacity: 1 });
var orto2010 = L.imageOverlay('data/Mariacano_2010_ProjectRas.jpg', bounds, { opacity: 1 });
var orto2020 = L.imageOverlay('data/Mariacano_2020_ProjectRas.jpg', bounds, { opacity: 1 });
var orto2025 = L.imageOverlay('data/Mariacano_2025_ProjectRas.jpg', bounds, { opacity: 1 });

// =============================
// SLIDER
// =============================
var labels = ["2005", "2010", "2020", "2025"];
var ortoUrls = [
  'data/Mariacano_2005_ProjectRas.jpg',
  'data/Mariacano_2010_ProjectRas.jpg',
  'data/Mariacano_2020_ProjectRas.jpg',
  'data/Mariacano_2025_ProjectRas.jpg'
];
var ortoSliderLayer = null;

function cambiarOrto(index) {
  if (ortoSliderLayer && map.hasLayer(ortoSliderLayer)) map.removeLayer(ortoSliderLayer);
  ortoSliderLayer = L.imageOverlay(ortoUrls[index], bounds, { opacity: 1 });
  ortoSliderLayer.addTo(map);

  let anio = labels[index];
  let label = document.getElementById("timeLabel");
  if (label) label.innerText = anio;

  anioSeleccionado = anio;
  actualizarEvolucionMapa();

  let sel = document.getElementById("selectorCapa");
  if (sel && sel.value === 'evolucion') cambiarTabla();
  if (capasGeoJSON['evolucion']) llenarDashboard(capasGeoJSON['evolucion']);

  let filtroAnio = document.getElementById("filtroAnio");
  if (filtroAnio) filtroAnio.value = anio;

  cerrarPopup();
}

// =============================
// CARGA
// =============================
function cargarCapas() {
  let selector = document.getElementById("selectorCapa");
  capasConfig.forEach(cfg => {
    fetch(cfg.url).then(r => r.json()).then(data => {
      capasGeoJSON[cfg.key] = data;
      let layer = L.geoJSON(data, {
        style: function () { return { color: cfg.estilo.color, weight: 2, fillColor: cfg.estilo.color, fillOpacity: 0.3 }; },
        onEachFeature: function (feature, layer) {
          let html = "<b>Información:</b><br>";
          for (let k in feature.properties) html += `<b>${k}:</b> ${feature.properties[k]}<br>`;
          layer.bindPopup(html);
        }
      });
      capasLeaflet[cfg.key] = layer;
      if (cfg.key !== 'evolucion') layer.addTo(map);
      if (selector) {
        let opt = document.createElement("option");
        opt.value = cfg.key; opt.text = cfg.nombre;
        selector.appendChild(opt);
      }
      if (Object.keys(capasGeoJSON).length === capasConfig.length) {
        selector.value = capasConfig[0].key;
        llenarTabla(capasGeoJSON[capasConfig[0].key]);
        llenarDashboard(capasGeoJSON['evolucion']);
        map.fitBounds(capasLeaflet['barrio'].getBounds());
        actualizarEvolucionMapa();
        reconstruirControl();
      }
    });
  });
}

// =============================
// FILTRO Y TABLA
// =============================
function filtrarPorAnio() {
  let val = document.getElementById("filtroAnio").value;
  anioSeleccionado = val === "todos" ? null : val;
  let slider = document.getElementById("timeSlider");
  if (slider && val !== "todos") {
    let idx = labels.indexOf(val);
    if (idx !== -1) {
      slider.value = idx;
      if (ortoSliderLayer && map.hasLayer(ortoSliderLayer)) map.removeLayer(ortoSliderLayer);
      ortoSliderLayer = L.imageOverlay(ortoUrls[idx], bounds, { opacity: 1 });
      ortoSliderLayer.addTo(map);
      let label = document.getElementById("timeLabel");
      if (label) label.innerText = val;
    }
  }
  cambiarTabla();
  actualizarEvolucionMapa();
  if (capasGeoJSON['evolucion']) llenarDashboard(capasGeoJSON['evolucion']);
}

function cambiarTabla() {
  let capa = document.getElementById("selectorCapa").value;
  if (capa !== 'evolucion') { llenarTabla(capasGeoJSON[capa]); llenarDashboard(capasGeoJSON['evolucion']); return; }
  let f = capasGeoJSON['evolucion'].features.filter(x =>
    anioSeleccionado ? x.properties["Año"] == anioSeleccionado : true
  );
  llenarTabla({ type: "FeatureCollection", features: f });
  llenarDashboard(capasGeoJSON['evolucion']);
}

function descargarCapa() {
  let capa = document.getElementById("selectorCapa").value;
  let blob = new Blob([JSON.stringify(capasGeoJSON[capa])], { type: "application/json" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a"); a.href = url; a.download = capa + ".geojson"; a.click();
  URL.revokeObjectURL(url);
}

// =============================
// EXPORTADOR PDF
// =============================
function abrirExportador() {
  // Poner fecha actual por defecto
  let hoy = new Date();
  let meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById("expFecha").value = meses[hoy.getMonth()] + ' ' + hoy.getFullYear();
  document.getElementById("modalExport").style.display = "flex";
}

function cerrarExportador() {
  document.getElementById("modalExport").style.display = "none";
}

async function generarPDF() {
  const { jsPDF } = window.jspdf;
  var btn = document.getElementById("btnGenerarTxt");
  btn.textContent = "Generando...";

  var titulo    = document.getElementById("expTitulo").value    || "Reporte Cartografico";
  var subtitulo = document.getElementById("expSubtitulo").value || "";
  var autor     = document.getElementById("expAutor").value     || "";
  var fecha     = document.getElementById("expFecha").value     || "";
  var src       = document.getElementById("expSRC").value       || "";
  var anioExp   = document.getElementById("expAnio").value;
  var conDash   = document.getElementById("chkDashboard").checked;
  var conTabla  = document.getElementById("chkTabla").checked;
  var conCoords = document.getElementById("chkCoordenadas").checked;
  var conEscala = document.getElementById("chkEscala").checked;

  // ── CERRAR MODAL Y CENTRAR MAPA ──
  var vistaOriginal = { center: map.getCenter(), zoom: map.getZoom() };

  // 1. Cerrar modal
  document.getElementById("modalExport").style.display = "none";

  // 2. Esperar a que el DOM procese el cierre del modal
  await new Promise(function(r){ setTimeout(r, 300); });

  // 3. Forzar que Leaflet recalcule el tamaño del contenedor
  map.invalidateSize({ animate: false });

  // 4. Centrar en el barrio y esperar el evento moveend
  await new Promise(function(resolve) {
    map.once('moveend', function() {
      // Esperar adicional para que los tiles carguen
      setTimeout(resolve, 1500);
    });
    if (capasLeaflet['barrio']) {
      map.fitBounds(capasLeaflet['barrio'].getBounds(), { padding: [30, 30], animate: false });
    } else {
      resolve();
    }
  });

  var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var y = 0;

  function fmt2(n) {
    if (n >= 10000) return (n/10000).toFixed(2) + ' ha';
    if (n >= 1000)  return (n/1000).toFixed(1) + ' k m2';
    return Math.round(n) + ' m2';
  }

  // ── CALCULAR DATOS POR AÑO ──
  var allFeatures = capasGeoJSON['evolucion'] ? capasGeoJSON['evolucion'].features : [];
  var porAnio = {
    2005: { ac:0, av:0, viv:0 },
    2010: { ac:0, av:0, viv:0 },
    2020: { ac:0, av:0, viv:0 },
    2025: { ac:0, av:0, viv:0 }
  };
  allFeatures.forEach(function(f) {
    var a    = f.properties["Año"];
    var tipo = (f.properties["Tipo"] || "").toLowerCase();
    var area = parseFloat(f.properties["Aream2"] || 0);
    if (!porAnio[a]) return;
    if (tipo.includes("verde"))                              { porAnio[a].av += area; }
    else if (tipo === "vivienda")                            { porAnio[a].viv++; }
    else if (tipo.includes("poligono")||tipo.includes("polígono")) { porAnio[a].ac += area; }
  });

  var aniosList = anioExp === 'todos' ? [2005,2010,2020,2025] : [parseInt(anioExp)];

  // ── FUNCIÓN PARA DIBUJAR UNA PÁGINA POR AÑO ──
  async function dibujarPagina(anio, esFirst) {
    if (!esFirst) { pdf.addPage(); }
    var y = 0;

    // HEADER
    pdf.setFillColor(44, 62, 80);
    pdf.rect(0, 0, W, 32, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(titulo, W/2, 12, { align: 'center' });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(subtitulo, W/2, 19, { align: 'center' });
    if (autor) { pdf.setFontSize(8); pdf.text("Autor: " + autor, 14, 27); }
    if (fecha) { pdf.setFontSize(8); pdf.text("Fecha: " + fecha, W-14, 27, { align: 'right' }); }

    // Badge del año
    pdf.setFillColor(52, 152, 219);
    pdf.roundedRect(W/2-15, 26, 30, 8, 2, 2, 'F');
    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(10);
    pdf.text(anio === 'todos' ? '2005-2025' : String(anio), W/2, 31.5, { align: 'center' });

    y = 38;

    // MAPA
    try {
      var mapCanvas = await html2canvas(document.getElementById("map"), {
        useCORS: true, allowTaint: true, scale: 1.5, logging: false, backgroundColor: '#ffffff'
      });
      var mapImg = mapCanvas.toDataURL("image/jpeg", 0.85);
      var mapH = 75;
      pdf.addImage(mapImg, 'JPEG', 14, y, W-28, mapH);
      pdf.setDrawColor(44,62,80); pdf.setLineWidth(0.5);
      pdf.rect(14, y, W-28, mapH);
      y += mapH + 4;
    } catch(e) { console.warn(e); }

    // COORDENADAS
    if (conCoords) {
      var centro = map.getCenter();
      var c9377  = wgs84A9377(centro.lng, centro.lat);
      var nw9377 = wgs84A9377(map.getBounds().getWest(), map.getBounds().getNorth());
      var se9377 = wgs84A9377(map.getBounds().getEast(), map.getBounds().getSouth());

      pdf.setFillColor(241,245,249);
      pdf.rect(14, y, W-28, 18, 'F');
      pdf.setFillColor(44,62,80); pdf.rect(14, y, 3, 18, 'F');
      pdf.setDrawColor(44,62,80); pdf.setLineWidth(0.2);
      pdf.rect(14, y, W-28, 18);
      pdf.setTextColor(44,62,80); pdf.setFont("helvetica","bold"); pdf.setFontSize(7.5);
      pdf.text("Sistema de Referencia de Coordenadas", 20, y+5);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(7);
      pdf.text("Sistema: " + src, 20, y+10);
      pdf.text("Centro — E: " + c9377[0].toFixed(1) + " m  |  N: " + c9377[1].toFixed(1) + " m", 20, y+14);
      pdf.text("Ext. — NO: E" + nw9377[0].toFixed(0) + " N" + nw9377[1].toFixed(0) + "  |  SE: E" + se9377[0].toFixed(0) + " N" + se9377[1].toFixed(0), 20, y+18);
      y += 22;
    }

    if (conEscala) {
      var zoom = map.getZoom();
      var escala = Math.round(559082264 / Math.pow(2, zoom) / 100) * 100;
      pdf.setTextColor(120,120,120); pdf.setFont("helvetica","italic"); pdf.setFontSize(6.5);
      pdf.text("Zoom: " + zoom + "  |  Escala aprox: 1:" + escala.toLocaleString() + "  |  Fuente: OpenStreetMap / Ortofotos IGAC  |  EPSG:9377", 14, y);
      y += 5;
    }

    if (!conDash) return y;

    // SEPARADOR
    pdf.setDrawColor(44,62,80); pdf.setLineWidth(0.4);
    pdf.line(14, y, W-14, y); y += 4;
    pdf.setTextColor(44,62,80); pdf.setFont("helvetica","bold"); pdf.setFontSize(10);
    pdf.text("Estadisticas" + (anio !== 'todos' ? " - Año " + anio : " 2005-2025"), 14, y); y += 6;

    // Datos del año actual
    var ac   = anio === 'todos' ? [2005,2010,2020,2025].reduce(function(s,a){return s+porAnio[a].ac;},0) : porAnio[anio].ac;
    var av   = anio === 'todos' ? [2005,2010,2020,2025].reduce(function(s,a){return s+porAnio[a].av;},0) : porAnio[anio].av;
    var viv  = anio === 'todos' ? [2005,2010,2020,2025].reduce(function(s,a){return s+porAnio[a].viv;},0) : porAnio[anio].viv;
    var tot  = ac + av;

    // KPIs
    var kw = (W-28-8)/3;
    var kpis = [
      { label:'Area construida', val:fmt2(ac), bg:[231,76,60]  },
      { label:'Zonas verdes',    val:fmt2(av), bg:[39,174,96]  },
      { label:'Viviendas',       val:viv,      bg:[44,62,80]   }
    ];
    kpis.forEach(function(k,i) {
      var kx = 14 + i*(kw+4);
      pdf.setFillColor(k.bg[0],k.bg[1],k.bg[2]);
      pdf.rect(kx, y, kw, 12, 'F');
      pdf.setTextColor(255,255,255);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(10);
      pdf.text(String(k.val), kx+kw/2, y+7, { align:'center' });
      pdf.setFont("helvetica","normal"); pdf.setFontSize(6);
      pdf.text(k.label, kx+kw/2, y+11, { align:'center' });
    });
    y += 16;

    // Cambio 2005->2025 solo si es todos
    if (anio === 'todos') {
      var ac05=porAnio[2005].ac, ac25=porAnio[2025].ac;
      var av05=porAnio[2005].av, av25=porAnio[2025].av;
      var pctC = ac05>0?(((ac25-ac05)/ac05)*100).toFixed(1):null;
      var pctV = av05>0?(((av25-av05)/av05)*100).toFixed(1):null;
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7.5); pdf.setTextColor(44,62,80);
      pdf.text("Cambio 2005 -> 2025:", 14, y); y += 4;
      var hw = (W-28)/2-2;
      if (pctC!==null) {
        var cC = parseFloat(pctC)>=0?[231,76,60]:[39,174,96];
        pdf.setFillColor(248,249,250); pdf.rect(14,y,hw,9,'F');
        pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5); pdf.setTextColor(80,80,80);
        pdf.text("Construcciones:", 16, y+4);
        pdf.setFont("helvetica","bold"); pdf.setFontSize(8);
        pdf.setTextColor(cC[0],cC[1],cC[2]);
        pdf.text((parseFloat(pctC)>=0?"+":"")+pctC+"% ("+fmt2(ac05)+" -> "+fmt2(ac25)+")", 16, y+8);
      }
      if (pctV!==null) {
        var cV = parseFloat(pctV)>=0?[39,174,96]:[231,76,60];
        var cx2=14+hw+4;
        pdf.setFillColor(248,249,250); pdf.rect(cx2,y,hw,9,'F');
        pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5); pdf.setTextColor(80,80,80);
        pdf.text("Zonas verdes:", cx2+2, y+4);
        pdf.setFont("helvetica","bold"); pdf.setFontSize(8);
        pdf.setTextColor(cV[0],cV[1],cV[2]);
        pdf.text((parseFloat(pctV)>=0?"+":"")+pctV+"% ("+fmt2(av05)+" -> "+fmt2(av25)+")", cx2+2, y+8);
      }
      y += 13;
    }

    // ── GRÁFICAS LADO A LADO ──
    pdf.setDrawColor(220,220,220); pdf.setLineWidth(0.2);
    pdf.line(14, y, W-14, y); y += 4;
    pdf.setFont("helvetica","bold"); pdf.setFontSize(8); pdf.setTextColor(44,62,80);
    pdf.text("Graficas de distribucion", 14, y); y += 5;

    var grafY = y;
    var grafH = 45;
    var mitad = (W-28)/2;

    // ── GRÁFICA TORTA (izquierda) ──
    if (tot > 0) {
      var cx = 14 + mitad/2, cy = grafY + grafH/2, r = 18;
      var pAC = ac/tot, pAV = av/tot;
      // Sector construido
      function polarToCart(cx,cy,r,angleDeg) {
        var rad = (angleDeg-90)*Math.PI/180;
        return [cx+r*Math.cos(rad), cy+r*Math.sin(rad)];
      }
      var ang1 = pAC*360;
      // Dibujar torta con líneas (jsPDF no tiene arc nativo limpio, usamos triángulos)
      var steps = 60;
      // Sector construido — rojo
      pdf.setFillColor(231,76,60);
      var pts = [[cx,cy]];
      for (var s=0; s<=Math.round(pAC*steps); s++) {
        var p = polarToCart(cx,cy,r, (s/steps)*360);
        pts.push(p);
      }
      if (pts.length > 2) {
        pdf.lines(pts.slice(1).map(function(p,i){ return i===0?[p[0]-cx,p[1]-cy]:[p[0]-pts[i][0],p[1]-pts[i][1]]; }), cx, cy, [1,1], 'F');
      }
      // Sector verde — dibujar el resto
      pdf.setFillColor(39,174,96);
      var pts2 = [[cx,cy]];
      for (var s2=Math.round(pAC*steps); s2<=steps; s2++) {
        var p2 = polarToCart(cx,cy,r, (s2/steps)*360);
        pts2.push(p2);
      }
      if (pts2.length > 2) {
        pdf.lines(pts2.slice(1).map(function(p,i){ return i===0?[p[0]-cx,p[1]-cy]:[p[0]-pts2[i][0],p[1]-pts2[i][1]]; }), cx, cy, [1,1], 'F');
      }
      // Leyenda torta
      pdf.setFillColor(231,76,60); pdf.rect(14, grafY+grafH+2, 5, 3, 'F');
      pdf.setTextColor(60,60,60); pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5);
      pdf.text("Construido " + (pAC*100).toFixed(1)+"%", 21, grafY+grafH+5);
      pdf.setFillColor(39,174,96); pdf.rect(14+mitad/2, grafY+grafH+2, 5, 3, 'F');
      pdf.text("Verde " + (pAV*100).toFixed(1)+"%", 21+mitad/2, grafY+grafH+5);
      pdf.setTextColor(44,62,80); pdf.setFont("helvetica","bold"); pdf.setFontSize(7);
      pdf.text("Distribucion de area", 14+mitad/2-15, grafY-1);
    }

    // ── GRÁFICA DE BARRAS (derecha) ──
    var barX0 = 14 + mitad + 4;
    var barAnios = anio==='todos' ? [2005,2010,2020,2025] : [anio];
    var maxAC = Math.max.apply(null, barAnios.map(function(a){return porAnio[a].ac+porAnio[a].av;}));
    var barW2 = (mitad - 20) / barAnios.length - 3;
    var barMaxH = grafH - 8;

    pdf.setTextColor(44,62,80); pdf.setFont("helvetica","bold"); pdf.setFontSize(7);
    pdf.text("Area por año (ha)", barX0, grafY-1);

    barAnios.forEach(function(a, i) {
      var bx = barX0 + i*(barW2+3);
      var hAC = maxAC>0 ? (porAnio[a].ac/maxAC)*barMaxH : 0;
      var hAV = maxAC>0 ? (porAnio[a].av/maxAC)*barMaxH : 0;
      // Barra verde (base)
      pdf.setFillColor(39,174,96);
      pdf.rect(bx, grafY+barMaxH-hAV, barW2, hAV, 'F');
      // Barra roja (encima)
      pdf.setFillColor(231,76,60);
      pdf.rect(bx, grafY+barMaxH-hAV-hAC, barW2, hAC, 'F');
      // Etiqueta año
      pdf.setTextColor(60,60,60); pdf.setFont("helvetica","normal"); pdf.setFontSize(5.5);
      pdf.text(String(a), bx+barW2/2, grafY+barMaxH+4, { align:'center' });
    });
    // Eje base
    pdf.setDrawColor(180,180,180); pdf.setLineWidth(0.2);
    pdf.line(barX0, grafY+barMaxH, barX0+mitad-20, grafY+barMaxH);

    y = grafY + grafH + 10;

    // TABLA DETALLE
    if (anio === 'todos') {
      pdf.setDrawColor(220,220,220); pdf.setLineWidth(0.2);
      pdf.line(14,y,W-14,y); y+=4;
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7.5); pdf.setTextColor(44,62,80);
      pdf.text("Detalle por año:", 14, y); y+=4;
      var cols = [14,48,90,130,162];
      var hdrs = ['Año','Area Construida','Area Verde','Viviendas','Total Area'];
      pdf.setFillColor(44,62,80); pdf.rect(14,y,W-28,6,'F');
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(6.5);
      hdrs.forEach(function(h,i){ pdf.text(h, cols[i]+2, y+4.5); });
      y+=6;
      [2005,2010,2020,2025].forEach(function(a,idx) {
        var bg = idx%2===0?[248,249,250]:[255,255,255];
        pdf.setFillColor(bg[0],bg[1],bg[2]); pdf.rect(14,y,W-28,6,'F');
        pdf.setTextColor(44,62,80); pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5);
        var row=[String(a),fmt2(porAnio[a].ac),fmt2(porAnio[a].av),String(porAnio[a].viv),fmt2(porAnio[a].ac+porAnio[a].av)];
        row.forEach(function(v,i){ pdf.text(v, cols[i]+2, y+4.5); });
        y+=6;
      });
    } else {
      // Para un año específico: tabla de 1 fila con más detalle
      pdf.setDrawColor(220,220,220); pdf.setLineWidth(0.2);
      pdf.line(14,y,W-14,y); y+=4;
      pdf.setFont("helvetica","bold"); pdf.setFontSize(7.5); pdf.setTextColor(44,62,80);
      pdf.text("Resumen año " + anio + ":", 14, y); y+=4;
      var items = [
        ["Area construida", fmt2(porAnio[anio].ac)],
        ["Area verde",      fmt2(porAnio[anio].av)],
        ["Viviendas",       String(porAnio[anio].viv)],
        ["Area total",      fmt2(porAnio[anio].ac+porAnio[anio].av)]
      ];
      items.forEach(function(item, idx) {
        var bg = idx%2===0?[248,249,250]:[255,255,255];
        pdf.setFillColor(bg[0],bg[1],bg[2]); pdf.rect(14,y,W-28,6,'F');
        pdf.setFont("helvetica","bold"); pdf.setFontSize(6.5); pdf.setTextColor(44,62,80);
        pdf.text(item[0], 16, y+4.5);
        pdf.setFont("helvetica","normal");
        pdf.text(item[1], 80, y+4.5);
        y+=6;
      });
    }

    // TABLA ATRIBUTOS
    if (conTabla) {
      if (y > H-60) { pdf.addPage(); y=20; }
      pdf.setDrawColor(44,62,80); pdf.setLineWidth(0.4);
      pdf.line(14,y,W-14,y); y+=5;
      pdf.setFont("helvetica","bold"); pdf.setFontSize(9); pdf.setTextColor(44,62,80);
      pdf.text("Tabla de Atributos - Evolucion Urbana" + (anio!=='todos'?" ("+anio+")":""), 14, y); y+=6;
      var feats = allFeatures.filter(function(f){ return anio==='todos' || f.properties["Año"]==anio; });
      var cols2=['OBJECTID','Año','Tipo','Aream2','lenght'];
      var colW2=[20,16,55,40,40];
      var colX2=[14];
      colW2.forEach(function(w,i){ colX2.push(colX2[i]+w); });
      pdf.setFillColor(44,62,80); pdf.rect(14,y,W-28,6,'F');
      pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(6);
      cols2.forEach(function(c,i){ pdf.text(c, colX2[i]+1, y+4.5); });
      y+=6;
      feats.forEach(function(f,idx) {
        if (y>H-20){ pdf.addPage(); y=20; }
        var bg=idx%2===0?[248,249,250]:[255,255,255];
        pdf.setFillColor(bg[0],bg[1],bg[2]); pdf.rect(14,y,W-28,5,'F');
        pdf.setTextColor(60,60,60); pdf.setFont("helvetica","normal"); pdf.setFontSize(5.5);
        cols2.forEach(function(c,i){
          var val=String(f.properties[c]!=null?f.properties[c]:"");
          if(val.length>18) val=val.substring(0,16)+'..';
          pdf.text(val, colX2[i]+1, y+3.8);
        });
        y+=5;
      });
    }

    // PIE
    pdf.setFillColor(44,62,80); pdf.rect(0,H-9,W,9,'F');
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5);
    pdf.text("Geovisor Barrio Maria Cano  |  " + fecha + "  |  EPSG:9377", W/2, H-4, { align:'center' });
  }

  // ── GENERAR PÁGINAS ──
  for (var i=0; i<aniosList.length; i++) {
    await dibujarPagina(aniosList[i], i===0);
  }

  // Numerar páginas
  var totalPages = pdf.internal.getNumberOfPages();
  for (var p=1; p<=totalPages; p++) {
    pdf.setPage(p);
    pdf.setFillColor(44,62,80); pdf.rect(0,H-9,W,9,'F');
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","normal"); pdf.setFontSize(6.5);
    pdf.text("Geovisor Barrio Maria Cano  |  " + fecha + "  |  Pagina " + p + " de " + totalPages, W/2, H-4, { align:'center' });
  }

  // Restaurar vista original
  map.setView(vistaOriginal.center, vistaOriginal.zoom, { animate: false });

  var nombreArchivo = titulo.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'') + '_' + (anioExp==='todos'?'2005-2025':anioExp) + '.pdf';
  pdf.save(nombreArchivo);
  btn.textContent = "Generar PDF";
  cerrarExportador();
}

// =============================
// SLIDER INIT
// =============================
document.addEventListener("DOMContentLoaded", function () {
  let slider = document.getElementById("timeSlider");
  if (slider) slider.addEventListener("input", function (e) { cambiarOrto(parseInt(e.target.value)); });
});

cargarCapas();
