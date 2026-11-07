'use strict';
/* ---- storage ---- */
const KEY='sanliurfa_v1';
const Save={d:{seals:[],stars:0},load(){try{Object.assign(this.d,JSON.parse(localStorage.getItem(KEY)))}catch(e){}},put(){try{localStorage.setItem(KEY,JSON.stringify(this.d))}catch(e){}},reset(){this.d={seals:[],stars:0};this.put()}};
const $=s=>document.querySelector(s);
/* ---- ses ---- */
let AC;function beep(f=660,t=.12){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+t)}catch(e){}}
function toast(m){const t=$('#toast');t.textContent=m;t.style.opacity=1;clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity=0,2200)}
/* ---- sahne ---- */
const ZONES={g:{n:'Göbeklitepe',sky:0x7fc4c0,gr:0x5fb3ad,st:0x8a7f9c},h:{n:'Harran',sky:0xe9b98a,gr:0xe8c08e,st:0xf3dcb8},b:{n:'Balıklıgöl',sky:0xbfe6ee,gr:0xe9d3a8,st:0xe6cfa5}};
const ORDER=['g','h','b'];
const R=new THREE.WebGLRenderer({antialias:devicePixelRatio<2});R.setPixelRatio(Math.min(devicePixelRatio,1.5));R.shadowMap.enabled=true;$('#game').appendChild(R.domElement);
const scene=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
scene.add(new THREE.HemisphereLight(0xffffff,0xb9a98f,.85));const sun=new THREE.DirectionalLight(0xfff1d6,.7);sun.position.set(8,14,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16});scene.add(sun);
const world=new THREE.Group();scene.add(world);
function size(){const w=innerWidth,h=innerHeight,s=Math.max(8,12*(700/Math.min(w,h))*.6)*zoom,a=w/h;R.setSize(w,h);cam.left=-s*a/2;cam.right=s*a/2;cam.top=s/2;cam.bottom=-s/2;cam.updateProjectionMatrix()}
let zoom=1;addEventListener('resize',size);addEventListener('wheel',e=>{zoom=Math.min(1.6,Math.max(.6,zoom+e.deltaY*.001));size()});
const mat=c=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
function box(w,h,d,c,x,y,z,p=world){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m}
function cone(r,h,c,x,y,z,seg=7){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,seg),mat(c));m.position.set(x,y,z);m.castShadow=true;world.add(m);return m}
function ball(r,c,x,y,z,p=world){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),mat(c));m.position.set(x,y,z);m.castShadow=true;p.add(m);return m}
function tree(x,z,c=0x4a9a8c){box(.25,1,.25,0xb59a5a,x,.5,z);ball(.8,c,x,1.5,z)}
function palm(x,z){box(.2,1.8,.2,0xa98558,x,.9,z);for(let i=0;i<5;i++){const l=box(1.2,.06,.3,0x6f9a5a,x+Math.cos(i*1.26)*.5,1.9,z+Math.sin(i*1.26)*.5);l.rotation.y=-i*1.26}}
/* ---- oyuncu (şapkalı kâşif, turuncu atkı + köpek) ---- */
const player=new THREE.Group();
box(.5,.6,.35,0x8e8e96,0,.6,0,player);box(.52,.12,.38,0xe8793a,0,.95,0,player);ball(.3,0xffd9b8,0,1.2,0,player);const cap=box(.55,.2,.5,0x7a7a82,0,1.45,.02,player);box(.5,.06,.3,0x7a7a82,0,1.38,.3,player);box(.14,.14,.14,0x3a3a40,-.12,.3,0,player);box(.14,.14,.14,0x3a3a40,.12,.3,0,player);
const dog=new THREE.Group();box(.4,.25,.2,0xfafafa,0,.25,0,dog);ball(.14,0xc9742f,.25,.38,0,dog);box(.1,.2,.1,0xfafafa,-.2,.12,0,dog);
let inter=[],pos=new THREE.Vector3(),zone=null,state={};
function build(z){
 world.clear();world.add(player);world.add(dog);inter=[];state={};zone=z;const Z=ZONES[z];scene.background=new THREE.Color(Z.sky);
 box(30,1,30,Z.gr,0,-.5,0).receiveShadow=true;
 if(z==='g'){ // T biçimli dikilitaşlar
  [[-5,-5,'🦊'],[5,-4,'🐗'],[-4,5,'🐍'],[5,5,'🦅']].forEach(([x,zz,s])=>{box(2.6,.5,.6,Z.st,x,2.4,zz);box(.8,2.2,.5,Z.st,x,1.1,zz);box(.8,.8,.04,0x9d93b0,x,1.3,zz+.28);add(x,zz,'Taş sütunu',()=>find(s))});
  box(8,.3,8,0x7b708c,0,.15,0).scale.set(1,1,1);[[-9,0],[9,1],[0,-9],[1,9]].forEach(([x,y])=>tree(x,y));
  state={found:[]};
 }else if(z==='h'){ // konik kubbeli evler
  [[-6,-4],[6,-5],[-7,5],[7,4],[0,-8]].forEach(([x,y])=>{box(2.4,1.6,2.4,Z.st,x,.8,y);cone(1.5,2.4,0xf6e3c4,x,2.8,y,10);box(.6,1,.1,0x8a5a3a,x,.5,y+1.2)});
  palm(-10,0);palm(10,-1);palm(3,9);
  box(3,.3,3,0xd8aa70,0,.15,0);add(0,0,'Mimar tezgâhı',harran);
 }else{ // havuz + balıklar + köprü
  box(14,.1,9,0x39c6d9,0,.05,0);box(14.6,.5,.4,Z.st,0,.25,-4.7);box(14.6,.5,.4,Z.st,0,.25,4.7);
  box(2,.2,9.4,0xc9a36a,0,.45,0);
  state.fish=[];for(let i=0;i<6;i++){const f=ball(.2,0xff9a4a,0,.2,0);f.scale.set(1.6,.7,.8);state.fish.push(f)}
  [[-9,6],[9,6],[-9,-6]].forEach(([x,y])=>palm(x,y));
  box(3,2,3,Z.st,-9,1,-1);cone(1.5,1.5,0xffffff,-9,2.7,-1,12);box(1,5,1,Z.st,9,2.5,-3);cone(.7,.8,0xffffff,9,5.4,-3,10);
  state.found=[];[['⭐',-6.5,6],['🏺',6,6.5],['🔑',-6,-6.5]].forEach(([s,x,y])=>{const m=ball(.3,0xffd34d,x,.5,y);add(x,y,'Gizli nesne',()=>{if(state.found.includes(s))return;state.found.push(s);m.visible=false;beep(880);toast(s+' bulundu! ('+state.found.length+'/3)');if(state.found.length===3)setTimeout(memory,700)},m)});
 }
 pos.set(0,0,z==='h'?4:8);$('#zt').textContent=Z.n;$('#hud').classList.remove('hidden');$('#joy').classList.remove('hidden');$('#act').classList.remove('hidden');
 toast(z==='g'?'4 taş sütunda gizli sembolleri bul!':z==='h'?'Mimar tezgâhına git!':'Çevredeki 3 gizli nesneyi bul!');size();
}
function add(x,z,label,fn,m){inter.push({x,z,label,fn,m})}
/* ---- mini oyunlar ---- */
function mg(html){const p=$('#mg');p.innerHTML=html;p.classList.remove('hidden')}
function closeMg(){$('#mg').classList.add('hidden')}
function find(s){if(state.found.includes(s)){toast('Bunu zaten buldun: '+s);return}state.found.push(s);beep(740);toast(s+' sembolü bulundu! ('+state.found.length+'/4)');if(state.found.length===4)setTimeout(gPuzzle,800)}
function gPuzzle(){const ans=['🦊','🐗','🐍','🦅'];let cur=[];const draw=()=>mg(`<h2>Kayıp Semboller</h2><div class="card">İpucu: Tilki avlanır, yaban domuzu gelir, yılan sürünür, kartal yükselir.<br><b>Sıra: ${cur.join(' ')||'—'}</b></div><div class="row">${['🐍','🦅','🦊','🐗'].map(s=>`<button class="sym" data-s="${s}" ${cur.includes(s)?'disabled':''}>${s}</button>`).join('')}</div><button id="rs">↺</button>`);
 draw();$('#mg').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='rs'){cur=[];draw();return}cur.push(b.dataset.s);beep(520);draw();if(cur.length===4){if(cur.join('')===ans.join(''))win('g',3);else{toast('Yanlış sıra, tekrar dene!');cur=[];setTimeout(draw,600)}}}}
