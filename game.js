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
    scene.background = new THREE.Color(0xb8c9d0);
    scene.fog = new THREE.Fog(0xc9c1b5, 38, 105);
    const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 120);
    camera.rotation.order = 'YXZ';
    const mobile = matchMedia('(max-width: 720px)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.15 : 1.4));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    $('#game').appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    scene.add(new THREE.HemisphereLight(0xe2eaf7, 0xa79b80, 1.02));
    const sun = new THREE.DirectionalLight(0xffd5a8, 1.12);
    sun.position.set(-21, 22, 15); sun.castShadow = !mobile;
    sun.shadow.mapSize.set(768, 768); sun.shadow.radius = 5;
    sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -.0005; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7d8ef, .28);
    fill.position.set(10, 8, -12); scene.add(fill);

    const stoneTexture = makeTexture('stone');
    const pavingTexture = makeTexture('paving');
    const soilTexture = makeTexture('soil');
    const woodTexture = makeTexture('wood');
    const waterTexture = makeTexture('water');
    const grassTexture = makeTexture('grass');
    pavingTexture.repeat.set(14, 14);
    soilTexture.repeat.set(1.2, 1.2);
    woodTexture.repeat.set(1.6, 1.2);
    waterTexture.repeat.set(2, 2);
    const stoneMats = [0xf4e6d0, 0xe9dac2, 0xf0e4d3, 0xe1d1bd].map(color =>
      new THREE.MeshStandardMaterial({ map: stoneTexture, bumpMap: mobile ? null : stoneTexture, bumpScale: .028, color: color, roughness: .95 }));
    const floorMat = new THREE.MeshStandardMaterial({ map: pavingTexture, bumpMap: mobile ? null : pavingTexture, bumpScale: .025, color: 0xffffff, roughness: .94 });
    const soilMat = new THREE.MeshStandardMaterial({ map: soilTexture, color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, bumpMap: woodTexture, bumpScale: .035, color: 0xe4c187, roughness: .82 });
    const fabricMats = new Map();
    const fabricMat = color => {
      if (!fabricMats.has(color)) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const ctx = c.getContext('2d'), hex = '#' + Number(color).toString(16).padStart(6, '0');
        ctx.fillStyle = hex; ctx.fillRect(0, 0, 256, 256);
        for (let x = 0; x < 256; x += 48) {
          ctx.fillStyle = x % 96 === 0 ? '#fff4d9' : '#744d3c'; ctx.globalAlpha = .24; ctx.fillRect(x, 0, 24, 256);
        }
        ctx.globalAlpha = .12; ctx.strokeStyle = '#fff8e8'; ctx.lineWidth = 1;
        for (let y = 2; y < 256; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
        fabricMats.set(color, new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: .02, color: 0xffffff, roughness: .93, side: THREE.DoubleSide }));
      }
      return fabricMats.get(color);
    };
    const waterMat = new THREE.MeshPhongMaterial({ map: waterTexture, color: 0xe8f4ef, specular: 0x9fc1bd, shininess: 64, transparent: true, opacity: .98, side: THREE.DoubleSide });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb97843, metalness: .48, roughness: .36, flatShading: true });
    const mats = {};
    const mat = (color, rough) => {
      const k = color + ':' + (rough || .9);
      if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color: color, roughness: rough || .9, flatShading: true });
      return mats[k];
    };
    const maps = [
      {
        name: 'Göl Bahçesi', description: 'Kıyıda saklanan kuş figürünü, bakır ibriği ve çiniyi bul.',
        guide: 'Rehber Zeynep’i bul', objective: '3 el yapımı hatırayı bul',
        items: ['Kuş figürü', 'Bakır ibrik', 'Renkli çini'],
        spots: [[-8.9, 7], [8.7, 7.5], [0, -12.5]], spawn: [-13, 17, -.12], limit: 27.4
      },
      {
        name: 'Usta Avlusu', description: 'Taş avludaki atölyeleri dolaş ve üç çalışma aletini bul.',
        guide: 'Usta Derya’yı bul', objective: '3 atölye aletini bul',
        items: ['Ahşap tokmak', 'Desen kalıbı', 'Boyama fırçası'],
        spots: [[-10, 4], [10, -8], [0, -12]], spawn: [0, 14.5, 0], limit: 17.5
      }
    ].map(map => ({ ...map, world: new THREE.Group(), solids: [], people: [], sparkles: [], grassZones: [], soilZones: [] }));
    for (const map of maps) scene.add(map.world);
    let mapIndex, map, world, solids, people, sparkles, grassZones, soilZones;
    function useMap(index) {
      mapIndex = index;
      map = maps[index];
      ({ world, solids, people, sparkles, grassZones, soilZones } = map);
      maps.forEach((entry, i) => { entry.world.visible = i === index; });
    }
    useMap(0);
    const fish = [], ripples = [], fishRipples = [], gulls = [];
    const player = { x: -13, z: 17, eye: 1.67, radius: .34, yaw: -.12, pitch: -.01, vx: 0, vz: 0, bob: 0 };
    let active = false, isLocked = false, isTalking = false, looking = false;
    let targetYaw = player.yaw, targetPitch = player.pitch, nearby = null;
    const saved = loadProgress(maps);
    let progress = saved.levels[0], toastTimer = 0, audio = null, muted = false, masterGain = null, ambientGain = null, stepBuffer = null, footstepClock = 0, birdTimer = 0, marketUpdateTimer = 0;
    const marketVoices = [];
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
      const key = 'masonry:' + [w, h, d].join(':');
      if (!geoCache.box.has(key)) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const uv = geometry.attributes.uv;
        // Keep the courses at the same scale on short piers and long walls.
        for (let i = 0; i < uv.count; i++) {
          const face = Math.floor(i / 4);
          const width = face < 2 ? d : w;
          const height = face === 2 || face === 3 ? d : h;
          uv.setXY(i, uv.getX(i) * width / 2.65, uv.getY(i) * height / 2.4);
        }
        geoCache.box.set(key, geometry);
      }
      const m = new THREE.Mesh(geoCache.box.get(key), material);
      m.position.set(x, y, z);
      add(m);
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
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const meadowMat = new THREE.MeshLambertMaterial({ map: grassTexture, transparent: true, alphaTest: .05, depthWrite: false });
    function grassPatch(cx, cz, radius) {
      const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), meadowMat);
      disk.rotation.x = -Math.PI / 2; disk.position.set(cx, -.015, cz);
      disk.receiveShadow = true; add(disk, world, false);
      const verts = [], colors = [];
      for (let i = 0; i < (mobile ? 64 : 110); i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (radius - .16);
        const bx = Math.cos(a) * r, bz = Math.sin(a) * r, width = .035 + Math.random() * .045, height = .12 + Math.random() * .28;
        verts.push(bx - width, .015, bz, bx + width, .015, bz, bx + Math.cos(a + 1.1) * width, height, bz + Math.sin(a + 1.1) * width);
        const col = new THREE.Color([0x68864b, 0x8ba25e, 0xa0a963, 0x5f8559][i % 4]);
        for (let k = 0; k < 3; k++) colors.push(col.r, col.g, col.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const blades = new THREE.Mesh(geo, grassMat); blades.position.set(cx, 0, cz); add(blades, world, false);
      grassZones.push({ x: cx, z: cz, r: radius });
    }
    function soilPatch(cx, cz, radius) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), soilMat);
      patch.rotation.x = -Math.PI / 2; patch.position.set(cx, -.012, cz); add(patch, world, false);
      soilZones.push({ x: cx, z: cz, r: radius });
    }
    [[-16, -14, 3], [18, -12, 3.2], [-18, 13, 2.8], [17, 6, 2.4], [-7, 18, 2.7], [5, 18, 2.6], [-13.8, -8.8, 2.5]].forEach(p => grassPatch(p[0], p[1], p[2]));
    [[-20, -5, 1.7], [20, -19, 1.8], [-20, 20, 1.6], [20, 11, 1.5]].forEach(p => soilPatch(p[0], p[1], p[2]));
    // Boundary stone wall: it is visible and its collision matches the stone blocks.
    for (let x = -25; x <= 25; x += 5) {
      stoneWall(x, .9, -28, 4.85, 1.8, .42, 1, true);
      stoneWall(x, .9, 28, 4.85, 1.8, .42, 2, true);
      box(4.9, .24, .62, 0xb69b72, x, 1.83, -28);
      box(4.9, .24, .62, 0xb69b72, x, 1.83, 28);
    }
    stoneWall(-28, .9, 0, .42, 1.8, 56, 2, true);
    stoneWall(28, .9, 0, .42, 1.8, 56, 1, true);

    // Small groves frame the view across the pool and leave the walkways open.
    const grove = [
      [-18.6, 13.6, 1.04], [-20, 11.4, .78], [-7.9, 18.8, .94],
      [4.6, 18.3, .9], [5.8, 20.5, .75], [16.8, 6.6, .79],
      [18.6, -12.7, .96], [20.5, -13.5, .8], [-16.7, -14.9, .98],
      [-14.2, -9.3, .84], [-10.9, -21.9, 1.1], [-8.5, -24.5, .88],
      [17.3, -24.5, 1.05], [24.7, -7.9, .92], [-24.8, -5.9, .97]
    ];
    const canopyColors = [0x557d59, 0x688853, 0x7d9b61, 0x93a467, 0x54795f];
    const trunks = [], crowns = [], flowers = [];
    for (const [i, [x, z, scale]] of grove.entries()) {
      trunks.push([x, 1.18 * scale, z, .22 * scale, 2.6 * scale, .22 * scale, 0, 0x897056]);
      obstacleCircle(x, z, .25 * scale);
      crowns.push([x, 3.6 * scale, z, 1.42 * scale, 1.55 * scale, 1.37 * scale, i, canopyColors[i % 5]]);
      for (let branch = 0; branch < 4; branch++) {
        const angle = branch * Math.PI / 2 + i * .71;
        const offset = branch % 2 ? 1.01 : .77;
        const bx = x + Math.cos(angle) * offset * scale;
        const bz = z + Math.sin(angle) * offset * scale;
        crowns.push([bx, (2.87 + branch * .18) * scale, bz, 1.1 * scale, 1.02 * scale, 1.07 * scale, angle, canopyColors[(i + branch + 1) % 5]]);
      }
      if (i < 10) {
        const dx = x + .92 * Math.cos(i), dz = z + .92 * Math.sin(i);
        crowns.push([dx, .2, dz, .52, .29, .39, i, 0x718958]);
        for (let bud = 0; bud < 6; bud++) {
          const a = bud * 2.4 + i;
          flowers.push([dx + Math.cos(a) * .27, .37 + .07 * Math.sin(bud), dz + Math.sin(a) * .25,
            .085, .065, .085, a, [0xd69b73, 0xe2c472, 0xe2b3a4][i % 3]]);
        }
      }
    }
    function addGardenInstances(geometry, entries, castShadow) {
      const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const batch = new THREE.InstancedMesh(geometry, material, entries.length);
      const pose = new THREE.Object3D();
      for (const [i, [x, y, z, sx, sy, sz, turn, color]] of entries.entries()) {
        pose.position.set(x, y, z); pose.scale.set(sx, sy, sz); pose.rotation.y = turn;
        pose.updateMatrix();
        batch.setMatrixAt(i, pose.matrix); batch.setColorAt(i, new THREE.Color(color));
      }
      batch.instanceMatrix.needsUpdate = true;
      batch.instanceColor.needsUpdate = true;
      batch.frustumCulled = false;
      batch.castShadow = castShadow && !mobile;
      batch.receiveShadow = true;
      world.add(batch);
    }
    addGardenInstances(new THREE.CylinderGeometry(.7, 1, 1, 7), trunks, true);
    addGardenInstances(new THREE.IcosahedronGeometry(1, mobile ? 0 : 1), crowns, true);
    addGardenInstances(new THREE.IcosahedronGeometry(1, 0), flowers, false);

    // The garden pool is framed by a stone coping and an inlaid path.
    cylinder(8.5, 8.5, .42, 0xc5aa81, 0, .1, 0, world, 64);
    const water = new THREE.Mesh(new THREE.CircleGeometry(8.08, 64), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.y = .33; world.add(water);
    const edge = new THREE.Mesh(new THREE.RingGeometry(8.1, 8.52, 64), mat(0xe0cba5));
    edge.rotation.x = -Math.PI / 2; edge.position.y = .38; add(edge);
    const walk = new THREE.Mesh(new THREE.RingGeometry(8.55, 13.8, 96), floorMat);
    const walkUV = walk.geometry.attributes.uv;
    for (let i = 0; i < walkUV.count; i++) {
      walkUV.setXY(i, walkUV.getX(i) * 27.6 / 62, walkUV.getY(i) * 27.6 / 62);
    }
    walk.rotation.x = -Math.PI / 2; walk.position.y = .045; walk.receiveShadow = true; add(walk, world, false);
    const border = new THREE.Mesh(new THREE.RingGeometry(13.35, 13.52, 96), mat(0xaaa184));
    border.rotation.x = -Math.PI / 2; border.position.y = .048; border.receiveShadow = true; add(border, world, false);
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI * 2 / 64, r = 8.52;
      const stone = box(.82, .22, .56, i % 3 ? 0xd4bd94 : 0xe3d0aa, Math.cos(a) * r, .42, Math.sin(a) * r);
      stone.rotation.y = Math.PI / 2 - a;
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
      const fishIndex = fish.length;
      fish.push({ mesh: f, x: x, z: z, phase: phase });
      for (let ringNo = 0; ringNo < 2; ringNo++) {
        const rippleMat = new THREE.MeshBasicMaterial({ color: 0xd4fff2, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide });
        const ripple = new THREE.Mesh(new THREE.TorusGeometry(.28 + ringNo * .2, .018, 5, 22), rippleMat);
        ripple.rotation.x = -Math.PI / 2; ripple.position.y = .39 + ringNo * .002; add(ripple, world, false);
        fishRipples.push({ mesh: ripple, fish: fishIndex, phase: ringNo * 1.7 });
      }
    }
    makeFish(-2, -2, 0xec9d67, .1); makeFish(3, 1, 0xe7c56e, 2.2); makeFish(1, 4, 0xef8c69, 4.1);
    makeFish(-4, 2, 0xf2c878, 5.4); makeFish(4, -3, 0xf0a16d, 1.4); makeFish(-1, 5, 0xe7bd75, 3.3);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10 + .2, r = 6.2 + (i % 2) * .45, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(.35, 9), mat(i % 2 ? 0x699879 : 0x82a87c));
      pad.rotation.x = -Math.PI / 2; pad.position.set(x, .365, z); add(pad, world, false);
      if (i % 3 === 0) sphere(.13, 0xf1b9a6, x + .1, .43, z, world, 7);
    }
    function makeGull(x, z, phase) {
      const root = group(x, 8 + phase % 1.3, z), body = sphere(.24, 0xf5f1e7, 0, 0, 0, root, 8);
      body.scale.set(1.45, .65, .72);
      sphere(.12, 0xf8f4ea, .24, .05, 0, root, 7);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.075, .22, 5), mat(0xe3a04b));
      beak.rotation.z = -Math.PI / 2; beak.position.set(.42, .025, 0); add(beak, root, false);
      const wings = [];
      for (const side of [-1, 1]) {
        const hinge = group(side * .04, .025, 0, root);
        const wing = box(.78, .045, .22, 0xf6f2e9, side * .37, 0, 0, hinge);
        wing.rotation.y = side * .08; wings.push({ hinge: hinge, side: side });
      }
      gulls.push({ mesh: root, wings: wings, x: x, z: z, phase: phase });
    }
    makeGull(-2, -1, .2); makeGull(1, 2, 1.9); makeGull(2, -3, 3.4);

    // Small seating nooks and flower pots around the water.
    function bench(x, z, angle) {
      const g = group(x, 0, z), seat = box(1.65, .14, .45, 0x96704c, 0, .62, 0, g, woodMat);
      seat.rotation.y = angle; const back = box(1.65, .54, .12, 0xa57d55, 0, .97, -.16, g, woodMat); back.rotation.y = angle;
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
      box(.28, 2.05, .1, 0x795a40, cx - 1.02, 1.02, portalZ + face * .04, world, woodMat);
      box(.28, 2.05, .1, 0x916844, cx + 1.02, 1.02, portalZ + face * .04, world, woodMat);
      for (let tile = -4; tile <= 4; tile++) {
        box(.28, .14, .13, tile % 2 ? 0x4b8883 : 0xe2a45b, cx + tile * .34, 3.68, portalZ + face * .06);
      }
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
      box(.62, 2.2, .12, 0x795940, cx - .43, 1.1, front + face * .32, world, woodMat).rotation.y = face > 0 ? -.58 : .58;
      box(1.9, .13, .15, 0xe3d0ab, cx, 2.43, front + face * .32);
      for (const dx of [-w * .28, w * .28]) {
        box(.78, .82, .11, 0x789188, cx + dx, 2.25, front + face * .32);
        box(.96, .12, .16, 0xc5a77b, cx + dx, 2.73, front + face * .35);
      }
      box(2.5, .12, 1.8, 0x9d7751, cx, 4.83, cz - face * (d / 2 - .6), world, woodMat);
      for (const dx of [-1, 1]) cylinder(.055, .055, 1.1, 0x8c704e, cx + dx, 4.4, cz - face * (d / 2 - .6), world, 7);
    }
    courtyardHouse(-22, -20.5, 8, 7, 0, 1); courtyardHouse(22, -20.5, 8, 7, 2, 1);
    courtyardHouse(-22, 20.5, 8, 7, 1, -1); courtyardHouse(22, 20.5, 8, 7, 3, -1);

    // Bazaar: copperware, spice jars, handwoven textiles and striped awnings.
    function stall(x, z, canopy, type) {
      const g = group(x, 0, z);
      box(3.35, 1.5, 2.15, 0xb28d65, 0, .75, 0, g, woodMat);
      box(3.65, .15, 2.65, canopy, 0, 2.2, 0, g, fabricMat(canopy));
      for (let i = -2; i <= 2; i++) box(.12, .08, 2.7, i % 2 ? 0xf0d9aa : canopy, i * .72, 2.29, 0, g);
      for (const dx of [-1.48, 1.48]) cylinder(.075, .09, 2.12, 0x806044, dx, 1.08, 0, g, 7);
      box(3, .6, .24, 0xd2b181, 0, 1.36, 1.12, g);
      obstacleBox(x, z, 3.5, 2.5);
      if (type === 'copper') for (let i = 0; i < 5; i++) {
        const px = -1.15 + i * .56, pot = sphere(.24, i % 2 ? 0xb97947 : 0xc18b51, px, 1.92, 1.08, g, 10, copperMat);
        pot.scale.set(.8, .94, .8); cylinder(.1, .17, .2, 0xc28c53, px, 2.12, 1.08, g, 8, copperMat);
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

    const npcBody = new THREE.LatheGeometry([
      [0, -.35], [.17, -.35], [.245, -.32], [.279, -.25], [.292, -.14],
      [.299, -.01], [.291, .13], [.27, .24], [.21, .31], [.105, .335], [0, .335]
    ].map(([radius, height]) => new THREE.Vector2(radius, height)), mobile ? 14 : 20);
    const npcPalettes = {
      Zeynep: { skin: '#d99e78', cloth: '#639a89', trim: '#f2d38f', headwear: 'scarf', accent: '#e5b863', outfit: 'jacket' },
      Hasan: { skin: '#bf825e', cloth: '#708fa3', trim: '#e9b887', headwear: 'cap', accent: '#536e7b', outfit: 'jacket' },
      Mina: { skin: '#e3ab85', cloth: '#a3ad75', trim: '#ffe2a4', headwear: 'hair', accent: '#5b4140', outfit: 'pockets', small: true },
      Elif: { skin: '#e5b593', cloth: '#a686ac', trim: '#f3d9a6', headwear: 'hair', accent: '#63483c', outfit: 'jacket' },
      Ali: { skin: '#be865f', cloth: '#bd8f55', trim: '#f2dfb5', headwear: 'cap', accent: '#768c6a', outfit: 'jacket' },
      İsmail: { skin: '#d29a73', cloth: '#a76350', trim: '#edc297', headwear: 'cap', accent: '#986a53', outfit: 'apron' },
      Derya: { skin: '#c8906a', cloth: '#658c9c', trim: '#ebc285', headwear: 'scarf', accent: '#b97765', outfit: 'apron' },
      Deniz: { skin: '#dba580', cloth: '#bd805a', trim: '#f5dbac', headwear: 'hair', accent: '#503e3a', outfit: 'pockets', small: true }
    };

    function makePerson(x, z, options) {
      const palette = npcPalettes[options.look];
      const root = group(x, 0, z);
      if (palette.small) root.scale.setScalar(.88);
      const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: .92 });
      const sleeve = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: .96 });
      const headwear = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: .94 });
      const upper = group(0, .6, 0, root);
      const outfit = new THREE.MeshStandardMaterial({ map: makeNpcOutfit(palette), roughness: .96 });
      const torso = new THREE.Mesh(npcBody, outfit);
      torso.position.y = .316; torso.scale.z = .76; torso.rotation.y = Math.PI;
      add(torso, upper);

      const head = group(0, .68, 0, upper);
      const faces = [makeNpcFace(palette, false), makeNpcFace(palette, true)];
      const faceMaterial = new THREE.MeshStandardMaterial({ map: faces[0], roughness: .94 });
      const headShape = sphere(.322, 0xffffff, 0, .206, 0, head, mobile ? 16 : 22, faceMaterial);
      headShape.scale.set(1, .97, .9);
      if (palette.headwear === 'scarf') {
        sphere(.331, 0xffffff, 0, .21, -.061, head, 15, headwear).scale.set(1.05, 1.025, .85);
        sphere(.245, 0xffffff, 0, -.005, .006, head, 12, headwear).scale.set(.93, .43, .85);
      } else if (palette.headwear === 'cap') {
        sphere(.29, 0xffffff, 0, .439, -.028, head, 15, headwear).scale.set(1.04, .45, .92);
        sphere(.275, 0xffffff, 0, .402, .088, head, 14, headwear).scale.set(1.08, .115, .92);
      } else {
        sphere(.317, 0xffffff, 0, .248, -.091, head, 15, headwear).scale.set(1.02, .96, .78);
        sphere(.196, 0xffffff, -.115, .42, .086, head, 12, headwear).scale.set(1.16, .43, .82);
        sphere(.134, 0xffffff, .145, .422, .075, head, 12, headwear).scale.set(1, .52, .87);
      }
      const arms = [], legs = [];
      for (const side of [-1, 1]) {
        if (palette.headwear !== 'scarf') {
          sphere(.068, 0xffffff, side * .302, .178, 0, head, 9, skin).scale.set(.64, 1, .8);
        }
        const arm = group(side * .27, .53, 0, upper);
        sphere(.117, 0xffffff, 0, -.154, 0, arm, 10, sleeve).scale.set(.92, 2.03, .95);
        sphere(.083, 0xffffff, 0, -.363, .016, arm, 10, skin).scale.set(1, 1.1, .88);
        arms.push(arm);
        const leg = group(side * .135, .566, 0, root);
        sphere(.123, 0x5f6f7a, 0, -.197, 0, leg, 10).scale.set(.87, 2.2, .88);
        sphere(.13, 0x574e4a, 0, -.46, .072, leg, 11).scale.set(.94, .74, 1.46);
        legs.push(leg);
      }
      root.rotation.y = options.facing ?? .15;
      const npc = {
        mesh: root, upper, head, arms, legs, faces, faceMaterial, palette, facing: root.rotation.y,
        route: options.route || null, routeIndex: 0, walk: 0, gait: 0,
        pause: 0, blockedTime: 0, idle: Math.random() * 6,
        data: options.data, label: options.label
      };
      people.push(npc); return npc;
    }
    makePerson(-10.5, 10.2, { look: 'Zeynep', label: 'Rehber Zeynep', data: 'guide', facing: -.4 });
    makePerson(14.4, -7.3, { look: 'Hasan', route: [[14.4, -7.3], [16, -8.2], [17.5, -6.8], [15.9, -5.8]], label: 'Gezgin Hasan', data: 'neighbor' });
    makePerson(2.4, -11.2, { look: 'Mina', label: 'Öğrenci Mina', data: 'student' });
    makePerson(-4.5, 10.7, { look: 'Elif', route: [[-4.5, 10.7], [-2.4, 11.7], [-3.4, 13], [-5.2, 12.3]], label: 'Gezgin Elif', data: 'neighbor' });
    makePerson(5.4, 11.7, { look: 'Ali', route: [[5.4, 11.7], [7.3, 10.3], [6.5, 9.8], [4.7, 9.6]], label: 'Gezgin Ali', data: 'neighbor' });
    // A friendly vendor stays behind the copper stall counter; the collision is the stall itself.
    makePerson(18, -1.25, { look: 'İsmail', label: 'Bakır ustası İsmail', data: 'artisan' });

    // Three glowing tokens sit on the actual walkable promenade.
    const dustTexture = makeDustTexture();
    const dustMaterial = new THREE.PointsMaterial({ color: 0xffd65e, size: .22, map: dustTexture, transparent: true, opacity: .92, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const dustGeometry = makeDustGeometry(24);
    function questModel(id, parent) {
      const g = group(0, .94, 0, parent);
      if (id === 0) {
        // A tiny hand-painted bird figurine.
        const body = sphere(.28, 0x42a59a, 0, 0, 0, g, 7); body.scale.set(1.1, .78, .72);
        const head = sphere(.17, 0x56b8a7, .2, .16, 0, g, 7);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(.08, .2, 5), mat(0xe6a84f)); beak.rotation.z = -Math.PI / 2; beak.position.set(.4, .17, 0); add(beak, g, false);
        const wing = sphere(.14, 0xf0c968, -.04, .04, .19, g, 6); wing.scale.set(.88, .55, .32);
        sphere(.035, 0x473c32, .25, .19, .145, g, 6);
      } else if (id === 1) {
        // A low-poly copper water jug with a real handle and spout.
        cylinder(.27, .34, .42, 0xb97843, 0, 0, 0, g, 9, copperMat);
        cylinder(.14, .19, .12, 0xc58d52, 0, .25, 0, g, 9, copperMat);
        cylinder(.09, .09, .17, 0xb97843, 0, .38, 0, g, 8, copperMat);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(.19, .045, 6, 12, Math.PI * 1.55), copperMat);
        handle.position.set(-.24, .08, 0); handle.rotation.z = Math.PI / 2; add(handle, g, false);
        const spout = cylinder(.07, .11, .19, 0xc58d52, .24, .11, 0, g, 7, copperMat); spout.rotation.z = -Math.PI / 3;
      } else {
        // A colorful raised ceramic tile, decorated with a 3D star.
        const tile = box(.55, .12, .55, 0x318f9a, 0, 0, 0, g); tile.rotation.y = Math.PI / 4;
        const inset = box(.4, .025, .4, 0xf0d69b, 0, .075, 0, g); inset.rotation.y = Math.PI / 4;
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(.23, 0), mat(0xd96f54)); star.position.y = .21; add(star, g, false);
        for (let i = 0; i < 4; i++) { const dot = sphere(.045, 0x4d9c76, Math.cos(i * Math.PI / 2) * .21, .11, Math.sin(i * Math.PI / 2) * .21, g, 6); }
      }
      return g;
    }
    function workshopTool(id, parent) {
      const tool = group(0, .98, 0, parent);
      if (id === 0) {
        cylinder(.055, .07, .58, 0xffffff, 0, -.03, 0, tool, 8, woodMat);
        const head = cylinder(.145, .145, .42, 0xffffff, 0, .25, 0, tool, 8, woodMat);
        head.rotation.z = Math.PI / 2;
      } else if (id === 1) {
        box(.54, .15, .42, 0xffffff, 0, 0, 0, tool, woodMat);
        const stamp = box(.24, .08, .24, 0x5e887d, 0, .1, 0, tool);
        stamp.rotation.y = Math.PI / 4;
        box(.34, .045, .065, 0xdeb478, 0, .157, 0, tool);
        box(.065, .045, .3, 0xdeb478, 0, .158, 0, tool);
      } else {
        cylinder(.045, .032, .54, 0x639587, 0, -.1, 0, tool, 8);
        cylinder(.093, .045, .13, 0xffffff, 0, .22, 0, tool, 8, copperMat);
        const bristles = sphere(.12, 0x9b5538, 0, .35, 0, tool, 8);
        bristles.scale.set(.64, 1.28, .58);
      }
      tool.rotation.z = -.35;
    }
    const tokenRing = new THREE.TorusGeometry(.5, .04, 6, 18);
    function placeTokens() {
      map.spots.forEach(([x, z], id) => {
        if (progress.tokens.includes(id)) return;
        const marker = group(x, 0, z);
        if (mapIndex === 0) questModel(id, marker);
        else workshopTool(id, marker);
        const ring = new THREE.Mesh(tokenRing, mat(0xffdf91));
        ring.position.y = .94; add(ring, marker, false);
        const dust = new THREE.Points(dustGeometry, dustMaterial);
        dust.position.y = .42; dust.userData.phase = id * 1.9; add(dust, marker, false);
        sparkles.push({ id, x, z, mesh: marker, dust });
      });
    }
    placeTokens();

    function buildWorkshopMap() {
      const courtyard = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), floorMat);
      courtyard.rotation.x = -Math.PI / 2;
      courtyard.position.y = -.07; courtyard.receiveShadow = true;
      world.add(courtyard);
      for (const side of [-1, 1]) {
        stoneWall(0, 1.05, side * 17.8, 36, 2.1, .5, 0, true);
        stoneWall(side * 17.8, 1.05, 0, .5, 2.1, 36, 2, true);
        courtyardHouse(side * 11.7, -12.5, 7, 5.8, side === -1 ? 1 : 2, 1);
        stall(side * 11.1, -1, side === -1 ? 0xbf7755 : 0x5b8d86, side === -1 ? 'copper' : 'textile');
        grassPatch(side * 13.5, 10, 2.4);
        bench(side * 9.2, 12.2, 0);
        flowerPot(side * 4.3, 6.6, [0x748e62, 0xc47b68, 0xddae71]);
        for (const z of [4.6, 13.6]) lantern(side * 6.6, z);
      }
      cylinder(2.15, 2.25, .55, 0xc0aa89, 0, .28, 0, world, 24, stoneMats[0]);
      const basin = new THREE.Mesh(new THREE.CircleGeometry(1.94, 28), waterMat);
      basin.rotation.x = -Math.PI / 2; basin.position.y = .565; add(basin, world, false);
      cylinder(.2, .33, .85, 0xcab696, 0, .87, 0, world, 10, stoneMats[1]);
      cylinder(.7, .48, .18, 0xcab696, 0, 1.34, 0, world, 14, stoneMats[0]);
      obstacleCircle(0, 0, 2.17);
      makePerson(.85, 9.3, { look: 'Derya', label: 'Usta Derya', data: 'workshop', facing: -.12 });
      makePerson(6, 7.8, { look: 'Deniz', label: 'Çırak Deniz', data: 'apprentice',
        route: [[6, 7.8], [8, 8.4], [7.8, 10.5], [5.5, 10.6]] });
      placeTokens();
    }

    // Dialogue lines distinguish documented facts from local oral tradition.
    const stories = {
      guide: {
        name: 'Rehber Zeynep', icon: '🧕🏻', mission: true,
        cues: ['Gölün adını keşfedelim', 'Kıyıdaki tarihi yapılar', 'Bir efsanenin izinde', 'Kaşif görevin hazır!'], pages: [
          'Hoş geldin minik kaşif! Burası Urfa’nın taş avlularından, serin su yollarından ve yemyeşil bahçelerinden ilham alan hayalî bir keşif köşesi.',
          'Etrafına bak: taş kemerler, kubbeli çatılar ve gölgeli yürüyüş yolları bize bu bölgenin mimari dilini hatırlatıyor. Her sokakta başka bir ayrıntı saklı!',
          'Buradaki dükkânlarda bakır, renkli seramikler ve kuş figürleri gibi el işi süsler bulabilirsin. Her birinin yapımında sabır ve ustalık var.',
          'Üç el yapımı hatıra kaybolmuş! Bahçede onları bulabilir misin? Biri kuş, biri bakır ibrik, biri de renkli bir çini. Keşfe hazır mısın?'
        ]
      },
      artisan: {
        name: 'Bakır ustası İsmail', icon: '🧔🏻', cues: ['Çekiç sesini duydun mu?', 'Ustanın küçük sırrı'], pages: [
          'Hoş geldin çırak! Şu bakır levhayı görüyor musun? Urfa çarşılarında bakır işçiliği kuşaklar boyunca ustadan çırağa aktarılmış.',
          'Deseni oluşturmak için levhaya sabırla küçük vuruşlar yaparım. Sence önce dalga mı çizelim, yoksa minik bir balık mı? Her eserin kendine özgü bir hikâyesi olur!'
        ]
      },
      student: {
        name: 'Öğrenci Mina', icon: '👧🏻', cues: ['Ben de merak ediyordum!', 'Minik gözlem görevi'], pages: [
          'Selam! Ben Mina. Göl kıyısında yüzen balıkları saymaya çalıştım ama onlar o kadar çevik ki saymayı şaşırdım!',
          'Halilürrahman ve Aynzeliha gölleriyle tarihî yapılar bu çevrede bir arada. Taş duvarlarda farklı renkler bulabilir misin? Bana en sevdiğini sonra anlat!'
        ]
      },
      neighbor: {
        name: 'Göl kıyısından bir dost', icon: '🙂', cues: ['Şehrin en güzel sesi', 'Kaşiflere küçük bir öneri'], pages: [
          'Sence gölün sesi nasıl? Ben biraz sessiz kalıp suyu dinlemeyi seviyorum. Kuşlar, su ve çarşıdan gelen sesler koca bir şehir hikâyesi anlatıyor.',
          'Balıklara uzaktan bakmak en güzeli. Sonra taş yolu takip et; belki ışıl ışıl bir hatıra taşı bulursun!'
        ]
      },
      workshop: {
        name: 'Usta Derya', icon: '🧑🏻', mission: true,
        cues: ['Atölyeye hoş geldin', 'Üç alet, üç iş'], pages: [
          'Avludaki ustalar bugün küçük bir sergi hazırlıyor. Tahta, bakır ve boyayla yaptığımız işleri bir araya getireceğiz.',
          'Hazırlığa yardım eder misin? Ahşap tokmağı, desen kalıbını ve boyama fırçasını ara. Her biri avlunun farklı bir köşesinde.'
        ]
      },
      apprentice: {
        name: 'Çırak Deniz', icon: '🙂', cues: ['Küçük bir ipucu'], pages: [
          'Ben renkleri hazırladım. En son kuzeydeki iki atölyenin arasından geçtim. Gözün oradaki parıltılara takılabilir!'
        ]
      }
    };
    let dialogNpc = null, dialogStory = null, dialogPage = 0, dialogReadTimer = 0, dialogSecondsLeft = 0, dialogGesture = 0;
    function openDialogue(npc) {
      const story = stories[npc.data];
      if (!story) return;
      dialogNpc = npc; dialogStory = story; dialogPage = 0; isTalking = true;
      if (document.pointerLockElement) document.exitPointerLock();
      $('#speaker-name').textContent = npc.label;
      npc.portrait ??= makeNpcPortrait(npc.palette);
      $('#speaker-icon').replaceChildren(npc.portrait);
      $('#dialog-card').classList.toggle('mission-dialog', !!story.mission);
      showDialoguePage();
      $('#dialog').classList.remove('hidden');
    }
    function showDialoguePage() {
      clearInterval(dialogReadTimer);
      dialogGesture = 0;
      const p = dialogStory.pages[dialogPage];
      $('#dialog-text').textContent = p;
      $('#dialog-cue').textContent = dialogStory.cues && dialogStory.cues[dialogPage] || 'Birlikte keşfedelim!';
      $('#dialog-progress').textContent = 'Hikâye ' + (dialogPage + 1) + ' / ' + dialogStory.pages.length;
      $('#dialog-progress-bar').style.width = ((dialogPage + 1) / dialogStory.pages.length * 100) + '%';
      const next = $('#dialog-next');
      next.dataset.readyLabel = dialogPage + 1 < dialogStory.pages.length ? 'Devam <span>→</span>' : (dialogStory.mission && !progress.guide && !levelDone(mapIndex) ? 'Göreve başla <span>✦</span>' : 'Görüşürüz <span>→</span>');
      next.disabled = true; next.innerHTML = 'Oku (3) <span>⌛</span>';
      $('#dialog-tip').textContent = 'Bu hikâyeyi okumak için 3 saniyen var.';
      dialogSecondsLeft = 3;
      dialogReadTimer = window.setInterval(() => {
        dialogSecondsLeft--;
        if (dialogSecondsLeft <= 0) {
          clearInterval(dialogReadTimer); dialogReadTimer = 0;
          next.disabled = false; next.innerHTML = next.dataset.readyLabel;
          $('#dialog-tip').textContent = 'Hazırsan Devam’a dokun veya E tuşuna bas.';
        } else next.innerHTML = 'Oku (' + dialogSecondsLeft + ') <span>⌛</span>';
      }, 1000);
    }
    function closeDialogue(finished = false) {
      clearInterval(dialogReadTimer); dialogReadTimer = 0;
      const accepted = finished && dialogStory?.mission && !progress.guide;
      dialogNpc = null; dialogStory = null;
      $('#dialog').classList.add('hidden'); isTalking = false;
      if (accepted) {
        progress.guide = true; saveProgress();
        updateQuest();
        if (!levelDone(mapIndex)) toast('Yeni görev: ' + map.objective);
      }
    }
    $('#dialog-next').addEventListener('click', () => {
      if (!dialogStory || dialogSecondsLeft > 0) return;
      dialogSecondsLeft = 0;
      if (dialogPage + 1 < dialogStory.pages.length) { dialogPage++; showDialoguePage(); }
      else closeDialogue(true);
    });

    function startAudio() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || audio) return;
        audio = new AC();
        if (audio.state === 'suspended') audio.resume();
        masterGain = audio.createGain(); masterGain.gain.value = muted ? 0 : .72; masterGain.connect(audio.destination);
        const length = audio.sampleRate * 2, buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * .16;
        stepBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .09), audio.sampleRate);
        const stepData = stepBuffer.getChannelData(0);
        for (let i = 0; i < stepData.length; i++) stepData[i] = (Math.random() * 2 - 1) * (1 - i / stepData.length) * .55;
        const noise = audio.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520;
        ambientGain = audio.createGain(); ambientGain.gain.value = .045;
        noise.connect(filter); filter.connect(ambientGain); ambientGain.connect(masterGain); noise.start();
        // Each stall has its own panner; the low-level filtered murmur fades as the player walks away.
        for (const place of [[18, -3.5], [21, 1], [-19, 6.5]]) {
          const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
          const voiceFilter = audio.createBiquadFilter(); voiceFilter.type = 'bandpass'; voiceFilter.frequency.value = 760; voiceFilter.Q.value = .65;
          const voiceGain = audio.createGain(); voiceGain.gain.value = .042;
          const panner = audio.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 4; panner.maxDistance = 30; panner.rolloffFactor = .9;
          setNodePosition(panner, place[0], 1.2, place[1]);
          source.connect(voiceFilter); voiceFilter.connect(voiceGain); voiceGain.connect(panner); panner.connect(masterGain); source.start();
          marketVoices.push({ panner: panner, gain: voiceGain, x: place[0], z: place[1] });
        }
        birdTimer = window.setInterval(() => { if (!active || !audio || muted) return; birdCall(); }, 7200);
        birdCall();
      } catch (e) { console.warn('Ortam sesi açılamadı', e); }
    }
    function setNodePosition(node, x, y, z) {
      if (node.positionX) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; }
      else if (node.setPosition) node.setPosition(x, y, z);
    }
    function updateListener() {
      if (!audio || !audio.listener) return;
      const l = audio.listener, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      if (l.positionX) {
        l.positionX.value = player.x; l.positionY.value = player.eye; l.positionZ.value = player.z;
        l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz;
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
      } else {
        l.setPosition(player.x, player.eye, player.z); l.setOrientation(fx, 0, fz, 0, 1, 0);
      }
    }
    function playFootstep(type) {
      if (!audio || muted || !masterGain || !stepBuffer) return;
      try {
        const now = audio.currentTime, source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
        source.buffer = stepBuffer;
        const settings = type === 'stone' ? { freq: 1050, end: 520, q: 1.1, vol: .12 } : type === 'grass' ? { freq: 430, end: 210, q: .55, vol: .07 } : { freq: 300, end: 125, q: .72, vol: .1 };
        filter.type = 'bandpass'; filter.frequency.setValueAtTime(settings.freq, now); filter.frequency.exponentialRampToValueAtTime(settings.end, now + .075); filter.Q.value = settings.q;
        gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(settings.vol, now + .006); gain.gain.exponentialRampToValueAtTime(.0001, now + .085);
        source.connect(filter); filter.connect(gain); gain.connect(masterGain); source.start(now);
        const thud = audio.createOscillator(), thudGain = audio.createGain();
        thud.type = 'triangle'; thud.frequency.setValueAtTime(settings.freq, now); thud.frequency.exponentialRampToValueAtTime(settings.end, now + .07);
        thudGain.gain.setValueAtTime(.0001, now); thudGain.gain.exponentialRampToValueAtTime(settings.vol * .34, now + .004); thudGain.gain.exponentialRampToValueAtTime(.0001, now + .08);
        thud.connect(thudGain); thudGain.connect(masterGain); thud.start(now); thud.stop(now + .09);
      } catch (_) {}
    }
    function birdCall() {
      if (!audio || muted || audio.state === 'closed') return;
      const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(1550, t); osc.frequency.exponentialRampToValueAtTime(2100, t + .09);
      osc.frequency.exponentialRampToValueAtTime(1300, t + .21); gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.025, t + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .24); osc.connect(gain); gain.connect(masterGain || audio.destination); osc.start(t); osc.stop(t + .25);
    }
    $('#sound').addEventListener('click', () => {
      muted = !muted; $('#sound').textContent = muted ? '🔇' : '🔊';
      if (masterGain && audio) masterGain.gain.setTargetAtTime(muted ? 0 : .72, audio.currentTime, .15);
    });
    function toast(text) {
      const el = $('#toast'); el.textContent = text; el.classList.remove('hidden');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
    }
    function saveProgress() {
      try { localStorage.setItem('urfa-kasifler-levels-v1', JSON.stringify(saved)); } catch (_) {}
    }
    function levelDone(index) {
      return saved.levels[index].tokens.length === maps[index].items.length;
    }
    function levelUnlocked(index) {
      return maps.slice(0, index).every((_, previous) => levelDone(previous));
    }
    function updateQuest() {
      $('#level-name').textContent = map.name;
      $('#collect-count').textContent = progress.tokens.length;
      $('#collect-total').textContent = '/ ' + map.items.length;
      $('#quest-text').textContent = levelDone(mapIndex) ? 'Bölüm tamamlandı!' : progress.guide ? map.objective : map.guide;
    }

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
      if (p) { openDialogue(p); return; }
      const token = nearestToken();
      if (token) {
        progress.tokens.push(token.id); saveProgress(); world.remove(token.mesh);
        sparkles.splice(sparkles.indexOf(token), 1);
        updateQuest();
        if (levelDone(mapIndex)) openLevelSelect(mapIndex);
        else toast(map.items[token.id] + ' bulundu! ✨');
        return;
      }
      toast('Yakında konuşabileceğin biri ya da bir keşif yok.');
    }
    $('#touch-action').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
    const gameControls = ['#hud', '#crosshair', '#joystick', '#touch-action', '#look-hint'];
    function openLevelSelect(completed = null) {
      active = false; looking = false;
      closeDialogue();
      player.vx = 0; player.vz = 0;
      releaseStick();
      for (const key in keys) keys[key] = false;
      for (const selector of gameControls) $(selector).classList.add('hidden');
      $('#interaction-hint').classList.add('hidden');
      $('#toast').classList.add('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
      if (audio) for (const voice of marketVoices) voice.gain.gain.setTargetAtTime(0, audio.currentTime, .2);
      const next = completed !== null && completed + 1 < maps.length ? completed + 1 : null;
      $('#level-message').textContent = completed === null ? 'Keşfetmek istediğin bölümü seç.' :
        next === null ? 'Tebrikler! Bütün bölümleri tamamladın.' :
          maps[completed].name + ' tamamlandı. ' + maps[next].name + ' açıldı!';
      const list = $('#level-options');
      list.replaceChildren();
      maps.forEach((entry, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'level-option';
        button.disabled = !levelUnlocked(index);
        const badge = document.createElement('span');
        badge.className = 'level-number'; badge.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('strong');
        title.textContent = entry.name;
        const description = document.createElement('span');
        description.className = 'level-description'; description.textContent = entry.description;
        const status = document.createElement('span');
        status.className = 'level-status';
        status.textContent = button.disabled ? 'Önce ' + maps[index - 1].name + ' bölümünü bitir' :
          levelDone(index) ? 'Tamamlandı · Yeniden gez' : index === next ? 'Sonraki bölüme geç →' : 'Keşfe başla →';
        button.append(badge, title, description, status);
        button.addEventListener('click', () => enterMap(index));
        list.append(button);
      });
      $('#welcome').classList.add('hidden');
      $('#level-select').classList.remove('hidden');
      (list.children[next ?? mapIndex] || list.querySelector('button')).focus();
    }
    function enterMap(index) {
      if (!levelUnlocked(index)) return;
      if (index !== mapIndex) {
        useMap(index);
        progress = saved.levels[index];
        if (index === 1 && world.children.length === 0) buildWorkshopMap();
        [player.x, player.z, player.yaw] = map.spawn;
        targetYaw = player.yaw;
        targetPitch = player.pitch = -.01;
        player.bob = 0;
        camera.position.set(player.x, player.eye, player.z);
        camera.rotation.set(player.pitch, player.yaw, 0);
      }
      updateQuest();
      active = true;
      $('#level-select').classList.add('hidden');
      for (const selector of gameControls) $(selector).classList.remove('hidden');
      startAudio();
      if (!mobile) lockPointer();
      toast(levelDone(index) ? 'Bölümü yeniden keşfedebilirsin.' : progress.guide ? map.objective : map.guide);
    }
    function lockPointer() {
      if (canvas.requestPointerLock) canvas.requestPointerLock()?.catch(() => {});
    }
    $('#home').addEventListener('click', () => openLevelSelect());
    $('#start').addEventListener('click', () => openLevelSelect());
    $('#level-back').addEventListener('click', () => {
      $('#level-select').classList.add('hidden');
      $('#welcome').classList.remove('hidden');
      $('#start').focus();
    });
    document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === canvas; if (!isLocked) looking = false; });
    document.addEventListener('pointerlockerror', () => { isLocked = false; });
    canvas.addEventListener('click', () => { if (active && !isTalking && !isLocked) lockPointer(); });
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
      if (!active) return;
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
    function blocked(x, z, ignorePerson) {
      if (Math.abs(x) > map.limit || Math.abs(z) > map.limit) return true;
      for (const s of solids) {
        if (s.type === 'box') {
          const cx = Math.max(s.minX, Math.min(x, s.maxX)), cz = Math.max(s.minZ, Math.min(z, s.maxZ));
          const dx = x - cx, dz = z - cz;
          if (dx * dx + dz * dz < player.radius * player.radius) return true;
        } else if (Math.hypot(x - s.x, z - s.z) < player.radius + s.r) return true;
      }
      // The water basin is a continuous no-walk surface; its stone rim remains reachable.
      if (mapIndex === 0 && Math.hypot(x, z) < 8.18 + player.radius) return true;
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
    function groundType(x, z) {
      const r = Math.hypot(x, z);
      if (mapIndex === 0 && r >= 8.35 && r <= 14.05) return 'stone';
      for (const patch of grassZones) if (Math.hypot(x - patch.x, z - patch.z) <= patch.r) return 'grass';
      for (const patch of soilZones) if (Math.hypot(x - patch.x, z - patch.z) <= patch.r) return 'soil';
      return 'stone';
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
      waterTexture.offset.x = (now * .000012) % 1;
      waterTexture.offset.y = (now * .000008) % 1;
      if (mapIndex === 0) animateLake(now);
      for (const token of sparkles) {
        token.mesh.rotation.y = now * .00065; token.mesh.position.y = Math.sin(now * .002 + token.id) * .12;
        token.dust.rotation.y = -now * .0009; token.dust.position.y = .42 + Math.sin(now * .0022 + token.dust.userData.phase) * .09;
      }
      if (isTalking) dialogGesture += dt;
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
        if (moving) {
          footstepClock += dt;
          if (footstepClock >= .43) { footstepClock = 0; playFootstep(groundType(player.x, player.z)); }
        } else footstepClock = Math.min(footstepClock, .12);
        player.bob += dt * (moving ? 9 : 2);
        const yawDelta = Math.atan2(Math.sin(targetYaw - player.yaw), Math.cos(targetYaw - player.yaw));
        player.yaw += yawDelta * (1 - Math.exp(-16 * dt));
        player.pitch += (targetPitch - player.pitch) * (1 - Math.exp(-14 * dt));
        camera.position.set(player.x, player.eye + (moving ? Math.sin(player.bob) * .045 : 0), player.z);
        camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
        marketUpdateTimer += dt;
        if (marketUpdateTimer >= .12) {
          marketUpdateTimer = 0; updateListener();
          if (audio && !muted) for (const voice of marketVoices) {
            const distance = Math.hypot(player.x - voice.x, player.z - voice.z);
            const volume = mapIndex === 0 ? .034 * Math.max(.12, 1 - distance / 38) : 0;
            voice.gain.gain.setTargetAtTime(volume, audio.currentTime, .22);
          }
        }
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

    function animateLake(now) {
      for (const f of fish) {
        f.mesh.position.x = f.x + Math.cos(now * .00038 + f.phase) * .9;
        f.mesh.position.z = f.z + Math.sin(now * .00032 + f.phase) * .7;
        f.mesh.rotation.y = Math.sin(now * .00025 + f.phase) * .35;
      }
      fishRipples.forEach((r, i) => {
        const f = fish[r.fish], pulse = .72 + (Math.sin(now * .003 + r.phase + i) + 1) * .3;
        r.mesh.position.set(f.mesh.position.x, .39 + i * .0005, f.mesh.position.z);
        r.mesh.scale.setScalar(pulse);
        r.mesh.material.opacity = .16 + (Math.sin(now * .002 + r.phase) + 1) * .11;
      });
      ripples.forEach((r, i) => r.scale.setScalar(.8 + (Math.sin(now * .001 + i) + 1) * .12));
      for (const gull of gulls) {
        const t = now * .00012 + gull.phase;
        gull.mesh.position.set(gull.x + Math.cos(t) * 8.5, 8.5 + Math.sin(now * .0011 + gull.phase) * .48, gull.z + Math.sin(t) * 7.5);
        gull.mesh.rotation.y = -t + Math.PI / 2;
        const flap = Math.sin(now * .012 + gull.phase) * .46;
        gull.wings.forEach(w => { w.hinge.rotation.z = flap * w.side; });
      }
    }

    function angleDifference(from, to) {
      return Math.atan2(Math.sin(to - from), Math.cos(to - from));
    }

    function animatePerson(p, dt) {
      const { position, rotation } = p.mesh;
      const toPlayerX = player.x - position.x, toPlayerZ = player.z - position.z;
      const playerDistance = Math.hypot(toPlayerX, toPlayerZ);
      const chatting = p === dialogNpc;
      const noticePlayer = active && playerDistance < 3.4;
      const playerDirection = Math.atan2(toPlayerX, toPlayerZ);
      let traveled = 0;
      p.idle += dt;
      p.pause = Math.max(0, p.pause - dt);
      if (active && p.route && !chatting && playerDistance > 1.45 && p.pause === 0) {
        const [x, z] = p.route[p.routeIndex];
        const dx = x - position.x, dz = z - position.z, distance = Math.hypot(dx, dz);
        if (distance > .17) {
          p.facing = Math.atan2(dx, dz);
          const step = Math.min(distance, dt * .95);
          const nx = position.x + dx / distance * step, nz = position.z + dz / distance * step;
          if (!blocked(nx, nz, p) && Math.hypot(nx - player.x, nz - player.z) >= 1.35) {
            position.x = nx; position.z = nz;
            traveled = step; p.blockedTime = 0;
          } else p.blockedTime += dt;
        }
        if (distance <= .17 || p.blockedTime > .8) {
          p.routeIndex = (p.routeIndex + 1) % p.route.length;
          p.pause = distance <= .17 ? .48 : .24;
          p.blockedTime = 0;
        }
      }
      const ease = 1 - Math.exp(-8 * dt);
      const facePlayer = chatting || (noticePlayer && traveled === 0);
      rotation.y += angleDifference(rotation.y, facePlayer ? playerDirection : p.facing) * ease;
      const glance = noticePlayer ? THREE.MathUtils.clamp(angleDifference(rotation.y, playerDirection), -.55, .55) : .14 * Math.sin(p.idle * .77);
      const gesture = chatting ? Math.sin(Math.PI * Math.min(dialogGesture / .92, 1)) : 0;
      p.head.rotation.y += (glance - p.head.rotation.y) * ease;
      p.head.rotation.x += (.04 * Math.sin(p.idle * 1.65) + gesture * .11 - p.head.rotation.x) * ease;
      p.head.rotation.z = .035 * Math.sin(p.idle * 1.2);
      p.faceMaterial.map = p.faces[p.idle % 4.7 < .105 ? 1 : 0];
      p.walk = (p.walk + traveled * 8.4) % (Math.PI * 2);
      p.gait += ((traveled > 0 ? 1 : 0) - p.gait) * ease;
      const swing = Math.sin(p.walk) * p.gait;
      p.upper.position.y = .6 + .019 * Math.abs(swing) + .008 * Math.sin(p.idle * 2);
      p.upper.rotation.z = .038 * swing + .018 * Math.sin(p.idle * 1.4);
      p.legs[0].rotation.x = swing * .46;
      p.legs[1].rotation.x = -swing * .46;
      p.arms[0].rotation.x = -swing * .31 + .028 * Math.sin(p.idle * 1.4);
      p.arms[1].rotation.x = swing * .31 - gesture * .55;
      p.arms[0].rotation.z = -.12;
      p.arms[1].rotation.z = .12 + gesture * .18;
    }
  }

  function makeDustTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,220,1)'); grad.addColorStop(.22, 'rgba(255,231,133,.95)');
    grad.addColorStop(.58, 'rgba(255,194,54,.45)'); grad.addColorStop(1, 'rgba(255,174,30,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; return tex;
  }

  function makeDustGeometry(count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, radius = .28 + Math.random() * .52;
      positions.push(Math.cos(angle) * radius, .12 + Math.random() * 1.3, Math.sin(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); return geometry;
  }

  function npcEllipse(ctx, color, x, y, rx, ry, angle = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintNpcExpression(ctx, closed) {
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const x = side * 28;
      const blush = ctx.createRadialGradient(side * 43, 10, 1, side * 43, 10, 17);
      blush.addColorStop(0, 'rgba(201,99,93,.42)');
      blush.addColorStop(1, 'rgba(201,99,93,0)');
      npcEllipse(ctx, blush, side * 43, 10, 17, 11, side * -.15);

      ctx.strokeStyle = 'rgba(85,48,40,.58)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(x - 8, -23);
      ctx.quadraticCurveTo(x, -27, x + 8, -22);
      ctx.stroke();

      if (closed) {
        ctx.strokeStyle = '#4f3531';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, -5);
        ctx.quadraticCurveTo(x, -1, x + 6, -5);
        ctx.stroke();
      } else {
        npcEllipse(ctx, '#493431', x, -8, 6.1, 8.4, side * -.11);
        npcEllipse(ctx, '#fff0d9', x - 1.9, -11, 1.5, 1.7);
      }
    }

    npcEllipse(ctx, 'rgba(155,76,60,.19)', 0, 5, 4.3, 2.3);
    ctx.strokeStyle = '#824d45';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-12, 17);
    ctx.quadraticCurveTo(0, 26, 12, 16);
    ctx.stroke();
  }

  function makeNpcFace(palette, closed) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = palette.skin;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // The sphere's front faces +Z at u = .25.
    ctx.translate(64, 64);
    ctx.scale(.5, .5);
    const light = ctx.createRadialGradient(-9, -28, 3, -9, -28, 73);
    light.addColorStop(0, 'rgba(255,218,171,.32)');
    light.addColorStop(1, 'rgba(255,218,171,0)');
    npcEllipse(ctx, light, -9, -28, 73, 73);
    paintNpcExpression(ctx, closed);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function paintNpcClothing(ctx, palette) {
    ctx.fillStyle = palette.cloth;
    ctx.fillRect(0, 0, 256, 128);
    const dye = ctx.createLinearGradient(0, 0, 0, 128);
    dye.addColorStop(0, 'rgba(255,240,208,.16)');
    dye.addColorStop(.47, 'rgba(255,240,208,0)');
    dye.addColorStop(1, 'rgba(67,48,46,.19)');
    ctx.fillStyle = dye;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(255,240,205,.09)';
    ctx.lineWidth = 1;
    for (let y = 3; y < 128; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(113, 10); ctx.quadraticCurveTo(128, 25, 143, 10);
    ctx.stroke();
    if (palette.outfit === 'apron') {
      ctx.fillStyle = palette.trim;
      ctx.fillRect(108, 14, 4, 28);
      ctx.fillRect(144, 14, 4, 28);
      ctx.beginPath();
      ctx.moveTo(109, 34); ctx.lineTo(147, 34); ctx.lineTo(158, 104);
      ctx.quadraticCurveTo(128, 112, 98, 104);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(101,61,48,.18)';
      ctx.fillRect(117, 69, 22, 17);
      ctx.strokeStyle = 'rgba(255,248,225,.62)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(117, 68); ctx.lineTo(139, 68); ctx.stroke();
    } else if (palette.outfit === 'pockets') {
      ctx.fillStyle = palette.trim;
      ctx.fillRect(106, 58, 12, 12);
      ctx.fillRect(139, 58, 12, 12);
      npcEllipse(ctx, palette.trim, 128, 38, 4, 4);
    } else {
      ctx.fillStyle = 'rgba(48,49,43,.17)';
      ctx.fillRect(127, 22, 2, 82);
      for (let y = 34; y < 96; y += 16) npcEllipse(ctx, palette.trim, 131, y, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,234,193,.22)';
    ctx.fillRect(0, 111, 256, 2);
  }

  function makeNpcOutfit(palette) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    paintNpcClothing(canvas.getContext('2d'), palette);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeNpcPortrait(palette) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 144;
    canvas.className = 'npc-portrait';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(72, 146, 55, 49, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(-118, 94);
    ctx.scale(1.485, .7);
    paintNpcClothing(ctx, palette);
    ctx.restore();

    if (palette.headwear === 'scarf') {
      npcEllipse(ctx, palette.accent, 72, 64, 52, 53);
      npcEllipse(ctx, palette.accent, 72, 106, 37, 15);
    } else {
      npcEllipse(ctx, palette.skin, 27, 72, 8, 12);
      npcEllipse(ctx, palette.skin, 117, 72, 8, 12);
    }
    npcEllipse(ctx, palette.skin, 72, 65, 45, 42);
    if (palette.headwear === 'cap') {
      npcEllipse(ctx, palette.accent, 72, 30, 42, 18);
      npcEllipse(ctx, palette.accent, 75, 42, 47, 5, -.09);
    } else if (palette.headwear === 'hair') {
      npcEllipse(ctx, palette.accent, 69, 29, 42, 14, -.15);
      npcEllipse(ctx, palette.accent, 51, 37, 28, 10, -.27);
    }
    ctx.translate(72, 66);
    ctx.scale(.76, .76);
    paintNpcExpression(ctx, false);
    return canvas;
  }

  function makeTexture(kind) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d'); let seed = kind === 'stone' ? 41 : 83;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    if (kind === 'soil') {
      x.fillStyle = '#b8996c'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2200; i++) {
        const tone = ['#d6bd8c', '#8c704d', '#ead3a0', '#9d8058'][Math.floor(rand() * 4)];
        x.globalAlpha = .12 + rand() * .25; x.fillStyle = tone;
        const size = 1 + rand() * 5; x.beginPath(); x.ellipse(rand() * 512, rand() * 512, size * 1.5, size, rand(), 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
    } else if (kind === 'stone' || kind === 'paving') {
      paintMasonry(x, rand, kind === 'paving');
    } else if (kind === 'grass') {
      x.fillStyle = '#7c9057'; x.fillRect(0, 0, 512, 512);
      const colors = ['#b0ad72', '#5f7c54', '#9caa61', '#687847'];
      for (let i = 0; i < 3400; i++) {
        x.fillStyle = colors[i % colors.length];
        x.globalAlpha = .17 + rand() * .24;
        x.beginPath(); x.ellipse(rand() * 512, rand() * 512, 1 + rand() * 5, 1 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
      const edge = x.createRadialGradient(256, 256, 173, 256, 256, 254);
      edge.addColorStop(0, '#ffffff'); edge.addColorStop(1, 'rgba(255,255,255,0)');
      x.globalCompositeOperation = 'destination-in';
      x.fillStyle = edge; x.fillRect(0, 0, 512, 512);
      x.globalCompositeOperation = 'source-over';
    } else if (kind === 'wood') {
      x.fillStyle = '#7b4b2e'; x.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 74) {
        const palette = ['#b97a45', '#c58a50', '#a96c3f', '#d09b5f'];
        x.fillStyle = palette[Math.floor(rand() * palette.length)]; x.fillRect(0, y + 2, 512, 70);
        x.strokeStyle = '#75452d'; x.lineWidth = 3; x.strokeRect(0, y + 2, 512, 70);
        for (let i = 0; i < 19; i++) {
          const yy = y + 5 + rand() * 64;
          x.strokeStyle = rand() > .5 ? '#e2b67a' : '#78482d'; x.globalAlpha = .35; x.lineWidth = 1 + rand() * 2;
          x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(140, yy - 7, 330, yy + 6, 512, yy - 2); x.stroke();
        }
      }
      x.globalAlpha = 1;
    } else {
      x.fillStyle = '#448e91'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 70; i++) {
        const px = rand() * 512, py = rand() * 512, radius = 20 + rand() * 60;
        for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
          const cx = px + dx, cy = py + dy;
          if (cx + radius < 0 || cx - radius > 512 || cy + radius < 0 || cy - radius > 512) continue;
          const wash = x.createRadialGradient(cx, cy, 0, cx, cy, radius);
          wash.addColorStop(0, i % 3 ? 'rgba(125,191,175,.21)' : 'rgba(20,92,105,.22)');
          wash.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = wash; x.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        }
      }
      for (let i = 0; i < 104; i++) {
        const py = 8 + rand() * 496, px = rand() * 512, length = 14 + rand() * 95;
        const arc = 2 + rand() * 5, tint = i % 4 ? 'rgba(190,229,206,.22)' : 'rgba(20,94,109,.24)';
        for (const start of [px, px - 512]) {
          x.beginPath(); x.moveTo(start, py);
          x.quadraticCurveTo(start + length * .5, py - arc, start + length, py + 2);
          x.quadraticCurveTo(start + length * .48, py - arc + 2.7, start, py);
          x.fillStyle = tint; x.fill();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding; return tex;
  }

  function paintMasonry(context, random, paving) {
    const size = 512, rows = paving ? 10 : 7, columns = paving ? 7 : 5;
    const colors = paving
      ? ['#d6c6aa', '#d7c9b5', '#cbbd9e', '#c5baa6', '#dfcdb2', '#c1b69f']
      : ['#d7c49e', '#d0b996', '#e1cba6', '#d8c7aa', '#c9b493', '#e0ceb3'];
    const stamp = document.createElement('canvas'); stamp.width = 192; stamp.height = 88;
    const brush = stamp.getContext('2d');
    context.fillStyle = paving ? '#a69e8a' : '#ab977c'; context.fillRect(0, 0, size, size);

    for (let row = 0; row < rows; row++) {
      const y = Math.floor(row * size / rows);
      const height = Math.floor((row + 1) * size / rows) - y;
      let x = row % 2 ? 41 : 0;
      const cuts = Array.from({ length: columns - 1 }, (_, i) => Math.round((i + 1) * size / columns + (random() - .5) * 34));
      let previous = 0;
      for (const cut of [...cuts, size]) {
        const width = cut - previous;
        previous = cut;
        const w = width - 3, h = height - 3, bevel = 3 + random() * 4;
        brush.clearRect(0, 0, stamp.width, stamp.height);
        brush.save();
        brush.beginPath();
        brush.moveTo(bevel, 0); brush.lineTo(w - bevel, 0);
        brush.quadraticCurveTo(w, 0, w, bevel);
        brush.lineTo(w - 1, h - bevel); brush.quadraticCurveTo(w - 2, h, w - bevel - 1, h);
        brush.lineTo(bevel, h - 1); brush.quadraticCurveTo(0, h - 2, 0, h - bevel - 1);
        brush.lineTo(0, bevel); brush.quadraticCurveTo(0, 0, bevel, 0);
        brush.closePath(); brush.clip();
        brush.fillStyle = colors[Math.floor(random() * colors.length)]; brush.fillRect(0, 0, w, h);
        const light = brush.createLinearGradient(0, 0, w * .32, h);
        light.addColorStop(0, 'rgba(255,248,225,.46)');
        light.addColorStop(.37, 'rgba(255,248,225,0)');
        light.addColorStop(.78, 'rgba(101,78,48,0)');
        light.addColorStop(1, 'rgba(101,78,48,.25)');
        brush.fillStyle = light; brush.fillRect(0, 0, w, h);
        for (let mark = 0; mark < 36; mark++) {
          brush.fillStyle = mark % 3 ? 'rgba(100,85,60,.12)' : 'rgba(255,249,225,.25)';
          brush.beginPath();
          brush.ellipse(random() * w, random() * h, .5 + random() * 4.3, .4 + random() * 1.65, random() * Math.PI, 0, Math.PI * 2);
          brush.fill();
        }
        brush.restore();
        context.drawImage(stamp, 0, 0, w, h, x + 1, y + 1, w, h);
        if (x + width > size) context.drawImage(stamp, 0, 0, w, h, x + 1 - size, y + 1, w, h);
        x += width;
      }
    }
  }

  function loadProgress(maps) {
    function read(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
    }
    const current = read('urfa-kasifler-levels-v1');
    const legacy = read('urfa-balikligol-v2') || read('urfa-balikligol-story');
    return {
      levels: maps.map((map, index) => {
        const level = current?.levels?.[index] ?? (index === 0 ? legacy : null);
        const tokens = Array.isArray(level?.tokens)
          ? [...new Set(level.tokens.filter(id => Number.isInteger(id) && id >= 0 && id < map.items.length))]
          : [];
        return { guide: !!level?.guide, tokens };
      })
    };
  }
})();
