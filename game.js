/* Urfa'nın Minik Kaşifleri — küçük, geometrik ve tamamen 3D bir şehir gezisi. */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const game = $('#game'), scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8e1d7');
  scene.fog = new THREE.Fog('#b8e1d7', 35, 78);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; game.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-12, 12, 12, -12, .1, 120);
  const hemi = new THREE.HemisphereLight(0xfff4d9, 0x927a60, 2.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.2); sun.position.set(-18, 30, 15); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; scene.add(sun);
  const city = new THREE.Group(); scene.add(city);
  const mats = {};
  const mat = color => mats[color] || (mats[color] = new THREE.MeshStandardMaterial({ color, roughness: .91, flatShading: true }));
  const box = (w,h,d,color,x,y,z,parent=city) => { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color)); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; };
  const ball = (r,color,x,y,z,parent=city,detail=1) => { const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; };
  const cylinder = (rt,rb,h,color,x,y,z,parent=city,n=8) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; };
  const group=(x=0,y=0,z=0,parent=city)=>{const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;};
  const ground = box(72,.5,72,'#e7c990',0,-.28,0); ground.receiveShadow=true;
  // Golden paving paths form an easy-to-read little street grid.
  for(let z=-25;z<=25;z+=10) box(72,.035,2.2,'#f3dfb8',0,.0,z);
  for(let x=-25;x<=25;x+=12) box(2.2,.04,72,'#f3dfb8',x,.02,0);
  // Balıklıgöl: clear turquoise water, pale stone rim, tiny swimming fish.
  const pond=group(-13,.02,-13); const water=new THREE.Mesh(new THREE.CylinderGeometry(7,7,.18,32),new THREE.MeshStandardMaterial({color:'#62cbd0',roughness:.24,metalness:.05}));water.position.y=.12;water.receiveShadow=true;pond.add(water);
  cylinder(7.12,7.12,.48,'#d9bd8d',0,.04,0,pond,32); cylinder(6.45,6.45,.12,'#8ccfbe',0,.2,0,pond,32);
  for(let i=0;i<9;i++){const a=i*2.4,r=2.3+(i%4)*.75,f=ball(.22,i%2?'#f6a06a':'#ffd273',Math.cos(a)*r,.38,Math.sin(a)*r,pond,1);f.scale.set(1.4,.55,.7);f.userData.swim=i;}
  // Old town stone homes around the little squares.
  function house(x,z,color='#d9b887',w=4,d=3.6){const g=group(x,0,z);box(w,2.8,d,color,0,1.4,0,g);box(w+.18,.22,d+.18,'#b88c60',0,2.82,0,g);box(.86,1.5,.12,'#795948',0,.76,d/2+.065,g);box(.17,.17,.08,'#edc46e',.23,.75,d/2+.13,g);for(const side of [-1,1]){box(.58,.62,.09,'#89b9ad',side*w*.29,1.85,d/2+.05,g);box(.72,.13,.13,'#f1d7aa',side*w*.29,2.22,d/2+.03,g);}return g;}
  house(-23,-19,'#d7b589',4.8,4);house(-27,-10,'#e1c399',4,3.6);house(-22,-2,'#cda879',4.6,4);house(-29,4,'#e3c9a0',4,3.6);
  house(21,-21,'#d9b589',5,4);house(27,-12,'#e7cda2',4.2,3.5);house(22,-3,'#cfaa7b',4.8,4);house(27,7,'#e3c49a',4.2,3.5);house(-21,21,'#ddc096',4.5,3.8);house(-28,14,'#cda87d',4,3.5);
  // Courtyard shade awnings and warm textiles in the bazaar.
  const stalls=[]; for(let i=0;i<5;i++){const x=-3+i*3.4,z=7;box(2.6,1.55,2.3,'#bf9369',x,.78,z);box(2.85,.18,2.6,'#f2d8a7',x,1.65,z);const aw=box(3,.2,2.9,['#e98163','#e9bd5c','#79aaa0','#bd8caa','#ef946d'][i],x,2.25,z);aw.rotation.z=.06;box(.95,.55,.1,'#d7b573',x,1.42,z+1.2);stalls.push(group(x,0,z));}
  // The castle sits on a layered rocky hill with a welcoming stair path.
  const hill=cylinder(6.2,8,2.5,'#b58c65',19,1.1,18,city,9); hill.rotation.y=.15;
  cylinder(4.3,4.7,3.8,'#9e795a',19,3.3,18,city,9);
  const castle=group(19,0,18); for(let i=0;i<8;i++){const a=i*Math.PI/4;const x=Math.cos(a)*3.65,z=Math.sin(a)*3.65;cylinder(.55,.66,5.7,'#c5a17a',x,6.0,z,castle,7);cylinder(.69,.68,.3,'#e0c296',x,8.95,z,castle,7);}
  cylinder(3.8,4.1,2.2,'#c8a47a',0,5.2,0,castle,9);box(1.3,2.3,.22,'#795d49',0,4.25,4.03,castle);
  for(let i=0;i<5;i++)box(1.2,.35,1.3,'#d8bb92',19,2.3+i*.45,13-i*1.12);
  // Native plants: olive trees, palms and flowering pots.
  function tree(x,z,palm=false){const g=group(x,0,z);cylinder(.17,.25,1.4,'#9b704f',0,.7,0,g,6);if(palm){cylinder(.1,.21,2.2,'#a87c52',0,1.1,0,g,6);for(let i=0;i<6;i++){const leaf=box(1.8,.09,.38,'#83a66c',Math.cos(i*Math.PI/3)*.65,2.05,Math.sin(i*Math.PI/3)*.65,g);leaf.rotation.y=-i*Math.PI/3;leaf.rotation.z=-Math.cos(i*Math.PI/3)*.42;}}else{ball(.95,'#6e9a71',0,1.8,0,g,1);ball(.62,'#83ac7c',.35,2.25,.05,g,1);ball(.48,'#91b684',-.42,2.35,-.15,g,1);}return g;}
  [[-7,-22],[-2,-23],[5,-24],[12,-18],[15,-10],[-17,7],[-17,15],[14,10],[9,16],[-5,17],[8,-8]].forEach(([x,z],i)=>tree(x,z,i%4===0));
  // Landmark signs mark the real place and introduce kid-friendly local facts.
  const spots=[];
  function sign(x,z,title,emoji,color,callback){const g=group(x,0,z);box(1.25,.92,.18,color,0,1.35,0,g);box(.14,1.5,.14,'#9b7452',0,.45,0,g);const tag=ball(.22,'#ffdc7c',0,2.05,.03,g);tag.userData.bob=true;spots.push({x,z,title,emoji,callback,mesh:g});return g;}
  sign(-7,-13,'Balıklıgöl','🐟','#62b8aa',()=>quiz('Balıklıgöl','🐟','Balıklıgöl’de anlatılan meşhur balıklar hangi renkle anılır?',['Alacalı balıklar','Mor benekli balıklar','Altın kanatlı balıklar'],0,'Balıklıgöl, Şanlıurfa’nın merkezinde yer alan tarihî bir göldür. Balıklarına dokunulmaz; gölün çevresi ziyaretçiler için güzel bir gezinti alanıdır.'));
  sign(14,15,'Urfa Kalesi','🏰','#dc9866',()=>quiz('Urfa Kalesi','🏰','Kale şehrin neresinde yükselir?',['Şehrin ortasındaki yüksek bir tepede','Gölün tam ortasında','Çarşının çatısında'],0,'Urfa Kalesi, şehre yukarıdan bakan kayalık bir tepe üzerinde bulunur. Eteklerinden eski şehir manzarası görülür.'));
  sign(2,5,'Tarihî çarşı','🧺','#d8a64e',()=>quiz('Tarihî çarşı','🧺','Bir çarşıda en çok ne yaparız?',['Alışveriş yapıp esnafla tanışırız','Balıklara yem veririz','Yıldızları toplarız'],0,'Şanlıurfa çarşılarında bakırcılık, baharat ve geleneksel el işleri gibi zanaatlar yaşar.'));
  sign(-23,2,'Taş evler','🪟','#b78662',()=>quiz('Taş evler','🪟','Eski Urfa evlerinde hangi malzeme sıkça kullanılır?',['Yakındaki açık renkli taş','Buz','Cam şişe'],0,'Geleneksel Urfa evleri, bölgenin taş ustalığını ve avlulu yaşam kültürünü yansıtır.'));
  sign(22,-10,'Göl bahçesi','🌿','#79a879',()=>{showInfo('Göl Bahçesi','🌿','Şehrin küçük bahçelerinde dinlen, ağaçların arasındaki parıltıları ara!');});
  // Playable explorer, with simple squash-free limb animation and outfit choices.
  const player=group(0,0,13), outfitMaterials={coral:mat('#e77e57'),teal:mat('#4da99a'),lilac:mat('#a47db4')};
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.55,3,7),outfitMaterials.coral);body.position.y=.95;body.castShadow=true;player.add(body);
  ball(.43,'#f4c89c',0,1.85,0,player,2);const hat=cylinder(.25,.55,.18,'#e77e57',0,2.23,0,player,8);const brim=cylinder(.55,.55,.1,'#e77e57',0,2.15,0,player,8);
  const eyeMat=mat('#55483e');ball(.055,'#55483e',-.14,1.91,.37,player,1);ball(.055,'#55483e',.14,1.91,.37,player,1);
  const legs=[];for(let i=0;i<2;i++){const leg=box(.2,.53,.23,'#6e7790',i? .19:-.19,.28,0,player);legs.push(leg);ball(.2,'#865a49',i?.19:-.19,.03,.04,player,1);}
  const backpack=box(.48,.52,.24,'#e9bd5c',0,1.07,-.4,player);backpack.rotation.x=-.12;
  const outfitNames=['coral','teal','lilac'];let outfit='coral';
  document.querySelectorAll('.avatar-option').forEach(b=>b.onclick=()=>{document.querySelectorAll('.avatar-option').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');outfit=b.dataset.outfit;body.material=outfitMaterials[outfit];hat.material=brim.material=outfitMaterials[outfit];});
  const savedStars=new Set(JSON.parse(localStorage.getItem('urfa-stars')||'[]'));
  const tokens=[]; for(let i=0;i<5;i++){const a=i*2.4,r=4.1+(i%2)*1.2,x=-13+Math.cos(a)*r,z=-13+Math.sin(a)*r;if(savedStars.has(i))continue;const g=group(x,0,z);const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.38,0),mat('#ffd25f'));gem.position.y=.85;gem.castShadow=true;g.add(gem);const ring=new THREE.Mesh(new THREE.TorusGeometry(.56,.07,6,16),mat('#fff1ad'));ring.position.y=.85;g.add(ring);tokens.push({id:i,x,z,mesh:g});}
  let stars=savedStars.size;$('#star-count').textContent=stars;let active=false,nearby=null,keys={},joy={x:0,y:0},last=0,walk=0,toastTimer,discoveryTimer,quizCount=0;
  const mission=$('#mission-text');
  const start=$('#start-screen');$('#start-button').onclick=()=>{start.classList.add('hidden');$('#hud').classList.remove('hidden');$('#joystick').classList.remove('hidden');$('#interact-button').classList.remove('hidden');active=true;announce('Balıklıgöl','Şanlıurfa’nın meşhur gölünü bul ve çevresini keşfet.');};
  function announce(title,copy){$('#discovery-title').textContent=title;$('#discovery-copy').textContent=copy;$('#discovery').classList.remove('hidden');clearTimeout(discoveryTimer);discoveryTimer=setTimeout(()=>$('#discovery').classList.add('hidden'),3900);}
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),1900);}
  function dialog(title,emoji,copy,content=''){const d=$('#dialog');d.innerHTML=`<div class="dialog-card"><div class="emoji">${emoji}</div><h2>${title}</h2><p>${copy}</p>${content}<button class="close-button" data-close>Devam edelim</button></div>`;d.classList.remove('hidden');}
  function closeDialog(){$('#dialog').classList.add('hidden');}
  function showInfo(title,emoji,copy){dialog(title,emoji,copy);}
  function quiz(title,emoji,question,answers,correct,learn){const d=$('#dialog');d.innerHTML=`<div class="dialog-card"><div class="emoji">${emoji}</div><h2>${title}</h2><p>${question}</p><div class="answers">${answers.map((a,i)=>`<button class="answer-button" data-answer="${i}">${a}</button>`).join('')}</div><p class="feedback" aria-live="polite"></p><button class="close-button" data-close>Devam edelim</button></div>`;d.classList.remove('hidden');d.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const ok=Number(b.dataset.answer)===correct;d.querySelector('.feedback').textContent=ok?`Harika! ${learn}`:'Güzel tahmin! Biraz daha gezip tekrar deneyebilirsin.';d.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);if(ok){quizCount++;mission.textContent=quizCount>=4?'Beş parıltıyı topla!':'Şehri keşfetmeye devam et';toast('Bilgi yıldızı kazandın! ✨');}});}
  $('#dialog').onclick=e=>{if(e.target.matches('[data-close]')||e.target===$('#dialog'))closeDialog();};
  function interaction(){if(!active)return;if(nearby){nearby.callback();return;}toast('Yakında bir keşif noktası yok.');}
  $('#interact-button').onpointerdown=e=>{e.preventDefault();interaction();};window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyE'||e.code==='Space')interaction();if(e.code==='Escape')closeDialog();},{passive:false});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',()=>keys={});
  const joystick=$('#joystick'),knob=joystick.querySelector('span');let pointer=null;
  function joyMove(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy)||1,k=Math.min(1,42/len);joy.x=dx*k/42;joy.y=-dy*k/42;knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;}
  joystick.onpointerdown=e=>{pointer=e.pointerId;joystick.setPointerCapture(pointer);joyMove(e);};joystick.onpointermove=e=>{if(e.pointerId===pointer)joyMove(e);};const joyEnd=()=>{pointer=null;joy={x:0,y:0};knob.style.transform='';};joystick.onpointerup=joyEnd;joystick.onpointercancel=joyEnd;
  $('#home-button').onclick=()=>{active=false;start.classList.remove('hidden');$('#hud').classList.add('hidden');$('#joystick').classList.add('hidden');$('#interact-button').classList.add('hidden');};
  function resize(){const w=innerWidth,h=innerHeight,view=17;camera.left=-view*w/h/2;camera.right=view*w/h/2;camera.top=view/2;camera.bottom=-view/2;camera.updateProjectionMatrix();renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));}
  addEventListener('resize',resize);resize();
  const target=new THREE.Vector3();const cameraOffset=new THREE.Vector3(15,19,17);camera.position.copy(cameraOffset);camera.lookAt(0,0,0);
  function loop(t){requestAnimationFrame(loop);const dt=Math.min(.04,(t-last)/1000||0);last=t;
    for(const f of pond.children)if(f.userData.swim!==undefined){const i=f.userData.swim;f.position.x=Math.cos(t*.00045+i*2.4)*(2.1+i%4*.62);f.position.z=Math.sin(t*.00036+i*2.4)*(2.2+i%3*.55);}
    for(const s of spots){const marker=s.mesh.children[2];if(marker)marker.position.y=2.05+Math.sin(t*.003+s.x)*.11;}
    for(const token of tokens){token.mesh.rotation.y=t*.0015;token.mesh.position.y=Math.sin(t*.003+token.id)*.12;}
    if(active&&$('#dialog').classList.contains('hidden')){
      let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
      let z=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)-joy.y;
      const n=Math.hypot(x,z);if(n>.12){if(n>1){x/=n;z/=n;}const speed=6.2;player.position.x=THREE.MathUtils.clamp(player.position.x+x*speed*dt,-32,32);player.position.z=THREE.MathUtils.clamp(player.position.z+z*speed*dt,-32,32);player.rotation.y=Math.atan2(x,z);walk+=dt*10;legs[0].rotation.x=Math.sin(walk)*.55;legs[1].rotation.x=-Math.sin(walk)*.55;body.position.y=.95+Math.abs(Math.sin(walk))*.045;}
      else{legs.forEach(l=>l.rotation.x*=.75);body.position.y=.95;}
      target.set(player.position.x,0,player.position.z);camera.position.lerp(target.clone().add(cameraOffset),.075);camera.lookAt(target);
      nearby=null;let close=2.8;for(const s of spots){const d=Math.hypot(s.x-player.position.x,s.z-player.position.z);if(d<close){nearby=s;close=d;}}
      for(let i=tokens.length-1;i>=0;i--){const token=tokens[i];if(Math.hypot(token.x-player.position.x,token.z-player.position.z)<1){savedStars.add(token.id);localStorage.setItem('urfa-stars',JSON.stringify([...savedStars]));token.mesh.removeFromParent();tokens.splice(i,1);stars=savedStars.size;$('#star-count').textContent=stars;mission.textContent=stars>=5?'Bütün parıltıları topladın!':'Parıltıları topla: '+stars+'/5';toast('Parıltı bulundu! ✨');if(stars===5)announce('Kaşif rozeti hazır!','Beş parıltının hepsini topladın. Harikasın!');}}
      $('#prompt').classList.toggle('hidden',!nearby);$('#interact-button').classList.toggle('ready',!!nearby);
    }
    renderer.render(scene,camera);
  }
  requestAnimationFrame(loop);
})();