function harran(){const need=['duvar','kubbe','kapi'];let ok=0,tries=0;
 mg(`<h2>Kayıp Şehrin Mimarı</h2><div class="card">Harran evleri kerpiç tuğladan, konik kubbelidir. Parçaları yerine sürükle!</div>
 <div class="row" style="flex-direction:column;align-items:center"><div class="slot" data-k="kubbe">▲ Kubbe</div><div class="slot" data-k="duvar">▭ Duvar</div><div class="slot" data-k="kapi">🚪 Kapı</div></div>
 <div class="row">${['kapi','kubbe','duvar'].map(k=>`<div class="part" data-k="${k}">${{kapi:'🚪 Kapı',kubbe:'▲ Kubbe',duvar:'▭ Duvar'}[k]}</div>`).join('')}</div>`);
 document.querySelectorAll('.part').forEach(p=>{let sx,sy,drag=0;p.onpointerdown=e=>{drag=1;sx=e.clientX;sy=e.clientY;p.setPointerCapture(e.pointerId);p.style.zIndex=9};
  p.onpointermove=e=>{if(drag)p.style.transform=`translate(${e.clientX-sx}px,${e.clientY-sy}px)`};
  p.onpointerup=e=>{drag=0;p.style.display='none';const t=document.elementFromPoint(e.clientX,e.clientY);p.style.display='';const s=t&&t.closest('.slot');
   if(s&&s.dataset.k===p.dataset.k&&!s.classList.contains('ok')){s.classList.add('ok');p.style.display='none';beep(700);if(++ok===3)setTimeout(()=>win('h',tries<2?3:2),500)}else{if(s)tries++;p.style.transform='';p.style.zIndex=1;if(s)toast('Burası olmadı!')}}})}
