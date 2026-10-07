/* ============================================================
   Harta apei subterane – calculată în browser din data.json + terrain.json
   IDW (p=2) pe cota apei / adâncimea apei, izolinii prin marching squares.
   Se actualizează singură când se schimbă datele (foraje noi, NH noi).
   window.initApa(D, INV, T)
   ============================================================ */
(function () {
  const STEP = 20, BUF = 150, DRY = 4.0;   // pas grilă [m], tampon anvelopă [m], adâncime „fără apă” [m]
  let map, layer, state = { mod: 'cota', eq: 0.5, fill: true }, G = null;

  window.initApa = function (D, INV, T) {
    const el = document.getElementById('wmap');
    if (!el || el.dataset.ready || typeof L === 'undefined' || !T) return;
    el.dataset.ready = '1';
    const n = T.n, latc = (T.lat0 + T.lat1) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 110540;
    const zT = (lat, lon) => {
      let fi = (lat - T.lat0) / (T.lat1 - T.lat0) * (n - 1), fj = (lon - T.lon0) / (T.lon1 - T.lon0) * (n - 1);
      fi = Math.max(0, Math.min(n - 1.001, fi)); fj = Math.max(0, Math.min(n - 1.001, fj));
      const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, g = (r, c) => T.z[r * n + c];
      return g(i, j) * (1 - a) * (1 - b) + g(i + 1, j) * a * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j + 1) * a * b;
    };
    // puncte
    const pts = INV.filter(i => i.lat != null).map(i => {
      const zt = zT(i.lat, i.lon), ad = i.NH != null ? i.NH : (i.IN != null ? i.IN : DRY);
      return { inv: i, lat: i.lat, lon: i.lon, x: i.lon * kx, y: i.lat * ky, zt, ad, cota: zt - ad, dry: i.NH == null && i.IN == null };
    });
    if (pts.length < 3) { el.innerHTML = '<p style="padding:20px;color:var(--ink-3)">Date insuficiente pentru interpolare.</p>'; return; }
    // anvelopă convexă (m)
    const hull = (() => {
      const p = pts.map(q => [q.x, q.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
      p.slice().reverse().forEach(q => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
      return lo.slice(0, -1).concat(up.slice(0, -1));
    })();
    const inHull = (x, y) => {
      let ins = false, dmin = Infinity;
      for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
        const a = hull[i], b = hull[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
        const dx = b[0] - a[0], dy = b[1] - a[1]; let t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t));
        dmin = Math.min(dmin, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
      }
      return ins || dmin <= BUF;
    };
    // grilă
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min.apply(0, xs) - BUF - STEP, x1 = Math.max.apply(0, xs) + BUF + STEP, y0 = Math.min.apply(0, ys) - BUF - STEP, y1 = Math.max.apply(0, ys) + BUF + STEP;
    const nx = Math.ceil((x1 - x0) / STEP) + 1, ny = Math.ceil((y1 - y0) / STEP) + 1;
    const mask = new Uint8Array(nx * ny), gc = new Float32Array(nx * ny), ga = new Float32Array(nx * ny);
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const x = x0 + c * STEP, y = y1 - r * STEP, k = r * nx + c;       // rândul 0 = nord
      if (!inHull(x, y)) { gc[k] = ga[k] = NaN; continue; }
      mask[k] = 1; let sw = 0, sc = 0, sa = 0, hit = null;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], d2 = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y); if (d2 < 1) { hit = p; break; } const w = 1 / d2; sw += w; sc += w * p.cota; sa += w * p.ad; }
      gc[k] = hit ? hit.cota : sc / sw; ga[k] = hit ? hit.ad : sa / sw;
    }
    G = { pts, nx, ny, x0, y1, kx, ky, gc, ga, mask, bounds: [[y0 / ky, x0 / kx], [y1 / ky, (x0 + (nx - 1) * STEP) / kx]] };
    G.bounds[0][0] = (y1 - (ny - 1) * STEP) / ky;

    map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25, zoomDelta: 0.5 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', opacity: 0.75 }).addTo(map);
    map.fitBounds(G.bounds, { padding: [4, 4] });
    layer = L.layerGroup().addTo(map);
    const hullLL = hull.map(h => [h[1] / ky, h[0] / kx]);
    L.polygon(hullLL, { color: '#0A2F4F', weight: 1, dashArray: '5 5', fill: false, interactive: false }).addTo(map);

    // controale
    const ctl = document.getElementById('wctl');
    ctl.innerHTML = '<div class="chips" id="w-mod"><button class="chip on" data-m="cota">Cota apei (izohipse)</button><button class="chip" data-m="ad">Adâncimea apei</button></div>' +
      '<label class="wsel">Echidistanță <select id="w-eq"><option value="0.25">0,25 m</option><option value="0.5" selected>0,5 m</option><option value="1">1,0 m</option></select></label>' +
      '<label class="wsel"><input type="checkbox" id="w-fill" checked> suprafață colorată</label>';
    ctl.querySelector('#w-mod').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; state.mod = b.dataset.m; ctl.querySelectorAll('#w-mod .chip').forEach(c => c.classList.toggle('on', c === b)); draw(); };
    ctl.querySelector('#w-eq').onchange = e => { state.eq = +e.target.value; draw(); };
    ctl.querySelector('#w-fill').onchange = e => { state.fill = e.target.checked; draw(); };
    draw();
    window.addEventListener('hashchange', () => setTimeout(() => map.invalidateSize(), 80));
  };

  const f1 = v => v.toFixed(1).replace('.', ','), f2 = v => v.toFixed(2).replace('.', ',');
  function ramp(t, mod) {   // t în [0,1]
    const stops = mod === 'cota' ? [[8, 48, 107], [33, 113, 181], [107, 174, 214], [222, 235, 247]] : [[31, 143, 216], [158, 202, 225], [247, 230, 196]];
    const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i, a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  function draw() {
    const { pts, nx, ny, x0, y1, kx, ky, mask } = G, g = state.mod === 'cota' ? G.gc : G.ga;
    layer.clearLayers();
    let lo = Infinity, hi = -Infinity; for (let k = 0; k < g.length; k++) if (mask[k]) { if (g[k] < lo) lo = g[k]; if (g[k] > hi) hi = g[k]; }
    const LL = (r, c) => [(y1 - r * STEP) / ky, (x0 + c * STEP) / kx];
    // suprafață
    if (state.fill) {
      const cv = document.createElement('canvas'); cv.width = nx; cv.height = ny; const cx = cv.getContext('2d'), im = cx.createImageData(nx, ny);
      for (let k = 0; k < g.length; k++) { if (!mask[k]) continue; const c = ramp((g[k] - lo) / (hi - lo || 1), state.mod); im.data[4 * k] = c[0]; im.data[4 * k + 1] = c[1]; im.data[4 * k + 2] = c[2]; im.data[4 * k + 3] = 255; }
      cx.putImageData(im, 0, 0);
      L.imageOverlay(cv.toDataURL(), G.bounds, { opacity: 0.62, interactive: false }).addTo(layer);
    }
    // izolinii (marching squares)
    const eq = state.eq, labels = [];
    for (let lv = Math.ceil(lo / eq) * eq; lv <= hi + 1e-9; lv += eq) {
      const segs = [], L0 = Math.round(lv * 100) / 100;
      for (let r = 0; r < ny - 1; r++) for (let c = 0; c < nx - 1; c++) {
        const k = r * nx + c; if (!(mask[k] && mask[k + 1] && mask[k + nx] && mask[k + nx + 1])) continue;
        const tl = g[k], tr = g[k + 1], bl = g[k + nx], br = g[k + nx + 1], P = [];
        const X = (a, b, ra, ca, rb, cb) => { if ((a < L0) !== (b < L0)) { const t = (L0 - a) / (b - a); P.push([ra + (rb - ra) * t, ca + (cb - ca) * t]); } };
        X(tl, tr, r, c, r, c + 1); X(tr, br, r, c + 1, r + 1, c + 1); X(br, bl, r + 1, c + 1, r + 1, c); X(bl, tl, r + 1, c, r, c);
        if (P.length === 2) segs.push([LL(P[0][0], P[0][1]), LL(P[1][0], P[1][1])]);
        else if (P.length === 4) { segs.push([LL(P[0][0], P[0][1]), LL(P[1][0], P[1][1])]); segs.push([LL(P[2][0], P[2][1]), LL(P[3][0], P[3][1])]); }
      }
      if (!segs.length) continue;
      const major = Math.abs(L0 - Math.round(L0)) < 1e-6, txt = (eq < 0.5 ? f2(L0) : f1(L0));
      L.polyline(segs, { color: '#0A4F8F', weight: major ? 2.2 : 1.1, opacity: 0.95 }).bindTooltip((state.mod === 'cota' ? 'Cota apei ' : 'Adâncimea apei ') + txt + ' m', { sticky: true }).addTo(layer);
      // etichete rare
      const mine = [];
      for (let s = 0; s < segs.length; s += 3) {
        const m = [(segs[s][0][0] + segs[s][1][0]) / 2, (segs[s][0][1] + segs[s][1][1]) / 2];
        const far = (arr, d) => arr.every(q => Math.hypot((q[0] - m[0]) * ky, (q[1] - m[1]) * kx) > d);
        if (far(mine, 900) && far(labels, 220)) { mine.push(m); labels.push(m); L.marker(m, { interactive: false, icon: L.divIcon({ className: 'iso-lbl' + (major ? ' mj' : ''), html: txt, iconSize: [34, 14] }) }).addTo(layer); }
      }
    }
    // puncte
    pts.forEach(p => {
      const i = p.inv, col = p.dry ? '#F28C00' : '#1F8FD8';
      L.circleMarker([p.lat, p.lon], { radius: p.dry ? 5 : 7, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).addTo(layer)
        .bindTooltip('<b>' + i.id + '</b><br>cota teren ≈ ' + f1(p.zt) + ' m<br>' + (p.dry ? 'fără apă până la ' + f1(DRY) + ' m<br>cota apei &lt; ' + f1(p.cota) + ' m' : (i.NH != null ? 'NH = ' + f2(i.NH) + ' m' : 'infiltrație la ' + f2(i.IN) + ' m') + (i.NH != null && i.IN != null ? ' · infiltrație ' + f2(i.IN) + ' m' : '') + '<br>cota apei ≈ ' + f1(p.cota) + ' m'))
        .on('click', () => { location.hash = '#/i/' + i.id; });
      if (!p.dry) L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: 'iso-pt', html: i.id, iconSize: [40, 12], iconAnchor: [-9, 6] }) }).addTo(layer);
    });
    // legendă
    const nW = pts.filter(p => !p.dry).length, st = [0, .25, .5, .75, 1].map(t => 'rgb(' + ramp(t, state.mod).map(Math.round).join(',') + ') ' + (t * 100) + '%').join(',');
    document.getElementById('wleg').innerHTML =
      '<div class="wbar"><span class="mono">' + f1(lo) + ' m</span><i style="background:linear-gradient(90deg,' + st + ')"></i><span class="mono">' + f1(hi) + ' m</span><em>' + (state.mod === 'cota' ? 'cota absolută a apei' : 'adâncimea apei sub teren') + '</em></div>' +
      '<div class="legend" style="margin-top:8px"><span><i style="background:#1F8FD8"></i>apă interceptată (' + nW + ' puncte)</span><span><i style="background:#F28C00"></i>fără apă până la ' + f1(DRY) + ' m (' + (pts.length - nW) + ' puncte, valoare-limită)</span><span><i style="background:none;border:1px dashed #0A2F4F;border-radius:0;box-shadow:none"></i>anvelopa forajelor</span></div>' +
      '<p class="wnote"><b>Hartă preliminară, orientativă.</b> Apa a fost interceptată în ' + nW + ' din ' + pts.length + ' puncte; în rest forajele de 4 m au rămas uscate și intră în calcul ca limită superioară (teren − ' + f1(DRY) + ' m), deci suprafața urmărește în mare relieful. Cote teren: EU-DEM 25 m (precizie ±2–3 m). Interpolare IDW (p = 2), pas ' + STEP + ' m, decupată la anvelopa forajelor + ' + BUF + ' m. Se recalculează automat la fiecare actualizare a datelor.</p>';
  }
})();
