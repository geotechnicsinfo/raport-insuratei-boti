/* Harta geologică 3D – Însurăței. Three.js r128.
   Bloc de teren (EU-DEM 25 m) drapat cu unitățile hărții geologice 1:200.000 (foaia Brăila),
   pereți laterali cu coloana stratigrafică schematică, investigațiile Faza I, etichete, HUD. */
(function () {
  'use strict';
  const COL = {
    'qh2|loess': '#F3DF8E', 'qp3-qh': '#D9B96E', 'qp3/3': '#C9A066', 'qh1': '#FBF3C0',
    'qh2|aluv': '#CFE6BE', 'qh2|mlas': '#A9D3C4', 'riu': '#7FB0E6', 'lac': '#3C78DC', 'none': '#E8E3D6'
  };
  const UNIT_LABEL = {
    'qh2|loess': 'qh2 – pietrișuri, nisipuri, depozite loessoide (câmp)',
    'qp3-qh': 'qp3–qh – depozite deluvial‑proluviale (valea Călmățuiului)',
    'qp3/3': 'qp3/3 – depozite deluvial‑proluviale (terasă)',
    'qh1': 'qh1 – depozite deluvial‑proluviale',
    'qh2|aluv': 'qh2 – depozite aluvial‑proluviale',
    'qh2|mlas': 'qh2 – depozite de mlaștină', 'riu': 'râu', 'lac': 'lac', 'none': 'în afara extrasului'
  };
  // coloana schematică (cote absolute, m) – valori regionale, vezi descrierea
  const STRATA = [
    { top: 999, base: 22, c: '#E9D27F', lab: 'Loess și depozite loessoide (qp3) · PSU' },
    { top: 22, base: 2, c: '#D8AE5C', lab: 'Nisipuri fine, prăfoase – acviferul freatic (Nisipuri de Mostiștea)' },
    { top: 2, base: -30, c: '#8FA3A8', lab: 'Complexul marnos (Form. de Coconi): argile, silturi, nisipuri fine' },
    { top: -30, base: -150, c: '#BE9468', lab: 'Stratele de Frătești: pietrișuri și nisipuri (acvifer de adâncime)' }
  ];
  const ALUV = { c: '#BFD9AE', lab: 'Aluviuni de luncă (qp3–qh / qh): nisipuri, nisipuri argiloase' };

  function unitKey(f) {
    const c = f.properties.COD, o = f.properties.OBS || '';
    if (c === 'riu') return 'riu'; if (c === 'lac') return 'lac';
    if (c === 'qp3-qh') return 'qp3-qh'; if (c === 'qp3/3') return 'qp3/3'; if (c === 'qh1') return 'qh1';
    if (/^Pietri/.test(o)) return 'qh2|loess'; if (/aluvial/.test(o)) return 'qh2|aluv'; if (/mla/.test(o)) return 'qh2|mlas';
    return 'none';
  }
  function pip(x, y, ring) {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function unitAt(geo, lon, lat) {
    for (const f of geo.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const p of polys) if (pip(lon, lat, p[0]) && !p.slice(1).some(h => pip(lon, lat, h))) return unitKey(f);
    }
    return 'none';
  }
  function sprite(text, opts) {
    opts = opts || {};
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    const fs = opts.size || 26; ctx.font = `${opts.weight || 600} ${fs}px "Barlow Condensed","Barlow",sans-serif`;
    const w = ctx.measureText(text).width + 24; c.width = w; c.height = fs + 18;
    ctx.font = `${opts.weight || 600} ${fs}px "Barlow Condensed","Barlow",sans-serif`;
    ctx.fillStyle = opts.bg || 'rgba(255,255,255,.88)'; ctx.fillRect(0, 0, w, c.height);
    ctx.fillStyle = opts.color || '#0A2F4F'; ctx.textBaseline = 'middle'; ctx.fillText(text, 12, c.height / 2);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const k = opts.scale || 0.09; s.scale.set(w * k, c.height * k, 1); s.renderOrder = 10; return s;
  }

  window.initGeo3D = function (el, R, G, INV, PROJ, opts) {
    opts = opts || {};
    const W = () => el.clientWidth, H = () => el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W(), H()); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd3dc, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-220, 160, 260); scene.add(sun);

    // ---- geometrie ----
    const lat0 = R.lat0, lat1 = R.lat1, lon0 = R.lon0, lon1 = R.lon1, nx = R.nx, ny = R.ny;
    const latc = (lat0 + lat1) / 2, lonc = (lon0 + lon1) / 2;
    const mLat = 111320, mLon = 111320 * Math.cos(latc * Math.PI / 180), S = 1 / 100;
    let VE = opts.ve || 18;
    const X = lon => (lon - lonc) * mLon * S, Y = lat => -(lat - latc) * mLat * S;   // y spre nord => -z în three
    const zRef = 30, Z = z => (z - zRef) * VE * S;
    const BASE = -150;
    const zAt = (i, j) => { const v = R.z[j * nx + i]; return v == null ? 20 : v; };
    const units = new Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
      units[j * nx + i] = unitAt(G, lon0 + (lon1 - lon0) * i / (nx - 1), lat0 + (lat1 - lat0) * j / (ny - 1));

    const grp = new THREE.Group(); scene.add(grp);
    // suprafață
    const sg = new THREE.PlaneGeometry(1, 1, nx - 1, ny - 1);
    const pos = sg.attributes.position, colGeo = new Float32Array(pos.count * 3), colRel = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    function buildSurface() {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, lon = lon0 + (lon1 - lon0) * i / (nx - 1), lat = lat1 - (lat1 - lat0) * j / (ny - 1);
        const jj = ny - 1 - j; // PlaneGeometry: rândul 0 e sus (nord)
        pos.setXYZ(k, X(lon), Z(zAt(i, jj)), Y(lat));
        tmp.set(COL[units[jj * nx + i]]); colGeo.set([tmp.r, tmp.g, tmp.b], k * 3);
        const t = (zAt(i, jj) - 10) / 42; tmp.setHSL(0.11, 0.25, 0.42 + 0.4 * t); colRel.set([tmp.r, tmp.g, tmp.b], k * 3);
      }
      pos.needsUpdate = true; sg.computeVertexNormals();
    }
    buildSurface();
    sg.setAttribute('color', new THREE.BufferAttribute(colGeo, 3));
    const surf = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    grp.add(surf);
    // contururi unități (linii) – marginile poligoanelor peste relief
    const edges = new THREE.Group(); grp.add(edges);
    function zInterp(lon, lat) {
      const fx = (lon - lon0) / (lon1 - lon0) * (nx - 1), fy = (lat - lat0) / (lat1 - lat0) * (ny - 1);
      const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
      const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j));
      return (1 - u) * (1 - v) * zAt(i, j) + u * (1 - v) * zAt(i + 1, j) + (1 - u) * v * zAt(i, j + 1) + u * v * zAt(i + 1, j + 1);
    }
    function buildEdges() {
      while (edges.children.length) edges.remove(edges.children[0]);
      const mat = new THREE.LineBasicMaterial({ color: 0x6b5a3a, transparent: true, opacity: 0.75 });
      for (const f of G.features) {
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const p of polys) for (const ring of p) {
          const pts = [];
          for (const [lon, lat] of ring) {
            if (lon < lon0 || lon > lon1 || lat < lat0 || lat > lat1) { if (pts.length > 1) edges.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)); pts.length = 0; continue; }
            pts.push(new THREE.Vector3(X(lon), Z(zInterp(lon, lat)) + 0.25, Y(lat)));
          }
          if (pts.length > 1) edges.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        }
      }
    }
    buildEdges();
    // pereți cu stratigrafie schematică
    const walls = new THREE.Group(); grp.add(walls);
    function wallFor(samples) { // samples: [{x,z(three), zAbs, lon, lat, unit}]
      const verts = [], cols = [], idx = [];
      const bands = []; // per sample list of (top,base,color)
      for (const s of samples) {
        const b = []; let top = s.zAbs;
        const aluv = (s.unit === 'qp3-qh' || s.unit === 'qh2|aluv' || s.unit === 'qh1') ? Math.min(6, top - BASE) : 0;
        if (aluv > 0) { b.push([top, top - aluv, ALUV.c]); top -= aluv; }
        for (const L of STRATA) { const t = Math.min(top, L.top), bs = Math.max(L.base, BASE); if (t > bs) b.push([t, bs, L.c]); }
        bands.push(b);
      }
      const nb = Math.max(...bands.map(b => b.length));
      // construim pe perechi de eșantioane consecutive, bandă cu bandă (cote absolute identice pe orizontală)
      const horizons = [999, 22, 2, -30, BASE];
      for (let s = 0; s < samples.length - 1; s++) {
        const A = samples[s], B = samples[s + 1];
        for (let h = 0; h < horizons.length - 1; h++) {
          const tA = Math.min(A.zAbs, horizons[h]), tB = Math.min(B.zAbs, horizons[h]);
          const bA = Math.max(horizons[h + 1], BASE), bB = bA;
          if (tA <= bA && tB <= bB) continue;
          const c = new THREE.Color(STRATA[h].c);
          const base = verts.length / 3;
          verts.push(A.x, Z(Math.max(tA, bA)), A.y, B.x, Z(Math.max(tB, bB)), B.y, B.x, Z(bB), B.y, A.x, Z(bA), A.y);
          for (let q = 0; q < 4; q++) cols.push(c.r, c.g, c.b);
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        // bandă aluviuni (urmează suprafața) peste loess, în luncă
        const aA = bands[s][0][2] === ALUV.c ? bands[s][0] : null, aB = bands[s + 1][0][2] === ALUV.c ? bands[s + 1][0] : null;
        if (aA || aB) {
          const c = new THREE.Color(ALUV.c), base = verts.length / 3;
          const tA = A.zAbs, tB = B.zAbs, bA = aA ? aA[1] : A.zAbs, bB = aB ? aB[1] : B.zAbs;
          verts.push(A.x, Z(tA) + 0.02, A.y, B.x, Z(tB) + 0.02, B.y, B.x, Z(bB), B.y, A.x, Z(bA), A.y);
          for (let q = 0; q < 4; q++) cols.push(c.r, c.g, c.b);
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
      return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    }
    function buildWalls() {
      while (walls.children.length) walls.remove(walls.children[0]);
      const samp = (i, j) => { const lon = lon0 + (lon1 - lon0) * i / (nx - 1), lat = lat0 + (lat1 - lat0) * j / (ny - 1); return { x: X(lon), y: Y(lat), zAbs: zAt(i, j), unit: units[j * nx + i] }; };
      const south = [], north = [], west = [], east = [];
      for (let i = 0; i < nx; i++) { south.push(samp(i, 0)); north.push(samp(i, ny - 1)); }
      for (let j = 0; j < ny; j++) { west.push(samp(0, j)); east.push(samp(nx - 1, j)); }
      [south, north, west, east].forEach(s => walls.add(wallFor(s)));
      // fund
      const fg = new THREE.PlaneGeometry(X(lon1) - X(lon0), Y(lat0) - Y(lat1)); fg.rotateX(-Math.PI / 2);
      const fm = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: 0xb09a78, side: THREE.DoubleSide }));
      fm.position.set((X(lon0) + X(lon1)) / 2, Z(BASE), (Y(lat0) + Y(lat1)) / 2); walls.add(fm);
      // linii orizonturi pe peretele sudic + etichete
      const lm = new THREE.LineBasicMaterial({ color: 0x5a4a30, transparent: true, opacity: .6 });
      const labs = [[STRATA[0].lab, 29, -95], [STRATA[1].lab, 12, -45], [STRATA[2].lab, -14, 10], [STRATA[3].lab, -85, 60]];
      for (const [lab, z, dx] of labs) {
        const sp = sprite(lab, { size: 22, scale: 0.085, bg: 'rgba(255,255,255,.88)' }); sp.position.set(X(lonc) + dx, Z(z), Y(lat0) + 0.5); walls.add(sp);
      }
      for (const h of [22, 2, -30]) {
        const pts = [new THREE.Vector3(X(lon0), Z(h), Y(lat0) + 0.05), new THREE.Vector3(X(lon1), Z(h), Y(lat0) + 0.05)];
        walls.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm));
      }
    }
    buildWalls();

    // ---- investigații ----
    const invG = new THREE.Group(); grp.add(invG); const pickable = [];
    function marker(lon, lat, kind, id) {
      let m;
      if (kind === 'Fr') m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 12), new THREE.MeshLambertMaterial({ color: 0x0069B4 }));
      else if (kind === 'D') m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), new THREE.MeshLambertMaterial({ color: 0xF28C00 }));
      else m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshLambertMaterial({ color: kind === 'proj' ? 0x8a8a8a : 0x0A2F4F }));
      const z = zInterp(lon, lat);
      m.position.set(X(lon), Z(z) + (kind === 'Fr' || kind === 'D' ? 1.2 : 0.35), Y(lat)); m.userData = { id, lon, lat, z, kind, unit: unitAt(G, lon, lat) };
      invG.add(m); pickable.push(m); return m;
    }
    const exec = new Set();
    for (const i of INV) { if (i.lon && i.lat) { marker(i.lon, i.lat, i.id.startsWith('Fr') ? 'Fr' : 'D', i.id); exec.add(i.id); } }
    for (const p of PROJ) if (!exec.has(p.id)) marker(p.lon, p.lat, (p.id.startsWith('Fr') || p.id.startsWith('D')) ? 'proj' : 'alt', p.id);
    // etichete geografice
    const labels = new THREE.Group(); grp.add(labels);
    const LAB = [['Însurăței', 27.603, 44.916, 30], ['valea Călmățuiului', 27.60, 44.855, 20], ['Câmpia Brăilei (Câmpul Viziru)', 27.50, 44.93, 26],
      ['Bărăganul Ialomiței', 27.52, 44.815, 20], ['Parc eolian – Faza I', 27.57, 44.875, 20]];
    function buildLabels() {
      while (labels.children.length) labels.remove(labels.children[0]);
      for (const [t, lon, lat] of LAB) { const s = sprite(t, { size: 30, scale: 0.12, bg: 'rgba(255,255,255,.8)' }); s.position.set(X(lon), Z(zInterp(lon, lat)) + 4, Y(lat)); labels.add(s); }
      const n = sprite('N ▲', { size: 28, scale: 0.11, color: '#F28C00', bg: 'rgba(10,47,79,.85)' }); n.position.set(X(lon1) - 10, Z(45), Y(lat1) - 6); labels.add(n);
    }
    buildLabels();

    // ---- cameră / interacțiune ----
    let theta = -0.45, phi = 1.05, rad = 330, auto = true, target = new THREE.Vector3(0, -6, 0);
    function place() {
      camera.position.set(target.x + rad * Math.sin(phi) * Math.sin(theta), target.y + rad * Math.cos(phi), target.z + rad * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(target);
    }
    let drag = null;
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, t: theta, p: phi, b: e.button, tx: target.x, tz: target.z }; auto = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (drag) {
        if (drag.b === 2 || e.shiftKey) { const k = rad / 600; target.x = drag.tx - (e.clientX - drag.x) * k * Math.cos(theta) + 0; target.z = drag.tz - (e.clientY - drag.y) * k; }
        else { theta = drag.t - (e.clientX - drag.x) * 0.006; phi = Math.max(0.15, Math.min(1.45, drag.p - (e.clientY - drag.y) * 0.006)); }
      } else hover(e);
    });
    cv.addEventListener('pointerup', () => drag = null); cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); rad = Math.max(60, Math.min(900, rad * (e.deltaY > 0 ? 1.1 : 0.9))); auto = false; }, { passive: false });
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); const tip = opts.tip;
    let hot = null;
    function hover(e) {
      const r = cv.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hi = ray.intersectObjects(pickable, false)[0];
      if (hi) { show(e, `<b>${hi.object.userData.id}</b><br>${hi.object.userData.kind === 'proj' || hi.object.userData.kind === 'alt' ? 'punct proiectat' : 'executat'} · cota ≈ ${hi.object.userData.z.toFixed(1)} m<br><span class="u">${UNIT_LABEL[hi.object.userData.unit]}</span>`); cv.style.cursor = 'pointer'; hot = hi.object; return; }
      hot = null; cv.style.cursor = 'grab';
      const hs = ray.intersectObject(surf, false)[0];
      if (hs) {
        const lon = lonc + hs.point.x / (mLon * S), lat = latc - hs.point.z / (mLat * S);
        const u = unitAt(G, lon, lat);
        show(e, `<b>${UNIT_LABEL[u]}</b><br>cota ≈ ${zInterp(lon, lat).toFixed(1)} m · ${lat.toFixed(4)}N ${lon.toFixed(4)}E`);
        if (opts.onUnit) opts.onUnit(u);
      } else show(null);
    }
    function show(e, html) { if (!tip) return; if (!e) { tip.style.display = 'none'; return; } tip.style.display = 'block'; tip.innerHTML = html; const r = el.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; }
    cv.addEventListener('click', () => { if (hot && (hot.userData.kind === 'Fr' || hot.userData.kind === 'D')) location.href = 'index.html#/i/' + hot.userData.id; });

    // ---- API ----
    const api = {
      setVE(v) { VE = v; buildSurface(); buildEdges(); buildWalls(); buildLabels(); invG.children.forEach(m => { m.position.y = Z(m.userData.z) + (m.userData.kind === 'Fr' || m.userData.kind === 'D' ? 1.2 : 0.35); }); },
      setMode(mode) { sg.setAttribute('color', new THREE.BufferAttribute(mode === 'relief' ? colRel : colGeo, 3)); sg.attributes.color.needsUpdate = true; edges.visible = mode !== 'relief'; },
      toggle(name, on) { ({ inv: invG, walls, labels, edges })[name].visible = on; },
      reset() { theta = -0.45; phi = 1.05; rad = 330; target.set(0, -6, 0); auto = true; },
      flash(unit) { // pulsează unitatea în culoare
        let t = 0; const base = colGeo.slice(); const c = new THREE.Color('#ffffff');
        const iv = setInterval(() => {
          t += 0.12; const k = (Math.sin(t) + 1) / 2 * 0.7;
          for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i, jj = ny - 1 - j; if (units[jj * nx + i] === unit) { colGeo[q * 3] = base[q * 3] * (1 - k) + c.r * k; colGeo[q * 3 + 1] = base[q * 3 + 1] * (1 - k) + c.g * k; colGeo[q * 3 + 2] = base[q * 3 + 2] * (1 - k) + c.b * k; } }
          sg.attributes.color.needsUpdate = true; if (t > Math.PI * 2) { clearInterval(iv); colGeo.set(base); sg.attributes.color.needsUpdate = true; }
        }, 40);
      }
    };
    // ---- animație ----
    let t0 = performance.now(), intro = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      if (intro < 1) { intro = Math.min(1, intro + dt * 0.5); const e = 1 - Math.pow(1 - intro, 3); rad = 900 - 570 * e; phi = 0.35 + 0.7 * e; }
      else if (auto) theta += dt * 0.06;
      place(); renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
    new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); }).observe(el);
    return api;
  };
  window.GEO_COL = COL; window.GEO_UNIT_LABEL = UNIT_LABEL; window.geoUnitKey = unitKey;
})();