function memory(){const em=['🐟','🌸','🕌','🐟','🌸','🕌'].sort(()=>Math.random()-.5);let open=[],done=0,lock=0,mv=0;
 mg(`<h2>Efsanenin İzinde</h2><div class="card">Balıklıgöl'ün sembollerini eşleştir!</div><div class="row" style="max-width:280px">${em.map((e,i)=>`<button class="mem" data-i="${i}">❓</button>`).join('')}</div>`);
 $('#mg').onclick=e=>{const b=e.target.closest('.mem');if(!b||lock||b.disabled||open.includes(b))return;b.textContent=em[b.dataset.i];open.push(b);beep(500);if(open.length===2){mv++;lock=1;const[a,c]=open;setTimeout(()=>{if(em[a.dataset.i]===em[c.dataset.i]){a.disabled=c.disabled=true;done++;if(done===3)win('b',mv<6?3:2)}else a.textContent=c.textContent='❓';open=[];lock=0},600)}}}
/* ---- ilerleme ---- */
function win(z,st){closeMg();$('#mg').onclick=null;if(!Save.d.seals.includes(z)){Save.d.seals.push(z);Save.d.stars+=st;Save.put()}beep(990,.4);
 const final=Save.d.seals.length===3;
 mg(`<h1>🏅</h1><h2>${ZONES[z].n} Mührü Kazanıldı!</h2><div style="font-size:44px">${'⭐'.repeat(st)}</div><div class="card">${final?'Üç mührü topladın! Kadim kapı açılıyor: kayıp uygarlığın sırrını çözdün. 🎉<br><small>Not: Hikâye kurgudur; Göbeklitepe (~12.000 yıl), Harran evleri ve Balıklıgöl gerçek yerlerdir.</small>':'Sıradaki bölüm açıldı.'}</div><button id="ok">Haritaya Dön</button>`);
 $('#ok').onclick=()=>{closeMg();showMap()}}
