/* ============================================================
   Intro 3D – bloc de teren stilizat (EU-DEM) cu carotele „extrase”
   în ordinea execuției. Three.js r128, fără alte dependențe.
   window.initIntro3D(D, INV, T)  –  D = data.json, T = terrain.json
   ============================================================ */
(function () {
  const VE = 30;            // exagerare verticală relief
  const CORE_S = 110;       // exagerare verticală carote (1 m = 110 unități)
  const CORE_R = 26;        // raza carotei (unități ≈ m în plan)
  const GAP = 70;           // distanța dintre teren și baza carotei extrase
  const BLUE = 0x0069B4, ORANGE = 0xF28C00, NAVY = 0x0A2F4F, WATER = 0x1F8FD8;

  window.initIntro3D = function (D, INV, T) {
    const host = document.getElementById('intro3d');
    if (!host || host.dataset.ready || !window.THREE || !T || !T.z) return;
    const THREE = window.THREE;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { host.classList.add('off'); return; }
    host.dataset.ready = '1';
    document.querySelector('.hero').classList.add('has3d');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    host.appendChild(renderer.domElement);

    /* ---------- geometrie: proiecție locală (m) ---------- */
    const n = T.n, latc = (T.lat0 + T.lat1) / 2, lonc = (T.lon0 + T.lon1) / 2;
    const kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 110540;
    const X = lon => (lon - lonc) * kx, Z = lat => -(lat - latc) * ky;
    const zmin = Math.min.apply(null, T.z), zmax = Math.max.apply(null, T.z);
    const H = z => (z - zmin) * VE;
    function zAt(lat, lon) {
      let fi = (lat - T.lat0) / (T.lat1 - T.lat0) * (n - 1), fj = (lon - T.lon0) / (T.lon1 - T.lon0) * (n - 1);
      fi = Math.max(0, Math.min(n - 1.001, fi)); fj = Math.max(0, Math.min(n - 1.001, fj));
      const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, g = (r, c) => T.z[r * n + c];
      return g(i, j) * (1 - a) * (1 - b) + g(i + 1, j) * a * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j + 1) * a * b;
    }
    const inside = (lat, lon) => lat >= T.lat0 && lat <= T.lat1 && lon >= T.lon0 && lon <= T.lon1;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.62); sun.position.set(-0.6, 1.4, 0.8); scene.add(sun);
    const world = new THREE.Group(); scene.add(world);

    /* ---------- teren ---------- */
    const pos = [], col = [], idx = [], cLo = new THREE.Color(0x8FB6D9), cHi = new THREE.Color(0xEAF1F7), c = new THREE.Color();
    const P = (i, j) => { const lat = T.lat0 + i * (T.lat1 - T.lat0) / (n - 1), lon = T.lon0 + j * (T.lon1 - T.lon0) / (n - 1); return [X(lon), H(T.z[i * n + j]), Z(lat)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j); pos.push(p[0], p[1], p[2]);
      c.copy(cLo).lerp(cHi, Math.pow((T.z[i * n + j] - zmin) / (zmax - zmin), 1.6)); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, d = a + n, e = d + 1; idx.push(a, b, d, b, e, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
    world.add(terrain);
    // caroiaj tehnic
    const gl = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j);
      if (j < n - 1) { const q = P(i, j + 1); gl.push(p[0], p[1] + 2, p[2], q[0], q[1] + 2, q[2]); }
      if (i < n - 1) { const q = P(i + 1, j); gl.push(p[0], p[1] + 2, p[2], q[0], q[1] + 2, q[2]); }
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
    world.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.16 })));
    // pereții blocului + contur
    const BASE = -260, sp = [], si = [], rim = [], foot = [];
    const border = [];
    for (let j = 0; j < n; j++) border.push([0, j]);
    for (let i = 1; i < n; i++) border.push([i, n - 1]);
    for (let j = n - 2; j >= 0; j--) border.push([n - 1, j]);
    for (let i = n - 2; i >= 0; i--) border.push([i, 0]);
    border.forEach((b, k) => {
      const p = P(b[0], b[1]); sp.push(p[0], p[1], p[2], p[0], BASE, p[2]);
      const q = P(border[(k + 1) % border.length][0], border[(k + 1) % border.length][1]);
      rim.push(p[0], p[1] + 2, p[2], q[0], q[1] + 2, q[2]); foot.push(p[0], BASE, p[2], q[0], BASE, q[2]);
      const a = 2 * k, a2 = 2 * ((k + 1) % border.length); si.push(a, a + 1, a2, a2, a + 1, a2 + 1);
    });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    world.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xDCE7F1, roughness: 1, flatShading: true, side: THREE.DoubleSide })));
    const mkLines = (arr, color, op) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
    world.add(mkLines(rim, NAVY, 0.85)); world.add(mkLines(foot, NAVY, 0.45));
    [[0, 0], [0, n - 1], [n - 1, n - 1], [n - 1, 0]].forEach(b => { const p = P(b[0], b[1]); world.add(mkLines([p[0], p[1], p[2], p[0], BASE, p[2]], NAVY, 0.45)); });

    /* ---------- puncte proiectate (traseul drumurilor) ---------- */
    const execIds = new Set(INV.map(i => i.id)), pp = [];
    (D.puncte_proiectate || []).forEach(p => {
      if (execIds.has(p.id) || !/Foraje drumuri|dezveliri/.test(p.tip) || !inside(p.lat, p.lon)) return;
      pp.push(X(p.lon), H(zAt(p.lat, p.lon)) + 8, Z(p.lat));
    });
    if (pp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); world.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x7B8794, size: 4.5, sizeAttenuation: false }))); }

    /* ---------- carote ---------- */
    const order = INV.filter(i => i.lat != null && inside(i.lat, i.lon)).slice().sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.id.localeCompare(b.id, undefined, { numeric: true }));
    const cores = [], hits = [];
    const matCache = {}; const mat = hex => matCache[hex] || (matCache[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.9, metalness: 0 }));
    order.forEach((inv, k) => {
      const dz = inv.tip === 'dezvelire', dep = Math.max(+inv.adancime || 4, ...inv.straturi.map(s => s.la || 0)), L = dep * CORE_S;
      const g = new THREE.Group(); g.position.set(X(inv.lon), H(zAt(inv.lat, inv.lon)), Z(inv.lat)); world.add(g);
      // marcaj pe teren
      const ring = new THREE.Mesh(new THREE.RingGeometry(30, 48, 28), new THREE.MeshBasicMaterial({ color: dz ? ORANGE : BLUE, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 6; g.add(ring);
      const stemG = new THREE.BufferGeometry(); stemG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      const stem = new THREE.Line(stemG, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.55 })); g.add(stem);
      const core = new THREE.Group(); g.add(core);
      inv.straturi.forEach(s => {
        const la = s.la == null ? dep : s.la, h = Math.max((la - s.de) * CORE_S, 2);
        const geo = dz ? new THREE.BoxGeometry(CORE_R * 1.8, h, CORE_R * 1.8) : new THREE.CylinderGeometry(CORE_R, CORE_R, h, 18);
        const m = new THREE.Mesh(geo, mat(litho(s.descriere).c)); m.position.y = -(s.de + la) / 2 * CORE_S; core.add(m);
      });
      const cap = new THREE.Mesh(dz ? new THREE.BoxGeometry(CORE_R * 2.3, 14, CORE_R * 2.3) : new THREE.CylinderGeometry(CORE_R * 1.3, CORE_R * 1.3, 14, 18), new THREE.MeshStandardMaterial({ color: dz ? ORANGE : BLUE, roughness: 0.6 }));
      cap.position.y = 7; core.add(cap);
      if (inv.NH != null) { const w = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R * 2.8, CORE_R * 2.8, 7, 28), new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.55, depthWrite: false })); w.position.y = -inv.NH * CORE_S; w.userData.pulse = true; core.add(w); }
      if (inv.IN != null) { const w = new THREE.Mesh(new THREE.TorusGeometry(CORE_R * 1.7, 4, 8, 28), new THREE.MeshBasicMaterial({ color: WATER })); w.rotation.x = Math.PI / 2; w.position.y = -inv.IN * CORE_S; core.add(w); }
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R * 2.4, CORE_R * 2.4, L + 120, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = -L / 2 + 40; hit.userData.inv = inv; core.add(hit); hits.push(hit);
      cores.push({ inv, g, core, stem, L, k, label: null });
    });

    // etichete (după încărcarea fonturilor)
    function addLabels() {
      cores.forEach(o => {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const x = cv.getContext('2d');
        x.font = '600 58px "Barlow Condensed", "Barlow", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.95)'; x.strokeText(o.inv.id, 128, 50);
        x.fillStyle = '#0A2F4F'; x.fillText(o.inv.id, 128, 50);
        const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.scale.set(250, 94, 1); sp.position.y = 78; o.core.add(sp); o.label = sp;
      });
    }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(addLabels, addLabels);

    /* ---------- HUD ---------- */
    const hud = document.createElement('div'); hud.className = 'i3-hud';
    hud.innerHTML = '<div class="i3-date"><b id="i3-d">—</b><span id="i3-n"></span></div>' +
      '<div class="i3-leg"><span><i style="background:#0069B4;border-radius:50%"></i>foraj drum (Fr)</span><span><i style="background:#F28C00"></i>dezvelire (D)</span><span><i style="background:#1F8FD8;border-radius:50%;opacity:.6"></i>apă (NH / infiltrație)</span></div>' +
      '<div class="i3-note">Relief EU-DEM 25 m, scară verticală ×' + VE + ' · carote 4 m redate ×' + CORE_S + ' · trage pentru a roti</div>' +
      '<button class="btn" id="i3-replay" type="button">↻ Reia animația</button>';
    host.appendChild(hud);
    const tip = document.createElement('div'); tip.className = 'i3-tip'; host.appendChild(tip);
    const elD = hud.querySelector('#i3-d'), elN = hud.querySelector('#i3-n');
    const fmt = s => { if (!s) return '—'; const p = s.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };

    /* ---------- cameră ---------- */
    const camera = new THREE.PerspectiveCamera(30, 2, 50, 60000);
    const target = new THREE.Vector3(0, 120, 0);
    let az = -0.65, el = 0.46, elBase = 0.46, Rad = 8300, W = 0, Hh = 0, auto = true, lastUser = 0;
    function resize() {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; W = w; Hh = h;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      Rad = 7600 * Math.max(1, 1.75 / camera.aspect); if (Rad > 15000) Rad = 15000;
      if (w > 900) camera.setViewOffset(w, h, -w * 0.13, -h * 0.02, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
    resize();

    /* ---------- interacțiune ---------- */
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let drag = null, moved = 0, hover = null;
    const cvs = renderer.domElement; cvs.style.touchAction = 'pan-y';
    function pick(ev) {
      const r = cvs.getBoundingClientRect(); mouse.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(hits, false); return h.length ? h[0].object.userData.inv : null;
    }
    cvs.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az, el: elBase }; moved = 0; try { cvs.setPointerCapture(e.pointerId); } catch (_) {} });
    cvs.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        az = drag.az - dx * 0.006; if (e.pointerType !== 'touch') elBase = Math.max(0.18, Math.min(1.25, drag.el + dy * 0.004));
        lastUser = performance.now(); tip.style.display = 'none'; return;
      }
      const inv = pick(e); hover = inv; cvs.style.cursor = inv ? 'pointer' : 'grab';
      if (inv) {
        const r = host.getBoundingClientRect();
        const w = inv.NH != null ? 'NH = ' + String(inv.NH.toFixed(2)).replace('.', ',') + ' m' : (inv.IN != null ? 'infiltrație la ' + String(inv.IN.toFixed(2)).replace('.', ',') + ' m' : 'fără apă');
        tip.innerHTML = '<b>' + inv.id + '</b> · ' + (inv.tip === 'dezvelire' ? 'dezvelire' : 'foraj drum') + '<br>' + fmt(inv.data) + ' · ' + (+inv.adancime).toFixed(2).replace('.', ',') + ' m<br><span class="w">' + w + '</span><br><em>click pentru fișă</em>';
        tip.style.display = 'block'; tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 190) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      } else tip.style.display = 'none';
    });
    const end = e => { if (drag && moved < 6) { const inv = pick(e); if (inv) location.hash = '#/i/' + inv.id; } drag = null; };
    cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', () => { drag = null; });
    cvs.addEventListener('pointerleave', () => { tip.style.display = 'none'; hover = null; });

    /* ---------- animație ---------- */
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEP = 0.2, DUR = 1.25, T0 = 0.7; let t0 = performance.now(), visible = true, lastShown = -1;
    hud.querySelector('#i3-replay').onclick = () => { t0 = performance.now(); lastShown = -1; };
    if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
    const ease = x => 1 - Math.pow(1 - x, 3);
    let prev = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !W || document.hidden) { prev = now; return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; const t = (now - t0) / 1000;
      let shown = -1, ml = 0;
      cores.forEach(o => {
        let p = reduce ? 1 : (t - T0 - o.k * STEP) / DUR; p = p < 0 ? 0 : p > 1 ? 1 : p; const e = ease(p);
        if (p > 0) { shown = Math.max(shown, o.k); ml += (+o.inv.adancime || 0) * (p >= 1 ? 1 : e); }
        o.core.position.y = e * (o.L + GAP) + (p >= 1 && !reduce ? Math.sin(now / 900 + o.k) * 5 : 0);
        o.core.visible = p > 0; o.core.rotation.y = (1 - e) * 2.2;
        const a = o.stem.geometry.attributes.position; a.setY(1, Math.max(0, o.core.position.y - o.L)); a.needsUpdate = true;
        if (hover === o.inv) o.core.scale.setScalar(1.12); else o.core.scale.setScalar(1);
        o.core.children.forEach(ch => { if (ch.userData.pulse) { const s = 1 + 0.12 * Math.sin(now / 420 + o.k); ch.scale.set(s, 1, s); } });
      });
      if (shown !== lastShown) { lastShown = shown; elD.textContent = shown < 0 ? fmt(order[0] && order[0].data) : fmt(order[shown].data); }
      elN.textContent = (shown + 1) + ' / ' + order.length + ' investigații · ' + ml.toFixed(0) + ' m forați';
      if (!drag && !reduce && now - lastUser > 2500) az += dt * 0.055;
      const sc = Math.max(0, Math.min(1, -host.getBoundingClientRect().top / Math.max(1, Hh)));
      el += ((elBase + sc * 0.45) - el) * 0.08;
      const ce = Math.cos(el);
      camera.position.set(target.x + Rad * ce * Math.sin(az), target.y + Rad * Math.sin(el), target.z + Rad * ce * Math.cos(az));
      camera.lookAt(target); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
})();
