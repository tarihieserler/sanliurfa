'use strict';
(() => {
  const $ = s => document.querySelector(s);
  try { boot(); } catch (e) { fail(e); }

  function fail(e) {
    console.error(e);
    $('#error-message').textContent = 'Oyun başlatılırken sorun oluştu: ' + (e && e.message ? e.message : 'bilinmeyen hata');
    $('#error').classList.remove('hidden');
  }

  function boot() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbadbd4);
    scene.fog = new THREE.Fog(0xbadbd4, 48, 100);
    const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 120);
    camera.rotation.order = 'YXZ';
    const mobile = matchMedia('(max-width: 720px)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.15 : 1.4));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    $('#game').appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    scene.add(new THREE.HemisphereLight(0xfff4df, 0x77664e, 1.15));
    const sun = new THREE.DirectionalLight(0xffe5c1, 1.25);
    sun.position.set(-16, 26, 12); sun.castShadow = !mobile;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -.0005; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd6f1e9, .3); fill.position.set(10, 8, -12); scene.add(fill);

    const stoneTexture = makeTexture('stone');
    const pavingTexture = makeTexture('paving');
    const stoneMats = [0xd6bf98, 0xcbb28a, 0xe0cba4, 0xc4a77d].map(color =>
      new THREE.MeshStandardMaterial({ map: stoneTexture, color: color, roughness: .95, flatShading: true }));
    const floorMat = new THREE.MeshStandardMaterial({ map: pavingTexture, color: 0xe8d4ac, roughness: .96 });
    const mats = {};
    const mat = (color, rough) => {
      const k = color + ':' + (rough || .9);
      if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color: color, roughness: rough || .9, flatShading: true });
      return mats[k];
    };
    const world = new THREE.Group(); scene.add(world);
    const solids = [], people = [], fish = [], ripples = [], sparkles = [];
    const player = { x: -13, z: 17, eye: 1.67, radius: .34, yaw: -.12, pitch: -.01, vx: 0, vz: 0, bob: 0 };
    let active = false, isLocked = false, isTalking = false, looking = false;
    let targetYaw = player.yaw, targetPitch = player.pitch, nearby = null;
    let progress = loadProgress(), toastTimer = 0, audio = null, muted = false;
    let last = 0, walkTime = 0;
    const keys = {};
    const geoCache = { box: new Map(), sphere: new Map(), cylinder: new Map() };

    function add(mesh, parent, shadows) {
      (parent || world).add(mesh);
      if (shadows !== false) { mesh.castShadow = true; mesh.receiveShadow = true; }
      return mesh;
    }
    function box(w, h, d, color, x, y, z, parent, material) {
      const k = [w, h, d].join(':');
      if (!geoCache.box.has(k)) geoCache.box.set(k, new THREE.BoxGeometry(w, h, d));
      const mesh = new THREE.Mesh(geoCache.box.get(k), material || mat(color));
      mesh.position.set(x, y, z); return add(mesh, parent);
    }
    function sphere(r, color, x, y, z, parent, n, material) {
      const seg = n || 10, k = r + ':' + seg;
      if (!geoCache.sphere.has(k)) geoCache.sphere.set(k, new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)));
      const mesh = new THREE.Mesh(geoCache.sphere.get(k), material || mat(color));
      mesh.position.set(x, y, z); return add(mesh, parent);
    }
    function cylinder(rt, rb, h, color, x, y, z, parent, n, material) {
      const seg = n || 10, k = [rt, rb, h, seg].join(':');
      if (!geoCache.cylinder.has(k)) geoCache.cylinder.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
      const mesh = new THREE.Mesh(geoCache.cylinder.get(k), material || mat(color));
      mesh.position.set(x, y, z); return add(mesh, parent);
    }
    function group(x, y, z, parent) {
      const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); (parent || world).add(g); return g;
    }
    function obstacleBox(x, z, w, d, y, h, mesh) {
      solids.push({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, mesh: mesh });
    }
    function obstacleCircle(x, z, radius, mesh) { solids.push({ type: 'circle', x: x, z: z, r: radius, mesh: mesh }); }
    function solidBox(x, z, w, d, color, y, h, material) {
      const m = box(w, h, d, color || 0xffffff, x, y === undefined ? h / 2 : y, z, world, material);
      obstacleBox(x, z, w, d, y, h, m); return m;
    }
    function stoneWall(x, y, z, w, h, d, variant, collide) {
      const material = stoneMats[((variant || 0) % stoneMats.length + stoneMats.length) % stoneMats.length];
      const m = box(w, h, d, 0xffffff, x, y, z, world, material);
      if (collide !== false) obstacleBox(x, z, w, d, y, h, m);
      return m;
    }
    function cylinderObstacle(x, z, r, h, color, y) {
      const m = cylinder(r, r, h, color, x, y === undefined ? h / 2 : y, z, world, 9);
      obstacleCircle(x, z, r + .09, m); return m;
    }

    // Broad open plaza: tiled stone ground and visible low walls define the playable edge.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(62, 62), floorMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.07; ground.receiveShadow = true; world.add(ground);
    // Boundary stone wall: it is visible and its collision matches the stone blocks.
    for (let x = -25; x <= 25; x += 5) {
      stoneWall(x, .9, -28, 4.85, 1.8, .42, 1, true);
      stoneWall(x, .9, 28, 4.85, 1.8, .42, 2, true);
      box(4.9, .24, .62, 0xb69b72, x, 1.83, -28);
      box(4.9, .24, .62, 0xb69b72, x, 1.83, 28);
    }
    stoneWall(-28, .9, 0, .42, 1.8, 56, 2, true);
    stoneWall(28, .9, 0, .42, 1.8, 56, 1, true);

    // Halilürrahman Gölü: turquoise water, paved walking edge, stone coping and channel.
    cylinder(8.5, 8.5, .42, 0xc5aa81, 0, .1, 0, world, 64);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x42b4bb, specular: 0xc2fff4, shininess: 90, transparent: true, opacity: .94, side: THREE.DoubleSide });
    const water = new THREE.Mesh(new THREE.CircleGeometry(8.08, 64), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.y = .33; world.add(water);
    const edge = new THREE.Mesh(new THREE.RingGeometry(8.1, 8.52, 64), mat(0xe0cba5));
    edge.rotation.x = -Math.PI / 2; edge.position.y = .38; add(edge);
    const walk = new THREE.Mesh(new THREE.RingGeometry(8.55, 13.8, 96), floorMat);
    walk.rotation.x = -Math.PI / 2; walk.position.y = .045; add(walk, world, false);
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI * 2 / 64, r = 8.52;
      const stone = box(.74, .24, .52, i % 3 ? 0xd4bd94 : 0xe3d0aa, Math.cos(a) * r, .42, Math.sin(a) * r);
      stone.rotation.y = -a;
    }
    // Water rills, carved retaining edges and a little stone crossing.
    const rill = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 12), waterMat);
    rill.rotation.x = -Math.PI / 2; rill.position.set(-14.3, .08, 7.5); add(rill, world, false);
    for (const x of [-15.65, -12.95]) solidBox(x, 7.5, .25, 12.2, 0xcdb893, .22, .44);
    for (const z of [1.45, 13.55]) solidBox(-14.3, z, 3.1, .26, 0xcdb893, .22, .44);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.25 + (i % 2) * .13, .018, 5, 28), new THREE.MeshBasicMaterial({ color: 0xc2fff0, transparent: true, opacity: .4 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(Math.cos(i * 2.3) * 4.9, .4, Math.sin(i * 2.3) * 4.9); add(ring, world, false); ripples.push(ring);
    }
    function makeFish(x, z, color, phase) {
      const f = group(x, .43, z), body = sphere(.3, color, 0, 0, 0, f, 9);
      body.scale.set(1.45, .62, .72);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(.19, .34, 4), mat(color));
      tail.position.x = -.4; tail.rotation.z = Math.PI / 2; add(tail, f, false);
      sphere(.034, 0x253c3c, .2, .06, .18, f, 7);
      fish.push({ mesh: f, x: x, z: z, phase: phase });
    }
    makeFish(-2, -2, 0xec9d67, .1); makeFish(3, 1, 0xe7c56e, 2.2); makeFish(1, 4, 0xef8c69, 4.1);
    makeFish(-4, 2, 0xf2c878, 5.4); makeFish(4, -3, 0xf0a16d, 1.4); makeFish(-1, 5, 0xe7bd75, 3.3);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10 + .2, r = 6.2 + (i % 2) * .45, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(.35, 9), mat(i % 2 ? 0x699879 : 0x82a87c));
      pad.rotation.x = -Math.PI / 2; pad.position.set(x, .365, z); add(pad, world, false);
      if (i % 3 === 0) sphere(.13, 0xf1b9a6, x + .1, .43, z, world, 7);
    }

    // Small seating nooks and flower pots around the water.
    function bench(x, z, angle) {
      const g = group(x, 0, z), seat = box(1.65, .14, .45, 0x96704c, 0, .62, 0, g);
      seat.rotation.y = angle; const back = box(1.65, .54, .12, 0xa57d55, 0, .97, -.16, g); back.rotation.y = angle;
      for (const dx of [-.62, .62]) cylinder(.06, .07, .58, 0x765d43, dx, .3, 0, g, 7);
      const sx = Math.abs(Math.cos(angle)) * .9 + Math.abs(Math.sin(angle)) * .3;
      const sz = Math.abs(Math.sin(angle)) * .9 + Math.abs(Math.cos(angle)) * .3;
      solids.push({ type: 'box', minX: x - sx, maxX: x + sx, minZ: z - sz, maxZ: z + sz });
    }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .36; bench(Math.cos(a) * 11.7, Math.sin(a) * 11.7, -a); }
    function planter(x, z, flower) {
      cylinder(.4, .52, .6, 0xb87858, x, .3, z, world, 9); cylinder(.44, .44, .1, 0xe1c79b, x, .62, z, world, 9);
      obstacleCircle(x, z, .42);
      for (let i = 0; i < 5; i++) sphere(.2, flower ? [0xe9a08a, 0xe2bd5a, 0x9caaca][i % 3] : 0x749b72, x + Math.cos(i * 1.25) * .22, .92 + (i % 2) * .08, z + Math.sin(i * 1.25) * .22, world, 7);
    }
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10 + .1; planter(Math.cos(a) * 13.1, Math.sin(a) * 13.1, i % 2 === 0); }

    // Rızvaniye Mosque and medrese: north-side stone courtyard, three domes, one minaret.
    function arch(x, y, z, radius, color) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, .14, 8, 22, Math.PI), mat(color));
      m.position.set(x, y, z); return add(m);
    }
    function mosque(cx, cz, face, variant) {
      const w = 10.8, d = 7.1, h = 4.25, thick = .52, frontZ = cz + face * d / 2, doorW = 2.15;
      box(w - .7, .12, d - .7, 0xd8c49e, cx, .12, cz);
      stoneWall(cx, h / 2, cz - face * d / 2, w, h, thick, variant, true);
      stoneWall(cx - w / 2 + thick / 2, h / 2, cz, thick, h, d, variant + 1, true);
      stoneWall(cx + w / 2 - thick / 2, h / 2, cz, thick, h, d, variant + 2, true);
      const sideW = (w - doorW) / 2;
      stoneWall(cx - doorW / 2 - sideW / 2, h / 2, frontZ, sideW, h, thick, variant + 1, true);
      stoneWall(cx + doorW / 2 + sideW / 2, h / 2, frontZ, sideW, h, thick, variant + 2, true);
      stoneWall(cx, h - .36, frontZ, doorW, .72, thick, variant, false);
      box(w + .45, .32, d + .45, 0xb89a70, cx, h + .12, cz);
      for (const dx of [-3.25, 0, 3.25]) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8c49f));
        dome.position.set(cx + dx, h + .27, cz); add(dome);
        cylinder(.045, .045, .4, 0xb48e56, cx + dx, h + 1.7, cz, world, 7);
      }
      const portalZ = frontZ + face * .31;
      cylinder(.16, .2, 2.65, 0xe2cea7, cx - 1.2, 1.32, portalZ, world, 9);
      cylinder(.16, .2, 2.65, 0xc1a47b, cx + 1.2, 1.32, portalZ, world, 9);
      arch(cx, 2.58, portalZ, 1.2, 0xe8d6b4);
      // The door leaves stand open; the gap between them is the walkable entrance.
      box(.28, 2.05, .1, 0x795a40, cx - 1.02, 1.02, portalZ + face * .04);
      box(.28, 2.05, .1, 0x916844, cx + 1.02, 1.02, portalZ + face * .04);
      for (const dx of [-3.9, -2.55, 2.55, 3.9]) {
        box(.58, 1.1, .08, 0x779287, cx + dx, 2.55, portalZ);
        box(.76, .12, .13, 0xe1cda7, cx + dx, 3.12, portalZ + face * .05);
      }
      for (const dx of [-3.45, 3.45]) cylinder(.18, .22, 3, 0xcdb58e, cx + dx, 1.62, cz, world, 9);
      const niche = box(1.1, 2.1, .2, 0xb89d74, cx, 1.2, cz - face * (d / 2 - .18));
      niche.material = stoneMats[(variant + 1) % stoneMats.length];
      if (variant === 0) {
        const mx = cx + 7.15, mz = cz + .2;
        cylinder(.48, .68, 6.5, 0xcbb38c, mx, 3.25, mz, world, 12);
        cylinder(.75, .75, .2, 0xe0c99e, mx, 5.15, mz, world, 12);
        cylinder(.42, .48, 1.35, 0xd1b990, mx, 5.9, mz, world, 11);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.05, 9), mat(0x85988d)); cap.position.set(mx, 7.08, mz); add(cap);
        cylinder(.035, .035, .5, 0xd3a95c, mx, 7.82, mz, world, 6);
        obstacleCircle(mx, mz, .56);
      }
      return { frontZ: frontZ, width: w, depth: d };
    }
    mosque(0, -17.3, 1, 0);
    // Medrese arcade and courtyard attached to the north-east of the mosque.
    const ax = 10.2, az = -19.1;
    stoneWall(ax + 3.2, 1.75, az, .5, 3.5, 8.2, 2, true);
    stoneWall(ax, 3.34, az, 7, .32, 8.2, 0, false);
    for (const z of [az - 3.9, az, az + 3.9]) for (const x of [ax - 3.1, ax, ax + 3.1]) {
      cylinder(.24, .26, 3.1, 0xcbb38c, x, 1.55, z, world, 9); obstacleCircle(x, z, .31);
      cylinder(.34, .34, .14, 0xe3cda6, x, 3.17, z, world, 9);
    }
    for (const z of [az - 3.9, az + 3.9]) for (const x of [ax - 1.55, ax + 1.55]) arch(x, 2.12, z, 1.42, 0xd7c39f);
    // Halilürrahman Mosque: south-east of the pool, a lower, more enclosed courtyard.
    mosque(15, 15.4, -1, 2);
    for (let i = 0; i < 3; i++) {
      const x = 9.5 + i * 3.5, z = 10.9;
      cylinder(.17, .17, 2.5, 0xc9af86, x, 1.25, z, world, 8); obstacleCircle(x, z, .23);
      if (i < 2) arch(x + 1.6, 2.06, z, 1.45, 0xdfcba6);
    }

    // Traditional courtyard houses around the playable plateau, with a real doorway in each facade.
    function courtyardHouse(cx, cz, w, d, variant, face) {
      const h = 4.5, front = cz + face * d / 2, door = 1.55, t = .5;
      stoneWall(cx, h / 2, cz - face * d / 2, w, h, t, variant, true);
      stoneWall(cx - w / 2 + t / 2, h / 2, cz, t, h, d, variant + 1, true);
      stoneWall(cx + w / 2 - t / 2, h / 2, cz, t, h, d, variant + 2, true);
      const sw = (w - door) / 2;
      stoneWall(cx - door / 2 - sw / 2, h / 2, front, sw, h, t, variant + 1, true);
      stoneWall(cx + door / 2 + sw / 2, h / 2, front, sw, h, t, variant + 2, true);
      stoneWall(cx, h - .32, front, door, .64, t, variant, false);
      box(w + .18, .24, d + .18, 0xb99a71, cx, 4.6, cz);
      box(w - 1, .12, d - 1, 0xd7c39f, cx, .08, cz - face * (d / 2 - .9));
      // Corner returns preserve the courtyard; the facade gap is the only entrance.
      for (const dx of [-1, 1]) stoneWall(cx + dx * (w / 2 - .53), 1.45, cz - face * (d / 2 - .9), .22, 2.9, 1.7, variant, true);
      box(.62, 2.2, .12, 0x795940, cx - .43, 1.1, front + face * .32).rotation.y = face > 0 ? -.58 : .58;
      box(1.9, .13, .15, 0xe3d0ab, cx, 2.43, front + face * .32);
      for (const dx of [-w * .28, w * .28]) {
        box(.78, .82, .11, 0x789188, cx + dx, 2.25, front + face * .32);
        box(.96, .12, .16, 0xc5a77b, cx + dx, 2.73, front + face * .35);
      }
      box(2.5, .12, 1.8, 0x9d7751, cx, 4.83, cz - face * (d / 2 - .6));
      for (const dx of [-1, 1]) cylinder(.055, .055, 1.1, 0x8c704e, cx + dx, 4.4, cz - face * (d / 2 - .6), world, 7);
    }
    courtyardHouse(-22, -20.5, 8, 7, 0, 1); courtyardHouse(22, -20.5, 8, 7, 2, 1);
    courtyardHouse(-22, 20.5, 8, 7, 1, -1); courtyardHouse(22, 20.5, 8, 7, 3, -1);

    // Bazaar: copperware, spice jars, handwoven textiles and striped awnings.
    function stall(x, z, canopy, type) {
      const g = group(x, 0, z);
      box(3.35, 1.5, 2.15, 0xb28d65, 0, .75, 0, g);
      box(3.65, .15, 2.65, canopy, 0, 2.2, 0, g);
      for (let i = -2; i <= 2; i++) box(.12, .08, 2.7, i % 2 ? 0xf0d9aa : canopy, i * .72, 2.29, 0, g);
      for (const dx of [-1.48, 1.48]) cylinder(.075, .09, 2.12, 0x806044, dx, 1.08, 0, g, 7);
      box(3, .6, .24, 0xd2b181, 0, 1.36, 1.12, g);
      obstacleBox(x, z, 3.5, 2.5);
      if (type === 'copper') for (let i = 0; i < 5; i++) {
        const px = -1.15 + i * .56, pot = sphere(.24, i % 2 ? 0xb97947 : 0xc18b51, px, 1.92, 1.08, g, 10);
        pot.scale.set(.8, .94, .8); cylinder(.1, .17, .2, 0xc28c53, px, 2.12, 1.08, g, 8);
      }
      else if (type === 'spice') for (let i = 0; i < 6; i++) {
        const px = -1.18 + (i % 3) * 1.16, pz = .63 + Math.floor(i / 3) * .5;
        cylinder(.29, .24, .45, [0xb65339, 0xcba33d, 0x71804b][i % 3], px, 1.77, pz, g, 9);
      }
      else for (let i = 0; i < 4; i++) box(.48, .55, .07, [0x925e6a, 0xd8b452, 0x658a7b, 0xe0c38e][i], -.96 + i * .64, 1.88, 1.09, g);
    }
    stall(18, -3.5, 0xd16b51, 'copper'); stall(21, 1, 0xd7ac4c, 'spice'); stall(-19, 6.5, 0x698f81, 'textile');
    // Stone lanterns and leafy pots make the path feel occupied, with matching physical bounds.
    function lantern(x, z) {
      cylinderObstacle(x, z, .12, 2.7, 0x755b42, 1.35);
      box(.42, .12, .42, 0x7b6045, x, 2.61, z);
      const glow = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshBasicMaterial({ color: 0xffd68d }));
      glow.position.set(x, 2.9, z); add(glow);
      const top = new THREE.Mesh(new THREE.ConeGeometry(.3, .3, 7), mat(0x765d43)); top.position.set(x, 3.18, z); add(top);
    }
    for (const p of [[-14, 0], [14, 2], [-13, -5], [13, -7], [-6, 14], [7, 14]]) lantern(p[0], p[1]);
    function flowerPot(x, z, color) {
      cylinder(.35, .45, .55, 0xb87858, x, .275, z, world, 9); cylinder(.4, .4, .09, 0xe2c99c, x, .57, z, world, 9);
      obstacleCircle(x, z, .39);
      for (let i = 0; i < 5; i++) sphere(.22, color[i % color.length], x + Math.cos(i * 1.25) * .2, .86 + (i % 2) * .08, z + Math.sin(i * 1.25) * .2, world, 7);
    }
    for (const p of [[-14, 9], [-14, -1], [14, 8], [12, -8], [-5, 14], [5, 14]]) flowerPot(p[0], p[1], [0x779b72, 0xe1ad8c, 0xe0bf5c]);

    // NPCs: local guide, a copper artisan, a young visitor and two strolling neighbours.
    function makePerson(x, z, options) {
      options = options || {};
      const root = group(x, 0, z), shirt = mat(options.shirt || 0x618f7b), skin = options.skin || 0xd5a27d;
      const torso = box(.62, .82, .4, 0xffffff, 0, .92, 0, root, shirt);
      const head = sphere(.28, skin, 0, 1.62, 0, root, 10);
      sphere(.04, 0x403a32, -.1, 1.67, .255, root, 7); sphere(.04, 0x403a32, .1, 1.67, .255, root, 7);
      const scarf = options.scarf ? sphere(.3, options.scarf, 0, 1.48, -.02, root, 8) : null;
      if (scarf) scarf.scale.set(1.08, .48, 1);
      if (options.hat) { cylinder(.17, .28, .15, options.hat, 0, 1.9, 0, root, 8); box(.42, .07, .28, options.hat, 0, 1.84, .17, root); }
      const arms = [];
      for (const side of [-1, 1]) {
        const arm = box(.17, .58, .2, 0xffffff, side * .4, 1.02, 0, root, shirt);
        arm.rotation.z = side * -.12; arms.push(arm);
      }
      const legs = [];
      for (const side of [-1, 1]) legs.push(box(.2, .53, .23, 0x626c7a, side * .18, .26, 0, root));
      const npc = { mesh: root, torso: torso, head: head, arms: arms, legs: legs, x: x, z: z, route: options.route || null, routeIndex: 0, walk: Math.random() * 6, data: options.data || null, label: options.label || 'Şehir sakini', icon: options.icon || '🙂', idle: Math.random() * 6, moving: false };
      people.push(npc); return npc;
    }
    const guide = makePerson(-10.5, 10.2, { shirt: 0x619481, scarf: 0xe8bc66, label: 'Rehber Zeynep', icon: '🧕🏻', data: 'guide' });
    makePerson(14.4, -7.3, { shirt: 0x9a684f, hat: 0x6a5140, route: [[14.4, -7.3], [16, -8.2], [17.5, -6.8], [15.9, -5.8]], label: 'Gezgin', icon: '🧔🏻' });
    makePerson(2.4, -11.2, { shirt: 0x688eae, scarf: 0xd8a06a, label: 'Öğrenci Mina', icon: '👧🏻', data: 'student' });
    makePerson(-4.5, 10.7, { shirt: 0x9d7aa4, route: [[-4.5, 10.7], [-2.4, 11.7], [-3.4, 13], [-5.2, 12.3]], label: 'Gezgin', icon: '👩🏻' });
    makePerson(5.4, 11.7, { shirt: 0x728c68, hat: 0xb18455, route: [[5.4, 11.7], [7.3, 10.3], [6.5, 8.7], [4.7, 9.6]], label: 'Gezgin', icon: '🧑🏻' });
    // A friendly vendor stays behind the copper stall counter; the collision is the stall itself.
    makePerson(18, -1.25, { shirt: 0x805d49, hat: 0xc69c5b, label: 'Bakır ustası İsmail', icon: '🧔🏻', data: 'artisan' });

    // Three glowing tokens sit on the actual walkable promenade.
    const tokenCoords = [[-8.9, 7], [8.7, 7.5], [0, -12.5]];
    tokenCoords.forEach((p, i) => {
      if (progress.tokens.indexOf(i) >= 0) return;
      const g = group(p[0], 0, p[1]);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), mat(0xffd45f)); gem.position.y = .95; add(gem, g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.48, .055, 6, 18), mat(0xffefaa)); ring.position.y = .95; add(ring, g);
      sparkles.push({ id: i, x: p[0], z: p[1], mesh: g });
    });
    $('#collect-count').textContent = progress.tokens.length;
    if (progress.guide) $('#quest-text').textContent = 'Kıyıdaki 3 hatırayı bul';

    // Dialogue lines distinguish documented facts from local oral tradition.
    const stories = {
      guide: {
        name: 'Rehber Zeynep', icon: '🧕🏻', mission: true,
        pages: [
          'Hoş geldin! Burası Halilürrahman Gölü; pek çok kişi ona Balıklıgöl der. Şanlıurfa’nın Eyyübiye ilçesinde, şehir merkezinin güneybatısındayız.',
          'Kuzey kıyısındaki Rızvaniye Camii ve medresesi, göl çevresindeki tarihî yapı topluluğunun parçası. Rızvaniye Camii 1736 yılında yaptırılmış.',
          'Burada Hz. İbrahim ve ateşin göle dönüşmesiyle ilgili bir anlatı da paylaşılır. Bu, tarihî bir kayıt değil; bölgenin inanç ve sözlü anlatı geleneğidir.',
          'Şimdi göl kıyısındaki üç parıltılı hatırayı bul. Balıklara bakabilir, taş yolu ve avluları keşfedebilirsin. Balıkları rahat bırakmayı unutma!'
        ]
      },
      artisan: {
        name: 'Bakır ustası İsmail', icon: '🧔🏻', pages: [
          'Selam küçük gezgin! Urfa çarşılarında bakır işçiliği uzun zamandır yaşatılan zanaatlardan biridir.',
          'Bakır levhaya çekiçle küçük küçük vurarak desen verilir. Her ustanın eli ve deseni biraz farklı olur.'
        ]
      },
      student: {
        name: 'Öğrenci Mina', icon: '👧🏻', pages: [
          'Merhaba! Göl çevresinde Halilürrahman ve Aynzeliha gölleriyle tarihî yapılar bir arada bulunuyor.',
          'Kıyıdaki taşları ve eski duvarları dikkatle incele. Her biri bu alanın uzun geçmişinden bir iz taşıyor.'
        ]
      }
    };
    let dialogStory = null, dialogPage = 0;
    function openDialogue(story) {
      if (!story) { toast('Yakındaki kişiyle E tuşuna basarak konuş.'); return; }
      if (!story.pages) story = stories[story.data];
      if (!story) return;
      dialogStory = story; dialogPage = 0; isTalking = true;
      if (document.pointerLockElement) document.exitPointerLock();
      $('#speaker-name').textContent = story.name;
      $('#speaker-icon').textContent = story.icon;
      showDialoguePage();
      $('#dialog').classList.remove('hidden');
    }
    function showDialoguePage() {
      const p = dialogStory.pages[dialogPage];
      $('#dialog-text').textContent = p;
      $('#dialog-progress').textContent = (dialogPage + 1) + ' / ' + dialogStory.pages.length;
      $('#dialog-next').innerHTML = dialogPage + 1 < dialogStory.pages.length ? 'Devam <span>→</span>' : (dialogStory.mission ? 'Göreve başla <span>✦</span>' : 'Görüşürüz <span>→</span>');
    }
    function closeDialogue() {
      const completed = dialogStory && dialogStory.mission;
      $('#dialog').classList.add('hidden'); isTalking = false;
      if (completed) {
        progress.guide = true; saveProgress();
        $('#quest-text').textContent = 'Kıyıdaki 3 hatırayı bul';
        toast('Yeni görev: kıyıdaki üç parıltıyı bul!');
      }
    }
    $('#dialog-next').addEventListener('click', () => {
      if (!dialogStory) return;
      if (dialogPage + 1 < dialogStory.pages.length) { dialogPage++; showDialoguePage(); }
      else closeDialogue();
    });

    function startAudio() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || audio) return;
        audio = new AC();
        const length = audio.sampleRate * 2, buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * .16;
        const noise = audio.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520;
        ambientGain = audio.createGain(); ambientGain.gain.value = .045;
        noise.connect(filter); filter.connect(ambientGain); ambientGain.connect(audio.destination); noise.start();
        birdTimer = window.setInterval(() => { if (!audio || muted) return; birdCall(); }, 7200);
        birdCall();
      } catch (e) { console.warn('Ortam sesi açılamadı', e); }
    }
    function birdCall() {
      if (!audio || muted || audio.state === 'closed') return;
      const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(1550, t); osc.frequency.exponentialRampToValueAtTime(2100, t + .09);
      osc.frequency.exponentialRampToValueAtTime(1300, t + .21); gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.025, t + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .24); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + .25);
    }
    $('#sound').addEventListener('click', () => {
      muted = !muted; $('#sound').textContent = muted ? '🔇' : '🔊';
      if (ambientGain) ambientGain.gain.setTargetAtTime(muted ? 0 : .045, audio.currentTime, .15);
    });
    function toast(text) {
      const el = $('#toast'); el.textContent = text; el.classList.remove('hidden');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
    }
    function safeLoad() {
      try { const s = JSON.parse(localStorage.getItem('urfa-balikligol-v2') || '{}'); return { guide: !!s.guide, tokens: Array.isArray(s.tokens) ? s.tokens.filter(x => x >= 0 && x < 3) : [] }; }
      catch (_) { return { guide: false, tokens: [] }; }
    }
    function saveProgress() { try { localStorage.setItem('urfa-balikligol-v2', JSON.stringify(progress)); } catch (_) {} }

    function nearestPerson() {
      let best = null, bestD = 2.65;
      for (const p of people) {
        const d = Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }
    function nearestToken() {
      let best = null, bestD = 1.35;
      for (const t of sparkles) { const d = Math.hypot(t.x - player.x, t.z - player.z); if (d < bestD) { bestD = d; best = t; } }
      return best;
    }
    function interact() {
      if (!active || isTalking) return;
      const p = nearestPerson();
      if (p) { if (p.data) openDialogue({ data: p.data }); else toast('Şehir sakinleri göl kıyısında geziniyor.'); return; }
      const token = nearestToken();
      if (token) {
        progress.tokens.push(token.id); saveProgress(); token.mesh.removeFromParent();
        sparkles.splice(sparkles.indexOf(token), 1);
        $('#collect-count').textContent = progress.tokens.length;
        toast('Göl kıyısından bir parıltı buldun! ✨');
        if (progress.tokens.length >= 3) { $('#quest-text').textContent = 'Balıklıgöl keşfi tamamlandı!'; toast('Balıklıgöl keşfini tamamladın!'); }
        return;
      }
      toast('Yakında konuşabileceğin biri ya da bir keşif yok.');
    }
    $('#touch-action').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
    $('#home').addEventListener('click', () => {
      active = false; isTalking = false; $('#dialog').classList.add('hidden'); $('#welcome').classList.remove('hidden');
      $('#hud').classList.add('hidden'); $('#crosshair').classList.add('hidden');
      $('#joystick').classList.add('hidden'); $('#touch-action').classList.add('hidden'); $('#look-hint').classList.add('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    });
    $('#start').addEventListener('click', () => {
      active = true; $('#welcome').classList.add('hidden'); $('#hud').classList.remove('hidden');
      $('#crosshair').classList.remove('hidden'); $('#joystick').classList.remove('hidden'); $('#touch-action').classList.remove('hidden');
      $('#look-hint').classList.remove('hidden'); startAudio(); canvas.requestPointerLock && canvas.requestPointerLock();
      toast(progress.guide ? 'Göl kıyısındaki hatıraları ara.' : 'Göl kıyısındaki rehber Zeynep’i bul.');
    });
    document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === canvas; if (!isLocked) looking = false; });
    document.addEventListener('pointerlockerror', () => { isLocked = false; });
    canvas.addEventListener('click', () => { if (active && !isTalking && !isLocked && canvas.requestPointerLock) canvas.requestPointerLock(); });
    document.addEventListener('mousemove', e => {
      if (!active || isTalking) return;
      if (isLocked) {
        targetYaw -= e.movementX * .0023;
        targetPitch = THREE.MathUtils.clamp(targetPitch - e.movementY * .002, -1.05, .95);
      }
    });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') { looking = true; canvas.setPointerCapture(e.pointerId); canvas._lookId = e.pointerId; canvas._lastX = e.clientX; canvas._lastY = e.clientY; }
      else if (!isLocked) { looking = true; canvas._lastX = e.clientX; canvas._lastY = e.clientY; }
    });
    canvas.addEventListener('pointermove', e => {
      if (!active || isTalking || !looking || (canvas._lookId !== undefined && e.pointerId !== canvas._lookId)) return;
      if (e.pointerType === 'touch' || !isLocked) {
        const dx = e.clientX - canvas._lastX, dy = e.clientY - canvas._lastY;
        targetYaw -= dx * .005; targetPitch = THREE.MathUtils.clamp(targetPitch - dy * .004, -1.05, .95);
        canvas._lastX = e.clientX; canvas._lastY = e.clientY;
      }
    });
    const endLook = e => { if (e.pointerType === 'touch' || !isLocked) looking = false; canvas._lookId = undefined; };
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);

    window.addEventListener('keydown', e => {
      if (e.repeat && (e.code === 'KeyE' || e.code === 'Space')) return;
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyE' || e.code === 'Space') { if (isTalking) $('#dialog-next').click(); else interact(); }
      if (e.code === 'Escape' && isTalking) closeDialogue();
      else if (e.code === 'Escape' && isLocked) document.exitPointerLock();
    }, { passive: false });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    // Touch joystick moves; a separate swipe anywhere on the scene turns the camera.
    const stick = $('#joystick'), knob = stick.querySelector('i'), joy = { x: 0, y: 0 };
    let joyPointer = null;
    function moveStick(e) {
      const r = stick.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
      const len = Math.hypot(dx, dy) || 1, scale = Math.min(1, 40 / len);
      joy.x = dx * scale / 40; joy.y = dy * scale / 40;
      knob.style.transform = 'translate(' + dx * scale + 'px,' + dy * scale + 'px)';
    }
    stick.addEventListener('pointerdown', e => { e.preventDefault(); joyPointer = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
    stick.addEventListener('pointermove', e => { if (joyPointer === e.pointerId) moveStick(e); });
    function releaseStick() { joyPointer = null; joy.x = 0; joy.y = 0; knob.style.transform = ''; }
    stick.addEventListener('pointerup', releaseStick); stick.addEventListener('pointercancel', releaseStick);

    // Circle-vs-box collision with axis-separated motion slides naturally along walls.
    const WORLD_LIMIT = 27.4;
    function blocked(x, z, ignorePerson) {
      if (x < -WORLD_LIMIT || x > WORLD_LIMIT || z < -WORLD_LIMIT || z > WORLD_LIMIT) return true;
      for (const s of solids) {
        if (s.type === 'box') {
          const cx = Math.max(s.minX, Math.min(x, s.maxX)), cz = Math.max(s.minZ, Math.min(z, s.maxZ));
          const dx = x - cx, dz = z - cz;
          if (dx * dx + dz * dz < player.radius * player.radius) return true;
        } else if (Math.hypot(x - s.x, z - s.z) < player.radius + s.r) return true;
      }
      // The water basin is a continuous no-walk surface; its stone rim remains reachable.
      if (Math.hypot(x, z) < 8.18 + player.radius) return true;
      for (const p of people) {
        if (p === ignorePerson) continue;
        if (Math.hypot(x - p.mesh.position.x, z - p.mesh.position.z) < player.radius + .36) return true;
      }
      return false;
    }
    function movePlayer(dx, dz) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
      const sx = dx / steps, sz = dz / steps;
      for (let i = 0; i < steps; i++) {
        if (!blocked(player.x + sx, player.z)) player.x += sx;
        if (!blocked(player.x, player.z + sz)) player.z += sz;
      }
    }

    function resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.15 : 1.4));
    }
    window.addEventListener('resize', resize);
    camera.position.set(player.x, player.eye, player.z);
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.035, (now - last) / 1000 || 0); last = now;
      for (const f of fish) {
        f.mesh.position.x = f.x + Math.cos(now * .00038 + f.phase) * .9;
        f.mesh.position.z = f.z + Math.sin(now * .00032 + f.phase) * .7;
        f.mesh.rotation.y = Math.sin(now * .00025 + f.phase) * .35;
      }
      ripples.forEach((r, i) => { const s = .8 + (Math.sin(now * .001 + i) + 1) * .12; r.scale.set(s, s, s); });
      for (const token of sparkles) { token.mesh.rotation.y = now * .00065; token.mesh.position.y = Math.sin(now * .002 + token.id) * .12; }
      for (const p of people) animatePerson(p, dt);
      if (active && !isTalking) {
        let forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joy.y;
        let side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
        const mag = Math.hypot(forward, side); if (mag > 1) { forward /= mag; side /= mag; }
        const speed = 4.2;
        const dirX = -Math.sin(player.yaw), dirZ = -Math.cos(player.yaw);
        const rightX = Math.cos(player.yaw), rightZ = -Math.sin(player.yaw);
        const desiredX = (dirX * forward + rightX * side) * speed;
        const desiredZ = (dirZ * forward + rightZ * side) * speed;
        const blend = 1 - Math.exp(-11 * dt);
        player.vx += (desiredX - player.vx) * blend; player.vz += (desiredZ - player.vz) * blend;
        if (mag < .01) { player.vx *= Math.exp(-12 * dt); player.vz *= Math.exp(-12 * dt); }
        movePlayer(player.vx * dt, player.vz * dt);
        const moving = Math.hypot(player.vx, player.vz) > .25;
        player.bob += dt * (moving ? 9 : 2);
        const yawDelta = Math.atan2(Math.sin(targetYaw - player.yaw), Math.cos(targetYaw - player.yaw));
        player.yaw += yawDelta * (1 - Math.exp(-16 * dt));
        player.pitch += (targetPitch - player.pitch) * (1 - Math.exp(-14 * dt));
        camera.position.set(player.x, player.eye + (moving ? Math.sin(player.bob) * .045 : 0), player.z);
        camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
        nearby = nearestPerson();
        const token = nearby ? null : nearestToken();
        const canTalk = !!nearby, canCollect = !!token;
        $('#interaction-hint').classList.toggle('hidden', !canTalk && !canCollect);
        $('#touch-action').classList.toggle('ready', canTalk || canCollect);
        if (canTalk) $('#interaction-hint').textContent = 'E — ' + nearby.label + ' ile konuş';
        else if (canCollect) $('#interaction-hint').textContent = 'E — parıltılı hatırayı al';
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    function animatePerson(p, dt) {
      p.idle += dt;
      if (p.route) {
        const target = p.route[p.routeIndex], dx = target[0] - p.mesh.position.x, dz = target[1] - p.mesh.position.z, d = Math.hypot(dx, dz);
        if (d < .22) p.routeIndex = (p.routeIndex + 1) % p.route.length;
        else {
          p.moving = true; const step = Math.min(d, dt * .6);
          const nx = p.mesh.position.x + dx / d * step, nz = p.mesh.position.z + dz / d * step;
          if (!blocked(nx, nz, p)) { p.mesh.position.x = nx; p.mesh.position.z = nz; p.x = nx; p.z = nz; p.mesh.rotation.y = Math.atan2(dx, dz); }
          p.walk += dt * 7;
        }
      }
      p.legs[0].rotation.x = p.moving ? Math.sin(p.walk) * .38 : 0;
      p.legs[1].rotation.x = p.moving ? -Math.sin(p.walk) * .38 : 0;
      p.arms[0].rotation.x = p.moving ? -Math.sin(p.walk) * .25 : Math.sin(p.idle * 1.5) * .035;
      p.arms[1].rotation.x = p.moving ? Math.sin(p.walk) * .25 : -Math.sin(p.idle * 1.5) * .035;
      p.moving = false;
    }
  }

  function makeTexture(kind) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d'); let seed = kind === 'stone' ? 41 : 83;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    if (kind === 'stone') {
      x.fillStyle = '#cbb28a'; x.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 14; row++) {
        const h = 36, shift = row % 2 ? -26 : 0;
        for (let xx = shift; xx < 550; xx += 88 + Math.floor(rand() * 22)) {
          const w = 75 + Math.floor(rand() * 27), yy = row * h;
          const colors = ['#dfcaa4', '#d3bc92', '#e4d1ad', '#c8ad81', '#d8c29b'];
          x.fillStyle = colors[Math.floor(rand() * colors.length)]; x.fillRect(xx + 2, yy + 2, w - 4, h - 4);
          x.strokeStyle = '#aa916d'; x.lineWidth = 2; x.strokeRect(xx + 2, yy + 2, w - 4, h - 4);
          x.fillStyle = '#f0dfbf'; x.fillRect(xx + 5, yy + 4, w - 10, 2);
          for (let s = 0; s < 10; s++) { x.fillStyle = rand() > .5 ? '#b99d75' : '#f0ddb9'; x.globalAlpha = .25; x.fillRect(xx + rand() * w, yy + rand() * h, 1 + rand() * 2, 1 + rand() * 2); }
          x.globalAlpha = 1;
        }
      }
    } else {
      x.fillStyle = '#dfcda9'; x.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 64) for (let xx = 0; xx < 512; xx += 64) {
        const off = ((y / 64) % 2) ? 32 : 0;
        x.fillStyle = rand() > .5 ? '#e5d5b5' : '#d8c49e'; x.fillRect(xx + off + 2, y + 2, 60, 60);
        x.strokeStyle = '#c1ad89'; x.lineWidth = 2; x.strokeRect(xx + off + 2, y + 2, 60, 60);
      }
      for (let i = 0; i < 500; i++) { x.fillStyle = rand() > .5 ? '#f2e5c8' : '#bba681'; x.globalAlpha = .25; x.fillRect(rand() * 512, rand() * 512, 1.5, 1.5); }
      x.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding; return tex;
  }

  function loadProgress() {
    try { const s = JSON.parse(localStorage.getItem('urfa-balikligol-story') || '{}'); return { guide: !!s.guide, tokens: Array.isArray(s.tokens) ? s.tokens.filter(n => n >= 0 && n < 3) : [] }; }
    catch (_) { return { guide: false, tokens: [] }; }
  }
})();