function showMap(){zone=null;['#hud','#joy','#act'].forEach(s=>$(s).classList.add('hidden'));const m=$('#map');m.classList.remove('hidden');
 m.innerHTML=`<h2>Bölüm Haritası — ⭐ ${Save.d.stars}</h2>`+ORDER.map((z,i)=>{const open=i===0||Save.d.seals.includes(ORDER[i-1]);return `<button class="card" data-z="${z}" ${open?'':'disabled'}>${open?'':'🔒 '}${i+1}. ${ZONES[z].n} ${Save.d.seals.includes(z)?'🏅':''}</button>`}).join('')}
$('#map').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('#map').classList.add('hidden');build(b.dataset.z)};
$('#cont').onclick=()=>{$('#menu').classList.add('hidden');showMap()};
$('#new').onclick=()=>{Save.reset();$('#menu').classList.add('hidden');showMap()};
$('#back').onclick=showMap;
/* ---- kontroller ---- */
const keys={},jv={x:0,y:0};
addEventListener('keydown',e=>{keys[e.code]=1;if(e.code==='Space'||e.code==='KeyE')interact()});addEventListener('keyup',e=>keys[e.code]=0);
const joy=$('#joy'),knob=joy.firstElementChild;
function jm(e){const r=joy.getBoundingClientRect(),x=e.clientX-r.left-60,y=e.clientY-r.top-60,l=Math.hypot(x,y)||1,k=Math.min(l,45)/l;jv.x=x*k/45;jv.y=-y*k/45;knob.style.transform=`translate(${x*k}px,${y*k}px)`}
joy.onpointerdown=e=>{joy.setPointerCapture(e.pointerId);jm(e)};joy.onpointermove=e=>{if(e.buttons||e.pointerType==='touch')jm(e)};joy.onpointerup=()=>{jv.x=jv.y=0;knob.style.transform=''};
$('#act').onpointerdown=interact;
function near(){let b=null,d=2.6;inter.forEach(i=>{const k=Math.hypot(i.x-pos.x,i.z-pos.z);if(k<d){d=k;b=i}});return b}
function interact(){if(!zone||!$('#mg').classList.contains('hidden'))return;const n=near();if(n)n.fn();else toast('Yakında etkileşim yok')}
/* ---- döngü ---- */
let last=0;
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.05,(t-last)/1000);last=t;
 if(zone&&$('#mg').classList.contains('hidden')){let ix=jv.x+(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),iy=jv.y+(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
  const l=Math.hypot(ix,iy);if(l>.1){if(l>1){ix/=l;iy/=l}const dx=ix-iy,dz=-ix-iy;pos.x=Math.max(-12,Math.min(12,pos.x+dx*5*dt));pos.z=Math.max(-12,Math.min(12,pos.z+dz*5*dt));player.rotation.y=Math.atan2(dx,dz);player.position.y=Math.abs(Math.sin(t/90))*.08}
  player.position.x=pos.x;player.position.z=pos.z;dog.position.lerp(new THREE.Vector3(pos.x-1,0,pos.z+.8),.06);
  if(state.fish)state.fish.forEach((f,i)=>{f.position.x=Math.cos(t/1500+i*1.1)*(3+i*.5);f.position.z=Math.sin(t/1200+i*1.7)*2.5});
  const n=near();$('#act').style.transform=n?'scale(1.15)':'';inter.forEach(i=>{if(i.m)i.m.position.y=.5+Math.sin(t/300)*.1});
  cam.position.set(pos.x+14,pos.z*0+13,pos.z+14);cam.lookAt(pos.x,0,pos.z)}
 R.render(scene,cam)}
Save.load();if(!Save.d.seals.length)$('#cont').disabled=false;
cam.position.set(14,13,14);cam.lookAt(0,0,0);size();requestAnimationFrame(loop);
