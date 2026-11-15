import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const materialColors = { birch: 0xd7b887, oak: 0xaa7c4e, walnut: 0x3f2b24, cinemaOak: 0x72513a, black: 0x282b29, fabric: 0xc8b9a3, burgundy: 0x4b2028, linenWall: 0xd8d0c3, sageWall: 0x87938a, taupeWall: 0x8c7d70, cinemaWall: 0x252a30, screen: 0x24343d, white: 0xe8e7e2 };
const materialLabels = { birch: '자작 합판', oak: '오크', walnut: '월넛', cinemaOak: '스모크드 오크', black: '블랙 코팅', fabric: '베이지 쿠션', burgundy: '버건디 패브릭', linenWall: '리넨 반투명 벽', sageWall: '세이지 반투명 벽', taupeWall: '토프 반투명 벽', cinemaWall: '차콜 반투명 벽', screen: '모니터 화면', white: '화이트 기기' };
const presets = {
  floor: { name: '바닥 판', size: [1200, 18, 900], pos: [0, 40, 0] },
  wall: { name: '세로 칸막이', size: [18, 700, 900], pos: [-450, 370, 0] },
  shelf: { name: '선반', size: [900, 18, 350], pos: [0, 650, 250] },
  bench: { name: '벤치 상판', size: [1100, 24, 550], pos: [0, 430, -350] }
};
const state = {
  cargo: { width: 1565, height: 1520, length: 2255, wheelhouseWidth: 1330 }, unitCost: 65000,
  objects: [], selectedId: null, shell: true, grid: true, person: true, storageOpen: false, layoutVersion: 0,
  personPose: {position:[0,0,0],rotationY:0,rightElbowToCabinet:false}
};
let renderer, scene, camera, controls, raycaster, pointer, cargoGroup, grid, selectionBox, personGroup;
const meshes = new Map();

function uid(){ return `panel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function saveLocal(){ localStorage.setItem('pv5-wood-studio', JSON.stringify(state)); $('saveState').innerHTML='<i></i> 이 브라우저에 자동 저장됨'; }
function loadLocal(){ try { const raw=localStorage.getItem('pv5-wood-studio'); if(raw) Object.assign(state, JSON.parse(raw)); state.cargo.wheelhouseWidth=Number(state.cargo.wheelhouseWidth)||1330; if(typeof state.person!=='boolean')state.person=true; if(typeof state.storageOpen!=='boolean')state.storageOpen=false; if(!state.personPose)state.personPose={position:[0,0,0],rotationY:0}; } catch(e){ console.warn('저장된 설계를 불러오지 못했습니다.', e); } }
function formatWon(v){ return `${Math.round(v).toLocaleString('ko-KR')}원`; }
function areaOf(o){ const s=o.size; const dims=[s[0]*s[1],s[0]*s[2],s[1]*s[2]].sort((a,b)=>b-a); return dims[0]/1e6; }

function initThree(){
  const canvas=$('scene'); scene=new THREE.Scene(); scene.background=new THREE.Color(0xe8eae4);
  scene.fog=new THREE.Fog(0xe8eae4,4.5,9);
  camera=new THREE.PerspectiveCamera(38,1,.01,30); camera.position.set(3.2,2.7,4.2);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  controls=new OrbitControls(camera,canvas); controls.target.set(0,.65,0); controls.enableDamping=true; controls.dampingFactor=.08; controls.minDistance=2.2; controls.maxDistance=8; controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.HemisphereLight(0xf5f0df,0x77837c,2.1));
  const key=new THREE.DirectionalLight(0xfff3d2,2.4); key.position.set(-3,5,4); key.castShadow=true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4; scene.add(key);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({color:0xdfe2dc,roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.02; floor.receiveShadow=true; scene.add(floor);
  raycaster=new THREE.Raycaster(); pointer=new THREE.Vector2(); selectionBox=new THREE.BoxHelper(undefined,0xd4954c); selectionBox.visible=false; scene.add(selectionBox);
  buildPerson(); rebuildCargo(); rebuildObjects(); updatePerson(); resize(); window.addEventListener('resize',resize); canvas.addEventListener('pointerdown',pickObject); animate(); setTimeout(()=>$('loading').classList.add('hide'),500);
}

function rebuildCargo(){
  if(cargoGroup) scene.remove(cargoGroup); cargoGroup=new THREE.Group(); cargoGroup.visible=state.shell;
  const w=state.cargo.width/1000,h=state.cargo.height/1000,l=state.cargo.length/1000;
  const shellMat=new THREE.MeshPhysicalMaterial({color:0xaab3ad,transparent:true,opacity:.13,roughness:.85,side:THREE.DoubleSide,depthWrite:false});
  const edgeMat=new THREE.LineBasicMaterial({color:0x68756d,transparent:true,opacity:.65});
  const boxGeo=new THREE.BoxGeometry(w,h,l); const shell=new THREE.Mesh(boxGeo,shellMat); shell.position.y=h/2; shell.renderOrder=0; cargoGroup.add(shell);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo),edgeMat); edges.position.y=h/2; cargoGroup.add(edges);
  const interiorMat=new THREE.MeshStandardMaterial({color:0x7f8983,roughness:.88,metalness:.08});
  const deckMat=new THREE.MeshStandardMaterial({color:0xa87543,roughness:.72});
  const caulkMat=new THREE.MeshStandardMaterial({color:0x2f332f,roughness:.9});
  // 실차 형상처럼 낮은 전후 받침부와 타원형 휠 아치가 한 몸으로 이어지도록 만든다.
  const clearWheelhouseWidth=Math.min(w-.02,(state.cargo.wheelhouseWidth||1330)/1000);
  const wheelhouseDepth=Math.max(.05,(w-clearWheelhouseWidth)/2);
  const wheelhouseX=w/2-wheelhouseDepth/2;
  const lowPlinthDepth=Math.max(wheelhouseDepth,.28);
  const wheelhouseShape=new THREE.Shape();
  const baseHalfLength=.58,archHalfLength=.40;
  const shoulderHeight=.13,archRise=.19;
  wheelhouseShape.moveTo(-archHalfLength,shoulderHeight);
  for(let i=0;i<=16;i++){
    const t=Math.PI-i*Math.PI/16;
    wheelhouseShape.lineTo(Math.cos(t)*archHalfLength,shoulderHeight+Math.sin(t)*archRise);
  }
  wheelhouseShape.lineTo(-archHalfLength,shoulderHeight);
  wheelhouseShape.closePath();
  const wheelhouseGeo=new THREE.ExtrudeGeometry(wheelhouseShape,{depth:wheelhouseDepth,bevelEnabled:false,curveSegments:12});
  wheelhouseGeo.translate(0,0,-wheelhouseDepth/2);
  const wheelhouseEdgeMat=new THREE.LineBasicMaterial({color:0x505955,transparent:true,opacity:.55});
  for(const x of [-wheelhouseX,wheelhouseX]){
    const plinth=new THREE.Mesh(new THREE.BoxGeometry(lowPlinthDepth,shoulderHeight,baseHalfLength*2),interiorMat);
    plinth.position.set(Math.sign(x)*(w/2-lowPlinthDepth/2),.015+shoulderHeight/2,l*.22);
    plinth.castShadow=true;
    plinth.receiveShadow=true;
    cargoGroup.add(plinth);
    const plinthEdges=new THREE.LineSegments(new THREE.EdgesGeometry(plinth.geometry),wheelhouseEdgeMat);
    plinthEdges.position.copy(plinth.position);
    cargoGroup.add(plinthEdges);
    const wheelhouse=new THREE.Mesh(wheelhouseGeo,interiorMat);
    wheelhouse.rotation.y=Math.PI/2;
    wheelhouse.position.set(x,.015,l*.22);
    wheelhouse.castShadow=true;
    wheelhouse.receiveShadow=true;
    cargoGroup.add(wheelhouse);
    const wheelhouseEdges=new THREE.LineSegments(new THREE.EdgesGeometry(wheelhouseGeo,28),wheelhouseEdgeMat);
    wheelhouseEdges.rotation.copy(wheelhouse.rotation);
    wheelhouseEdges.position.copy(wheelhouse.position);
    cargoGroup.add(wheelhouseEdges);
  }
  // 후면 개구부는 실차처럼 상단이 둥글고 하단 모서리가 안쪽으로 좁아지는 문틀로 표현한다.
  const rearOpeningHalf=Math.min((w-.08)/2,.685);
  const rearOpeningBottomHalf=Math.min(rearOpeningHalf-.20,.46);
  const rearOpeningBottom=.035;
  const rearOpeningTop=Math.min(h-.06,1.45);
  const rearOpening=new THREE.Path();
  rearOpening.moveTo(-rearOpeningBottomHalf,rearOpeningBottom);
  rearOpening.bezierCurveTo(-.50,rearOpeningBottom,-.55,.12,-.58,.24);
  rearOpening.bezierCurveTo(-.61,.35,-rearOpeningHalf,.43,-rearOpeningHalf,.56);
  rearOpening.lineTo(-rearOpeningHalf,rearOpeningTop-.16);
  rearOpening.quadraticCurveTo(-rearOpeningHalf,rearOpeningTop,-rearOpeningHalf+.16,rearOpeningTop);
  rearOpening.lineTo(rearOpeningHalf-.16,rearOpeningTop);
  rearOpening.quadraticCurveTo(rearOpeningHalf,rearOpeningTop,rearOpeningHalf,rearOpeningTop-.16);
  rearOpening.lineTo(rearOpeningHalf,.56);
  rearOpening.bezierCurveTo(rearOpeningHalf,.43,.61,.35,.58,.24);
  rearOpening.bezierCurveTo(.55,.12,.50,rearOpeningBottom,rearOpeningBottomHalf,rearOpeningBottom);
  rearOpening.lineTo(-rearOpeningBottomHalf,rearOpeningBottom);
  rearOpening.closePath();
  const rearContourPoints=rearOpening.getSpacedPoints(120).map(point=>new THREE.Vector3(point.x,point.y,0));
  const rearContourCurve=new THREE.CatmullRomCurve3(rearContourPoints,true,'centripetal');
  const rearFrameGeo=new THREE.TubeGeometry(rearContourCurve,160,.014,8,true);
  const rearFrameMat=new THREE.MeshStandardMaterial({color:0x58625d,roughness:.84,metalness:.06,transparent:true,opacity:.86});
  const rearFrame=new THREE.Mesh(rearFrameGeo,rearFrameMat);
  rearFrame.position.set(0,0,l/2-.018);
  rearFrame.castShadow=true;
  cargoGroup.add(rearFrame);
  // 카고 바닥의 세로 골은 가구 간섭을 확인할 수 있을 정도만 표현한다.
  const matLength=Math.min(l-.05,2.16);
  const matWideHalf=Math.min(w/2-.03,.68);
  const matRearHalf=Math.min(matWideHalf,.46);
  const matFront=-matLength/2;
  const matRear=matLength/2;
  const matTransition=.06;
  const matShape=new THREE.Shape();
  matShape.moveTo(-matWideHalf,matFront);
  matShape.lineTo(matWideHalf,matFront);
  matShape.lineTo(matWideHalf,matTransition-.14);
  matShape.lineTo(matWideHalf-.03,matTransition-.08);
  matShape.lineTo(matRearHalf+.06,matTransition-.08);
  matShape.lineTo(matRearHalf+.06,matTransition-.02);
  matShape.lineTo(matRearHalf,matTransition+.02);
  matShape.lineTo(matRearHalf,matRear);
  matShape.lineTo(-matRearHalf,matRear);
  matShape.lineTo(-matRearHalf,matTransition+.02);
  matShape.lineTo(-matRearHalf-.06,matTransition-.02);
  matShape.lineTo(-matRearHalf-.06,matTransition-.08);
  matShape.lineTo(-matWideHalf+.03,matTransition-.08);
  matShape.lineTo(-matWideHalf,matTransition-.14);
  matShape.closePath();
  const deckGeo=new THREE.ExtrudeGeometry(matShape,{depth:.025,bevelEnabled:false});
  deckGeo.translate(0,0,-.0125);
  deckGeo.rotateX(Math.PI/2);
  const deck=new THREE.Mesh(deckGeo,deckMat); deck.position.y=.013; deck.receiveShadow=true; cargoGroup.add(deck);
  for(let x=-matWideHalf+.12;x<matWideHalf-.05;x+=.14){
    const seamRear=Math.abs(x)<=matRearHalf-.01?matRear-.02:matTransition-.10;
    const seamLength=seamRear-(matFront+.02);
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.009,.005,seamLength),caulkMat);
    seam.position.set(x,.028,(matFront+.02+seamRear)/2);
    cargoGroup.add(seam);
  }
  const bulkhead=new THREE.Mesh(new THREE.BoxGeometry(w-.08,.04,.035),interiorMat); bulkhead.rotation.x=Math.PI/2; bulkhead.position.set(0,h*.68,-l/2+.025); cargoGroup.add(bulkhead);
  addCabReference(cargoGroup,w,h,l);
  scene.add(cargoGroup);
  if(grid) scene.remove(grid); grid=new THREE.GridHelper(Math.max(w,l)*1.25,Math.round(Math.max(w,l)*20),0x8c978f,0xc6ccc6); grid.position.y=.032; grid.visible=state.grid; scene.add(grid);
  $('cargoSummary').textContent=`${state.cargo.length.toLocaleString()} × ${state.cargo.width.toLocaleString()} × ${state.cargo.height.toLocaleString()} mm · 휠하우스 ${state.cargo.wheelhouseWidth.toLocaleString()} mm`;
}

function addCabReference(group,w,h,l){
  const cabDepth=.92, cabZ=-l/2-cabDepth/2;
  const cabMat=new THREE.MeshPhysicalMaterial({color:0x8f9993,transparent:true,opacity:.16,roughness:.8,side:THREE.DoubleSide,depthWrite:false});
  const cabGeo=new THREE.BoxGeometry(w*.96,h*.92,cabDepth); const cab=new THREE.Mesh(cabGeo,cabMat); cab.position.set(0,h*.46,cabZ); group.add(cab);
  const cabEdges=new THREE.LineSegments(new THREE.EdgesGeometry(cabGeo),new THREE.LineBasicMaterial({color:0x69766e,transparent:true,opacity:.58})); cabEdges.position.copy(cab.position); group.add(cabEdges);
  const seatMat=new THREE.MeshStandardMaterial({color:0x52685b,roughness:.92});
  const passengerMat=new THREE.MeshStandardMaterial({color:0x747c77,roughness:.92});
  const addSeat=(x,driver)=>{
    const mat=driver?seatMat:passengerMat, z=-l/2-.31;
    const cushion=new THREE.Mesh(new THREE.BoxGeometry(.46,.13,.46),mat); cushion.position.set(x,.45,z); cushion.castShadow=true; group.add(cushion);
    const back=new THREE.Mesh(new THREE.BoxGeometry(.46,.58,.13),mat); back.position.set(x,.74,z+.19); back.rotation.x=-.08; back.castShadow=true; group.add(back);
    if(driver){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.16,.018,10,30),new THREE.MeshStandardMaterial({color:0x202522,roughness:.8})); wheel.position.set(x,.82,-l/2-.70); wheel.rotation.x=.18; group.add(wheel);
      const label=makeLabel('운전석'); label.position.set(x,1.14,z); group.add(label);
    }
  };
  addSeat(-w*.27,true); addSeat(w*.27,false);
  const dashboard=new THREE.Mesh(new THREE.BoxGeometry(w*.82,.18,.16),new THREE.MeshStandardMaterial({color:0x343a36,roughness:.85})); dashboard.position.set(0,.82,-l/2-.82); group.add(dashboard);
}

function makeLabel(text){
  const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=72; const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(23,32,28,.88)'; ctx.roundRect(4,4,248,64,12); ctx.fill(); ctx.fillStyle='#f7f3e8'; ctx.font='600 28px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,36);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false})); sprite.scale.set(.55,.155,1); return sprite;
}

function limbBetween(from,to,radius,material){
  const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to);
  const length=start.distanceTo(end);
  const limb=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*.92,length,14),material);
  limb.position.copy(start).add(end).multiplyScalar(.5);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());
  limb.castShadow=true;
  return limb;
}

function buildPerson(){
  if(personGroup) scene.remove(personGroup);
  personGroup=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xc98f6c,roughness:.82});
  const shirt=new THREE.MeshStandardMaterial({color:0x55796f,roughness:.9});
  const pants=new THREE.MeshStandardMaterial({color:0x36444b,roughness:.92});
  const shoes=new THREE.MeshStandardMaterial({color:0x242927,roughness:.95});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.30,8,16),shirt); torso.position.set(0,.82,0); torso.castShadow=true; personGroup.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.12,24,18),skin); head.position.set(0,1.17,.015); head.castShadow=true; personGroup.add(head);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.055,.06,.09,14),skin); neck.position.set(0,1.04,.01); personGroup.add(neck);
  const pelvis=new THREE.Mesh(new THREE.BoxGeometry(.32,.16,.22),pants); pelvis.position.set(0,.50,0); pelvis.castShadow=true; personGroup.add(pelvis);
  for(const side of [-1,1]){
    const elbowX=side===-1&&state.personPose?.rightElbowToCabinet?side*.31:side*.23;
    personGroup.add(limbBetween([side*.11,.50,.03],[side*.12,.44,.34],.07,pants));
    personGroup.add(limbBetween([side*.12,.44,.34],[side*.12,.23,.36],.06,pants));
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.14,.075,.25),shoes); foot.position.set(side*.12,.1575,.45); foot.castShadow=true; personGroup.add(foot);
    personGroup.add(limbBetween([side*.15,.93,.015],[elbowX,.73,.17],.047,shirt));
    personGroup.add(limbBetween([elbowX,.73,.17],[side*.17,.67,.34],.04,skin));
  }
  const label=makeLabel('인체 배치'); label.position.set(0,1.43,0); label.scale.set(.48,.11,1); personGroup.add(label);
  scene.add(personGroup);
}

function updatePerson(){
  if(!personGroup)return;
  const pose=state.personPose||{position:[0,0,0],rotationY:0};
  personGroup.position.set(...pose.position.map(v=>v/1000));
  personGroup.rotation.set(0,THREE.MathUtils.degToRad(pose.rotationY||0),0);
  personGroup.visible=state.person&&!state.storageOpen;
}

function setPersonPose(position,rotationY,rightElbowToCabinet=false){
  state.personPose={position,rotationY,rightElbowToCabinet};
  buildPerson();
  updatePerson();
}

function panelMaterial(kind,opacity=1){ return new THREE.MeshStandardMaterial({color:materialColors[kind]||materialColors.birch,roughness:(kind==='fabric'||kind==='burgundy')?.92:.62,metalness:0,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:THREE.DoubleSide}); }
function geometryFor(obj){
  if(obj.shape==='rounded-opening'||obj.shape==='double-rounded-opening'){
    const width=obj.size[0]/1000;
    const height=obj.size[1]/1000;
    const depth=obj.size[2]/1000;
    const inset=(obj.inset||30)/1000;
    const radius=(obj.radius||30)/1000;
    const shape=new THREE.Shape();
    shape.moveTo(-width/2,-height/2);
    shape.lineTo(width/2,-height/2);
    shape.lineTo(width/2,height/2);
    shape.lineTo(-width/2,height/2);
    shape.closePath();
    const left=-width/2+inset;
    const right=width/2-inset;
    const bottom=-height/2+inset;
    const top=height/2-inset;
    const addRoundedHole=(holeBottom,holeTop)=>{
      const holeRadius=Math.min(radius,(right-left)/2,(holeTop-holeBottom)/2);
      const hole=new THREE.Path();
      hole.moveTo(left+holeRadius,holeBottom);
      hole.lineTo(right-holeRadius,holeBottom);
      hole.quadraticCurveTo(right,holeBottom,right,holeBottom+holeRadius);
      hole.lineTo(right,holeTop-holeRadius);
      hole.quadraticCurveTo(right,holeTop,right-holeRadius,holeTop);
      hole.lineTo(left+holeRadius,holeTop);
      hole.quadraticCurveTo(left,holeTop,left,holeTop-holeRadius);
      hole.lineTo(left,holeBottom+holeRadius);
      hole.quadraticCurveTo(left,holeBottom,left+holeRadius,holeBottom);
      shape.holes.push(hole);
    };
    if(obj.shape==='double-rounded-opening'){
      const centerGap=(obj.centerGap||36)/1000;
      addRoundedHole(bottom,-centerGap/2);
      addRoundedHole(centerGap/2,top);
    }else addRoundedHole(bottom,top);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});
    geometry.translate(0,0,-depth/2);
    geometry.computeVertexNormals();
    return geometry;
  }
  if(obj.shape==='beanbag'){
    const width=obj.size[0]/1000;
    const height=obj.size[1]/1000;
    const depth=obj.size[2]/1000;
    const profile=new THREE.Shape();
    profile.moveTo(-depth*.46,-height*.43);
    profile.bezierCurveTo(-depth*.54,-height*.10,-depth*.44,height*.30,-depth*.22,height*.49);
    profile.bezierCurveTo(-depth*.10,height*.40,-depth*.02,height*.12,depth*.09,-height*.04);
    profile.bezierCurveTo(depth*.20,-height*.15,depth*.40,-height*.08,depth*.48,height*.01);
    profile.bezierCurveTo(depth*.55,-height*.10,depth*.52,-height*.34,depth*.39,-height*.42);
    profile.bezierCurveTo(depth*.15,-height*.49,-depth*.20,-height*.50,-depth*.46,-height*.43);
    profile.closePath();
    const bevel=Math.min(width,height,depth)*.045;
    const geometry=new THREE.ExtrudeGeometry(profile,{depth:width,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:5,curveSegments:20,steps:1});
    geometry.translate(0,0,-width/2);
    geometry.rotateY(Math.PI/2);
    geometry.computeVertexNormals();
    return geometry;
  }
  if(obj.shape==='wedge'){
    const width=obj.size[0]/1000;
    const height=obj.size[1]/1000;
    const depth=obj.size[2]/1000;
    const profile=new THREE.Shape();
    profile.moveTo(-width/2,-height/2);
    profile.lineTo(width/2,-height/2);
    profile.bezierCurveTo(width*.48,-height*.12,width*.32,height*.12,width*.16,height*.24);
    profile.bezierCurveTo(width*.02,height*.36,-width*.18,height*.45,-width/2,height/2);
    profile.closePath();
    const geometry=new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false,curveSegments:12});
    geometry.translate(0,0,-depth/2);
    geometry.computeVertexNormals();
    return geometry;
  }
  return new THREE.BoxGeometry(obj.size[0]/1000,obj.size[1]/1000,obj.size[2]/1000);
}
function makeMesh(obj){
  const geo=geometryFor(obj); const mesh=new THREE.Mesh(geo,panelMaterial(obj.material,obj.opacity??1)); mesh.castShadow=(obj.opacity??1)>=.5; mesh.receiveShadow=true; mesh.userData.id=obj.id;
  const pos=state.storageOpen&&obj.openPos?obj.openPos:obj.pos;
  const rot=state.storageOpen&&obj.openRot?obj.openRot:obj.rot;
  mesh.position.set(pos[0]/1000,pos[1]/1000,pos[2]/1000); mesh.rotation.set(...rot.map(THREE.MathUtils.degToRad));
  mesh.visible=!(state.storageOpen&&obj.hideWhenStorageOpen)&&!(!state.storageOpen&&obj.showOnlyWhenStorageOpen)&&!(state.storageOpen&&obj.material==='fabric');
  scene.add(mesh); meshes.set(obj.id,mesh); return mesh;
}
function rebuildObjects(){ meshes.forEach(m=>scene.remove(m)); meshes.clear(); state.objects.forEach(makeMesh); renderObjectList(); selectObject(state.selectedId,false); updateSummary(); }
function syncMesh(obj){ const old=meshes.get(obj.id); if(old){scene.remove(old);meshes.delete(obj.id);} makeMesh(obj); selectObject(obj.id,false); updateSummary(); renderObjectList(); saveLocal(); }

function addObject(type){ const p=presets[type]; const count=state.objects.filter(o=>o.name.startsWith(p.name)).length+1; const obj={id:uid(),name:`${p.name} ${count}`,size:[...p.size],pos:[...p.pos],rot:[0,0,0],material:'birch'}; state.objects.push(obj); makeMesh(obj); renderObjectList(); selectObject(obj.id); updateSummary(); saveLocal(); }
function selectObject(id,save=true){ state.selectedId=state.objects.some(o=>o.id===id)?id:null; const obj=selected(); document.querySelectorAll('.object-item').forEach(el=>el.classList.toggle('active',el.dataset.id===state.selectedId)); if(obj){ $('emptyInspector').classList.add('hidden');$('inspector').classList.remove('hidden'); fillInspector(obj); const mesh=meshes.get(obj.id); selectionBox.setFromObject(mesh);selectionBox.visible=mesh.visible; checkBounds(obj); }else{$('emptyInspector').classList.remove('hidden');$('inspector').classList.add('hidden');selectionBox.visible=false;$('boundaryWarning').classList.remove('show');} if(save)saveLocal(); }
function selected(){ return state.objects.find(o=>o.id===state.selectedId); }
function deleteSelected(){ if(!state.selectedId)return; const mesh=meshes.get(state.selectedId);if(mesh)scene.remove(mesh);meshes.delete(state.selectedId);state.objects=state.objects.filter(o=>o.id!==state.selectedId);state.selectedId=null;renderObjectList();selectObject(null);updateSummary();saveLocal(); }
function duplicateSelected(){ const o=selected();if(!o)return;const c=structuredClone(o);c.id=uid();c.name=`${o.name} 복사`;c.pos[0]+=50;c.pos[2]+=50;state.objects.push(c);makeMesh(c);renderObjectList();selectObject(c.id);updateSummary();saveLocal(); }

function renderObjectList(){
  const list=$('objectList'); $('pieceCount').textContent=`${state.objects.length}개`;
  if(!state.objects.length){list.innerHTML='<div class="empty-list">아직 설치한 판재가 없습니다.</div>';return;}
  list.innerHTML=state.objects.map(o=>`<div class="object-item ${o.id===state.selectedId?'active':''}" data-id="${o.id}"><i style="background:#${materialColors[o.material].toString(16).padStart(6,'0')}"></i><span><b>${escapeHtml(o.name)}</b><small>${o.size.join(' × ')} mm</small></span><em>›</em></div>`).join('');
  list.querySelectorAll('.object-item').forEach(el=>el.addEventListener('click',()=>selectObject(el.dataset.id)));
}
function escapeHtml(v){ const d=document.createElement('div');d.textContent=v;return d.innerHTML; }
function fillInspector(o){
  $('propName').value=o.name; ['sizeX','sizeY','sizeZ'].forEach((id,i)=>$(id).value=o.size[i]); ['posX','posY','posZ'].forEach((id,i)=>$(id).value=o.pos[i]);
  document.querySelectorAll('.swatches button').forEach(b=>b.classList.toggle('active',b.dataset.material===o.material)); $('materialName').textContent=materialLabels[o.material]; const a=areaOf(o);$('selectedArea').textContent=`${a.toFixed(2)} m²`;$('selectedCost').textContent=formatWon(a*state.unitCost);
}
function updateFromInspector(){ const o=selected();if(!o)return;o.name=$('propName').value.trim()||'이름 없는 판재';o.size=[$('sizeX'),$('sizeY'),$('sizeZ')].map(e=>Math.max(18,Number(e.value)||18));o.pos=[$('posX'),$('posY'),$('posZ')].map(e=>Number(e.value)||0);syncMesh(o); }
function checkBounds(o){ const half=[state.cargo.width/2,state.cargo.height,state.cargo.length/2]; const x=Math.abs(o.pos[0])+o.size[0]/2>half[0], y=o.pos[1]-o.size[1]/2<0||o.pos[1]+o.size[1]/2>half[1], z=Math.abs(o.pos[2])+o.size[2]/2>half[2]; $('boundaryWarning').classList.toggle('show',x||y||z); }
function updateSummary(){ const area=state.objects.reduce((s,o)=>s+areaOf(o),0);$('areaSummary').textContent=`${area.toFixed(2)} m²`;$('costSummary').textContent=formatWon(area*state.unitCost);const o=selected();if(o)fillInspector(o); }

function pickObject(ev){ if(ev.button!==0)return; const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...meshes.values()],false);if(hits.length)selectObject(hits[0].object.userData.id); }
function setView(name){ const target=controls.target; const views={perspective:[3.2,2.7,4.2],top:[0,5.6,.001],side:[4.8,1.1,.001],rear:[.001,1.2,5]};camera.position.set(...views[name]);controls.target.set(0,.65,0);camera.up.set(0,1,0);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name)); }
function resize(){ const el=$('viewer'); const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix(); }
function animate(){ requestAnimationFrame(animate);controls.update();if(selectionBox.visible)selectionBox.update();renderer.render(scene,camera); }

function sideDeskDevices(desk,deskInnerX){
  const monitorZ=desk.pos[2]-desk.size[2]/2+350;
  const monitorX=deskInnerX+462.5;
  const monitorY=935;
  const laptopZ=desk.pos[2]+desk.size[2]/2-240;
  const laptopX=deskInnerX+477.5;
  const armPoleX=state.cargo.width/2-47.5;
  const armPlateX=monitorX+31;
  const armLength=armPoleX-(armPlateX+15);
  const armX=armPlateX+15+armLength/2;
  const devices=[
    {id:uid(),name:'책상 왼쪽 27인치 모니터 본체 · 620 × 380mm',size:[32,380,620],pos:[monitorX,monitorY,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'27인치 모니터 화면 · 좌측 좌석 방향',size:[5,350,590],pos:[monitorX-18.5,monitorY,monitorZ],rot:[0,0,0],material:'screen'},
    {id:uid(),name:'모니터암 VESA 결합판',size:[30,110,110],pos:[armPlateX,monitorY,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수평 관절',size:[armLength,30,30],pos:[armX,940,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수직 기둥',size:[35,255,35],pos:[armPoleX,812.5,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 책상 클램프',size:[80,35,90],pos:[armPoleX,667.5,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'책상 오른쪽 노트북 스탠드 받침',size:[250,20,300],pos:[laptopX,670,laptopZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'노트북 스탠드 높이 지지대',size:[30,150,80],pos:[laptopX+80,745,laptopZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'스탠드 위 15인치 노트북 본체',size:[24,230,340],pos:[laptopX+40,815,laptopZ],rot:[0,0,-12],material:'black'},
    {id:uid(),name:'노트북 화면 · 좌측 좌석 방향',size:[5,205,315],pos:[laptopX+25,815,laptopZ],rot:[0,0,-12],material:'screen'}
  ];
  devices.forEach(device=>{device.pos[1]+=10;});
  return devices;
}

function rearDeskDevices(desk){
  const monitorX=-desk.size[0]/4;
  const monitorZ=desk.pos[2]+70;
  const monitorY=935;
  const armPoleZ=desk.pos[2]+desk.size[2]/2-47.5;
  const armPlateZ=monitorZ+31;
  const armLength=armPoleZ-(armPlateZ+15);
  const armZ=armPlateZ+15+armLength/2;
  const laptopX=desk.size[0]/4;
  const laptopZ=desk.pos[2]-50;
  const devices=[
    {id:uid(),name:'책상 왼쪽 27인치 모니터 본체 · 620 × 380mm',size:[620,380,32],pos:[monitorX,monitorY,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'27인치 모니터 화면 · 침상 좌석 방향',size:[590,350,5],pos:[monitorX,monitorY,monitorZ-18.5],rot:[0,0,0],material:'screen'},
    {id:uid(),name:'모니터암 VESA 결합판',size:[110,110,30],pos:[monitorX,monitorY,armPlateZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수평 관절',size:[30,30,armLength],pos:[monitorX,940,armZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수직 기둥',size:[35,255,35],pos:[monitorX,812.5,armPoleZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 책상 클램프',size:[90,35,80],pos:[monitorX,667.5,armPoleZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'책상 오른쪽 노트북 스탠드 받침',size:[300,20,250],pos:[laptopX,670,laptopZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'노트북 스탠드 높이 지지대',size:[80,150,30],pos:[laptopX,745,laptopZ+80],rot:[0,0,0],material:'black'},
    {id:uid(),name:'스탠드 위 15인치 노트북 본체',size:[340,230,24],pos:[laptopX,815,laptopZ+40],rot:[-12,0,0],material:'black'},
    {id:uid(),name:'노트북 화면 · 침상 좌석 방향',size:[315,205,5],pos:[laptopX,815,laptopZ+25],rot:[-12,0,0],material:'screen'}
  ];
  devices.forEach(device=>{device.pos[1]+=10;});
  return devices;
}

function sideWallObjects(material,opacity,label){
  const wallDepth=state.cargo.length-80;
  const wallHeight=state.cargo.height-40;
  return [
    {id:uid(),name:`${label} 왼쪽 반투명 벽`,size:[24,wallHeight,wallDepth],pos:[-state.cargo.width/2+12,wallHeight/2,0],rot:[0,0,0],material,opacity},
    {id:uid(),name:`${label} 오른쪽 반투명 벽`,size:[24,wallHeight,wallDepth],pos:[state.cargo.width/2-12,wallHeight/2,0],rot:[0,0,0],material,opacity}
  ];
}

function loadPlan1(){
  const rear=state.cargo.length/2;
  const deskWidth=state.cargo.width-100;
  const deskDepth=700;
  const deskZ=rear-40-deskDepth/2;
  const deskInnerEdge=deskZ-deskDepth/2;
  const bedRearEdge=deskInnerEdge+100;
  const bedFrontEdge=-rear;
  const bedLength=bedRearEdge-bedFrontEdge;
  const bedZ=(bedRearEdge+bedFrontEdge)/2;
  const rightAccessWidth=500;
  const bedWidth=state.cargo.width-rightAccessWidth;
  const bedX=-rightAccessWidth/2;
  state.layoutName='1안 · 후면 책상 + 우측 500mm 통로';
  state.objects=[
    {id:uid(),name:'후면 전체 폭 책상 상판 · 깊이 700mm · 높이 650mm',size:[deskWidth,30,deskDepth],pos:[0,635,deskZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'책상 왼쪽 긴 측판 지지대',size:[60,595,600],pos:[-deskWidth/2+30,322.5,deskZ+50],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'책상 오른쪽 긴 측판 지지대',size:[60,595,600],pos:[deskWidth/2-30,322.5,deskZ+50],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'우측 출입폭 500mm 확보 침상 상판 · 상단 340mm',size:[bedWidth,30,bedLength],pos:[bedX,325,bedZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'우측 출입폭 500mm 확보 침상 쿠션 · 높이 400mm',size:[bedWidth,60,bedLength],pos:[bedX,370,bedZ],rot:[0,0,0],material:'fabric'},
    {id:uid(),name:'침상 중앙 세로 지지판',size:[30,285,bedLength-40],pos:[0,167.5,bedZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'침상 앞쪽 바닥 지지판',size:[bedWidth,285,30],pos:[bedX,167.5,bedFrontEdge+15],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'침상 뒤쪽 바닥 지지판',size:[bedWidth,285,30],pos:[bedX,167.5,bedRearEdge-15],rot:[0,0,0],material:'oak'}
  ];
  state.objects[0].pos[1]+=10;
  [1,2].forEach(i=>{state.objects[i].size[1]+=10;state.objects[i].pos[1]+=5;});
  [3,4].forEach(i=>{state.objects[i].pos[1]+=10;});
  [5,6,7].forEach(i=>{state.objects[i].size[1]+=10;state.objects[i].pos[1]+=5;});
  state.objects[0].name='후면 책상 상판 · 깊이 700mm · 높이 660mm';
  state.objects[3].name='침상 프레임 상판 높이 350mm';
  state.objects[4].name='침상 쿠션 포함 좌면 높이 410mm';
  state.objects[6].name='침상 운전석 방향 전체 폭 고정 마감판 · 상부 인출 전용';
  state.objects[6].size[1]=320;
  state.objects[6].pos[1]=160;
  state.objects.push(...rearDeskDevices(state.objects[0]));
  state.objects.push(...sideWallObjects('linenWall',.24,'1안 리넨'));
  setPersonPose([-deskWidth/4,10,deskInnerEdge-330],0);
  state.selectedId=state.objects.find(o=>o.name.startsWith('책상 왼쪽 27인치')).id;
  rebuildObjects();saveLocal();
}
function loadPlan2(includeDevices=true){
  const rear=state.cargo.length/2;
  const doorOpening=775;
  const doorFront=-rear+180;
  const doorRear=doorFront+doorOpening;
  const deskFront=doorRear+50;
  const deskRear=rear-40;
  const deskLength=deskRear-deskFront;
  const deskZ=(deskRear+deskFront)/2;
  const deskDepth=700;
  const deskX=state.cargo.width/2-deskDepth/2;
  const deskInnerX=deskX-deskDepth/2;
  const bedLeft=-state.cargo.width/2;
  const bedRight=deskInnerX+100;
  const bedWidth=bedRight-bedLeft;
  const bedX=(bedRight+bedLeft)/2;
  const bedLength=1900;
  const bedRear=rear;
  const bedFront=bedRear-bedLength;
  const bedZ=(bedRear+bedFront)/2;
  const legClearance=150;
  const supportLeft=bedRight+legClearance;
  const supportWidth=state.cargo.width/2-supportLeft;
  const supportX=(state.cargo.width/2+supportLeft)/2;
  state.layoutName='2안 · 우측 책상 + 종방향 침상';
  state.objects=[
    {id:uid(),name:'우측 장형 책상 · 깊이 700mm · 높이 650mm',size:[deskDepth,30,deskLength],pos:[deskX,635,deskZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'왼쪽 150mm 다리 공간을 비운 책상 앞 지지판',size:[supportWidth,595,60],pos:[supportX,322.5,deskFront+30],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'왼쪽 150mm 다리 공간을 비운 책상 뒤 지지판',size:[supportWidth,595,60],pos:[supportX,322.5,deskRear-30],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 고정 1,900mm 침상 · 책상과 100mm 겹침',size:[bedWidth,30,bedLength],pos:[bedX,325,bedZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'1,900mm 침상 쿠션 · 앉는 높이 400mm',size:[bedWidth,60,bedLength],pos:[bedX,370,bedZ],rot:[0,0,0],material:'fabric'},
    {id:uid(),name:'왼쪽 벽 세움 쿠션 · 500 × 550 × 330mm',size:[330,550,500],pos:[-state.cargo.width/2+165,675,deskZ],rot:[0,0,0],material:'fabric',shape:'wedge'},
    {id:uid(),name:'침상 중앙 종방향 지지판',size:[30,285,bedLength-40],pos:[bedX,167.5,bedZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'침상 격벽 쪽 바닥 지지판',size:[bedWidth,285,30],pos:[bedX,167.5,bedFront+15],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'침상 트렁크 쪽 바닥 지지판',size:[bedWidth,285,30],pos:[bedX,167.5,bedRear-15],rot:[0,0,0],material:'oak'}
  ];
  state.objects[0].pos[1]+=10;
  [1,2].forEach(i=>{state.objects[i].size[1]+=10;state.objects[i].pos[1]+=5;});
  [3,4,5].forEach(i=>{state.objects[i].pos[1]+=10;});
  [6,7,8].forEach(i=>{state.objects[i].size[1]+=10;state.objects[i].pos[1]+=5;});
  state.objects[0].name='오른쪽 책상 상판 · 깊이 700mm · 높이 660mm';
  state.objects[3].name='침상 프레임 상판 높이 350mm';
  state.objects[4].name='침상 쿠션 포함 좌면 높이 410mm';
  state.objects[7].name='침상 운전석 방향 전체 폭 고정 마감판 · 상부 인출 전용';
  state.objects[7].size[1]=320;
  state.objects[7].pos[1]=160;
  if(includeDevices!==false) state.objects.push(...sideDeskDevices(state.objects[0],deskInnerX));
  state.objects.push(...sideWallObjects('sageWall',.23,'2안 세이지'));
  setPersonPose([deskInnerX-220,10,state.objects[0].pos[2]-state.objects[0].size[2]/2+350],90);
  state.selectedId=includeDevices!==false?state.objects.find(o=>o.name.startsWith('책상 왼쪽 27인치')).id:state.objects[0].id;
  rebuildObjects();saveLocal();
}
function loadPlan3(){
  loadPlan2(false);
  state.objects.filter(o=>o.material==='sageWall').forEach(o=>{o.material='taupeWall';o.name=o.name.replace('2안 세이지','3안 웜 토프');o.opacity=.24;});
  const rear=state.cargo.length/2;
  const cabinetClearance=50;
  const cabinetWidth=state.cargo.width-cabinetClearance*2;
  const cabinetDepth=400;
  const cabinetRear=rear-40;
  const cabinetFront=cabinetRear-cabinetDepth;
  const cabinetZ=cabinetRear-cabinetDepth/2;
  const deskDepth=700;
  const deskInnerX=state.cargo.width/2-deskDepth;
  const cabinetLeft=-cabinetWidth/2;
  const fillerWidth=deskInnerX-cabinetLeft;
  const fillerX=(cabinetLeft+deskInnerX)/2;
  const doorGap=10;
  const rearDoorSpan=Math.min(cabinetWidth-40,880);
  const doorWidth=Math.floor((rearDoorSpan-doorGap*2)/3);
  const doorStep=doorWidth+doorGap;
  const doorZ=cabinetRear+9;
  const desk=state.objects[0];
  const monitorZ=desk.pos[2]-desk.size[2]/2+350;
  const monitorX=deskInnerX+462.5;
  const monitorY=935;
  const laptopZ=desk.pos[2]+desk.size[2]/2-240;
  const laptopX=deskInnerX+477.5;
  const armPoleX=state.cargo.width/2-47.5;
  const armPlateX=monitorX+31;
  const armLength=armPoleX-(armPlateX+15);
  const armX=armPlateX+15+armLength/2;
  const bedFront=-rear;
  const bedRear=cabinetFront;
  const bedLength=bedRear-bedFront;
  const bedZ=(bedFront+bedRear)/2;
  const bedFrame=state.objects[3];
  const bedCushion=state.objects[4];
  const wallCushion=state.objects[5];
  const bedCenterSupport=state.objects[6];
  const bedFrontSupport=state.objects[7];
  const bedRearSupport=state.objects[8];
  const deskFrontSupport=state.objects[1];
  const deskRearSupport=state.objects[2];
  deskFrontSupport.name='슬라이드도어 쪽 전체 막힘 책상 지지판';
  state.objects=state.objects.filter(o=>o.id!==deskRearSupport.id);
  bedFrame.name=`격벽 고정 최대 ${bedLength.toLocaleString()}mm 침상 · 수납함과 맞닿음`;
  bedFrame.size[2]=bedLength;
  bedFrame.pos[2]=bedZ;
  bedCushion.name=`${bedLength.toLocaleString()}mm 침상 쿠션 · 앉는 높이 400mm`;
  bedCushion.size[2]=bedLength;
  bedCushion.pos[2]=bedZ;
  wallCushion.pos[2]=bedRear-wallCushion.size[2]/2;
  bedCenterSupport.size[2]=bedLength-40;
  bedCenterSupport.pos[2]=bedZ;
  bedFrontSupport.pos[2]=bedFront+15;
  bedRearSupport.pos[2]=bedRear-15;
  desk.name='오른쪽 책상 상판 · 깊이 700mm · 높이 660mm';
  bedFrame.name=`수납 가능한 ${bedLength.toLocaleString()}mm 침상 프레임 · 상판 350mm`;
  bedCushion.name=`${bedLength.toLocaleString()}mm 침상 쿠션 · 좌면 높이 410mm`;
  bedFrame.hideWhenStorageOpen=true;
  bedCushion.hideWhenStorageOpen=true;
  state.storageOpen=false;
  $('toggleStorage').checked=false;
  // Keep the pelvis on the bed edge while placing knees and feet in the open desk bay.
  setPersonPose([deskInnerX-180,10,desk.pos[2]-desk.size[2]/2+500],90,true);
  state.layoutVersion=33;
  state.layoutName='3안 · 2안 + 트렁크 전폭 수납함';
  state.objects.push(
    {id:uid(),name:'트렁크 수납함 바닥판 · 내부가 빈 프레임',size:[cabinetWidth,30,cabinetDepth],pos:[0,15,cabinetZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'트렁크 수납함 왼쪽 측판',size:[30,590,cabinetDepth],pos:[-cabinetWidth/2+15,325,cabinetZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'트렁크 수납함 오른쪽 측판',size:[30,590,cabinetDepth],pos:[cabinetWidth/2-15,325,cabinetZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'트렁크 수납함 왼쪽 칸막이',size:[30,590,cabinetDepth],pos:[-doorStep/2,325,cabinetZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'트렁크 수납함 오른쪽 칸막이',size:[30,590,cabinetDepth],pos:[doorStep/2,325,cabinetZ],rot:[0,0,0],material:'oak'},
    {id:uid(),name:'책상 연결 왼쪽 마감 상판 · 상면 높이 650mm',size:[fillerWidth,30,cabinetDepth],pos:[fillerX,635,cabinetZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 수납함 왼쪽 도어',size:[doorWidth,560,18],pos:[-doorStep,310,doorZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 수납함 중앙 도어',size:[doorWidth,560,18],pos:[0,310,doorZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'책상 아래 트렁크 쪽 라운드 관통 프레임',size:[doorWidth,560,20],pos:[doorStep,310,doorZ],rot:[0,0,0],material:'birch',shape:'rounded-opening',inset:30,radius:35},
    {id:uid(),name:'수납함 왼쪽 손잡이',size:[80,18,18],pos:[-doorStep,500,doorZ+18],rot:[0,0,0],material:'black'},
    {id:uid(),name:'수납함 중앙 손잡이',size:[80,18,18],pos:[0,500,doorZ+18],rot:[0,0,0],material:'black'},
    {id:uid(),name:'실내 쪽 왼쪽 양면 수납 도어',size:[doorWidth,560,18],pos:[-doorStep,310,cabinetFront-9],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'실내 쪽 중앙 양면 수납 도어',size:[doorWidth,560,18],pos:[0,310,cabinetFront-9],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'책상 아래 앞뒤 관통 PS5 니치 · 라운드 통풍 개방',size:[doorWidth,560,20],pos:[doorStep,310,cabinetFront-10],rot:[0,0,0],material:'birch',shape:'rounded-opening',inset:30,radius:35},
    {id:uid(),name:'PS5 크기 화이트 콘솔',size:[104,390,260],pos:[doorStep,225,cabinetFront+150],rot:[0,0,0],material:'white'},
    {id:uid(),name:'콘솔 중앙 블랙 통풍부',size:[18,360,270],pos:[doorStep-52,225,cabinetFront+150],rot:[0,0,0],material:'black'},
    {id:uid(),name:'책상 왼쪽 27인치 모니터 본체 · 620 × 380mm',size:[32,380,620],pos:[monitorX,monitorY,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'27인치 모니터 화면 · 좌측 좌석 방향',size:[5,350,590],pos:[monitorX-18.5,monitorY,monitorZ],rot:[0,0,0],material:'screen'},
    {id:uid(),name:'모니터암 VESA 결합판',size:[30,110,110],pos:[armPlateX,monitorY,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수평 관절',size:[armLength,30,30],pos:[armX,940,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 수직 기둥',size:[35,255,35],pos:[armPoleX,812.5,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'모니터암 책상 클램프',size:[80,35,90],pos:[armPoleX,667.5,monitorZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'책상 오른쪽 노트북 스탠드 받침',size:[250,20,300],pos:[laptopX,670,laptopZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'노트북 스탠드 높이 지지대',size:[30,150,80],pos:[laptopX+80,745,laptopZ],rot:[0,0,0],material:'black'},
    {id:uid(),name:'스탠드 위 15인치 노트북 본체',size:[24,230,340],pos:[laptopX+40,815,laptopZ],rot:[0,0,-12],material:'black'},
    {id:uid(),name:'노트북 화면 · 좌측 좌석 방향',size:[5,205,315],pos:[laptopX+25,815,laptopZ],rot:[0,0,-12],material:'screen'},
    {id:uid(),name:'침상 대형 빈백 쿠션 · 사람 방향',size:[600,600,600],pos:[-state.cargo.width/2+355,700,-300],rot:[0,-155,0],material:'fabric',shape:'beanbag'}
  );
  state.objects.filter(o=>o.pos[2]===cabinetZ&&o.size[1]===590&&o.size[2]===cabinetDepth).forEach(panel=>{panel.size[1]=600;panel.pos[1]=330;});
  const cabinetTop=state.objects.find(o=>o.pos[2]===cabinetZ&&o.pos[1]===635&&o.size[1]===30&&o.size[2]===cabinetDepth);
  if(cabinetTop){cabinetTop.pos[1]=645;cabinetTop.name='책상 연결 왼쪽 마감 상판 · 높이 660mm';}
  const reducedBackPanels=state.objects.filter(o=>o.pos[2]<cabinetZ&&o.size[0]===doorWidth&&o.size[1]===560);
  state.objects=state.objects.filter(o=>!reducedBackPanels.includes(o));
  state.objects.push({id:uid(),name:'트렁크 수납장 침상 쪽 전체 폭 고정 뒷판',size:[cabinetWidth,600,18],pos:[0,330,cabinetFront-9],rot:[0,0,0],material:'birch'});
  state.objects.filter(o=>(o.material==='black'||o.material==='screen')&&o.pos[1]>=667.5&&o.size[1]!==18).forEach(device=>{device.pos[1]+=10;});
  state.objects.filter(o=>o.shape==='beanbag').forEach(beanbag=>{beanbag.pos[1]+=10;});
  const rearFixedSideWidth=(cabinetWidth-rearDoorSpan)/2;
  const rearFixedSideX=rearDoorSpan/2+rearFixedSideWidth/2;
  state.objects.push(
    {id:uid(),name:'트렁크 수납장 왼쪽 고정 마감판',size:[rearFixedSideWidth,590,18],pos:[-rearFixedSideX,325,doorZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 수납장 오른쪽 고정 마감판',size:[rearFixedSideWidth,590,18],pos:[rearFixedSideX,325,doorZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 수납장 아래 고정 마감판',size:[rearDoorSpan,10,18],pos:[0,35,doorZ],rot:[0,0,0],material:'birch'},
    {id:uid(),name:'트렁크 수납장 위 고정 마감판',size:[rearDoorSpan,40,18],pos:[0,600,doorZ],rot:[0,0,0],material:'birch'}
  );
  state.objects.filter(o=>o.pos[2]===doorZ&&o.size[0]===rearFixedSideWidth).forEach(panel=>{panel.size[1]=600;panel.pos[1]=330;});
  const rearTopPanel=state.objects.find(o=>o.pos[2]===doorZ&&o.size[0]===rearDoorSpan&&o.size[1]===40);
  if(rearTopPanel)rearTopPanel.pos[1]=610;
  const cabinetDoors=state.objects.filter(o=>o.size[0]===doorWidth&&o.pos[2]===doorZ&&(o.size[2]===18||o.size[2]===20));
  cabinetDoors.forEach(door=>{
    door.size[1]=550;door.pos[1]=315;delete door.shape;
    if(door.pos[0]===doorStep){door.shape='double-rounded-opening';door.centerGap=36;}
  });
  cabinetDoors.forEach(door=>{
    const hingeSide=door.pos[0]<0?-1:1;
    const outward=door.pos[2]>cabinetZ?1:-1;
    const angle=outward*hingeSide*75;
    const hingeX=door.pos[0]+hingeSide*doorWidth/2;
    const centerFromHinge=-hingeSide*doorWidth/2;
    door.openPos=[hingeX+Math.cos(THREE.MathUtils.degToRad(angle))*centerFromHinge,door.pos[1],door.pos[2]-Math.sin(THREE.MathUtils.degToRad(angle))*centerFromHinge];
    door.openRot=[0,angle,0];
  });
  const cabinetHandles=state.objects.filter(o=>o.material==='black'&&o.size[0]===80&&o.size[1]===18&&o.size[2]===18);
  cabinetHandles.forEach(handle=>{
    handle.size=[18,80,18];
    handle.pos[1]=315;
    const door=cabinetDoors.find(item=>item.pos[0]===handle.pos[0]&&item.pos[2]>cabinetZ);
    if(!door)return;
    const angle=door.openRot[1];
    const hingeSide=door.pos[0]<0?-1:1;
    handle.pos[0]=door.pos[0]-hingeSide*(doorWidth/2-35);
    const hingeX=door.pos[0]+hingeSide*doorWidth/2;
    const dx=handle.pos[0]-hingeX;
    const dz=handle.pos[2]-door.pos[2];
    const radians=THREE.MathUtils.degToRad(angle);
    handle.openPos=[hingeX+Math.cos(radians)*dx+Math.sin(radians)*dz,handle.pos[1],door.pos[2]-Math.sin(radians)*dx+Math.cos(radians)*dz];
    handle.openRot=[0,angle,0];
  });
  const ps5=state.objects.find(o=>o.size[0]===104&&o.size[1]===390&&o.size[2]===260);
  if(ps5){
    ps5.name='중간 선반 위에 눕힌 흰색 PS5';
    ps5.size=[390,104,260];
    ps5.pos=[doorStep,397,cabinetZ];
  }
  state.objects=state.objects.filter(o=>!(o.size[0]===18&&o.size[1]===360&&o.size[2]===270));
  [-doorStep,0,doorStep].forEach((x,i)=>state.objects.push({id:uid(),name:`${['왼쪽','가운데','오른쪽'][i]} 수납함 중간 나무 선반`,size:[doorWidth,30,cabinetDepth-30],pos:[x,310,cabinetZ],rot:[0,0,0],material:'oak'}));
  const cabinetShelves=state.objects.filter(o=>o.size[0]===doorWidth&&o.size[1]===30&&o.size[2]===cabinetDepth-30&&o.pos[2]===cabinetZ).sort((a,b)=>a.pos[0]-b.pos[0]);
  const cabinetInnerHalf=cabinetWidth/2-30;
  const sideShelfWidth=cabinetInnerHalf-(doorStep/2+15);
  const sideShelfX=(cabinetInnerHalf+doorStep/2+15)/2;
  const shelfWidths=[sideShelfWidth,doorStep-30,sideShelfWidth];
  const shelfXs=[-sideShelfX,0,sideShelfX];
  cabinetShelves.forEach((shelf,i)=>{shelf.name=`수납장 ${['왼쪽','가운데','오른쪽'][i]} 전체 폭 중간 선반`;shelf.size[0]=shelfWidths[i];shelf.pos[0]=shelfXs[i];shelf.pos[1]=330;});
  const bedLeft=bedFrame.pos[0]-bedFrame.size[0]/2;
  const bayWidth=(bedFrame.size[0]-bedCenterSupport.size[0])/2;
  const crateXs=[bedLeft+bayWidth/2,bedFrame.pos[0]+bedCenterSupport.size[0]/2+bayWidth/2];
  const crateRows=Array.from({length:5},(_,i)=>bedFront+200+i*340);
  const crateObjects=[];
  crateRows.slice(0,3).forEach((z,i)=>crateObjects.push({id:uid(),name:`침상 아래 만타 우유상자 왼쪽 ${i+1} · 23L`,size:[340,270,340],pos:[crateXs[0],135,z],rot:[0,0,0],material:'black',shape:'rounded-opening',inset:35,radius:8}));
  crateRows.forEach((z,i)=>crateObjects.push({id:uid(),name:`침상 아래 만타 우유상자 안쪽 ${i+1} · 23L`,size:[340,270,340],pos:[crateXs[1],135,z],rot:[0,0,0],material:'black',shape:'rounded-opening',inset:35,radius:8}));
  const hatchAngle=70;
  const sideHatchLeft=bedLeft;
  const sideHatchRight=bedFrame.pos[0];
  const hatchWidth=sideHatchRight-sideHatchLeft;
  const sideHatchX=(sideHatchLeft+sideHatchRight)/2;
  const hatchDepth=bedLength;
  const makeSideHatch=(x,width,hingeSide,name)=>{
    const hingeX=x+hingeSide*width/2;
    const centerFromHinge=-hingeSide*width/2;
    const angle=-hingeSide*hatchAngle;
    return {
      id:uid(),name,size:[width,18,hatchDepth],
      pos:[x,359,bedZ],rot:[0,0,0],material:'birch',showOnlyWhenStorageOpen:true,
      openPos:[hingeX+Math.cos(THREE.MathUtils.degToRad(angle))*centerFromHinge,359+Math.sin(THREE.MathUtils.degToRad(angle))*centerFromHinge,bedZ],
      openRot:[0,0,angle]
    };
  };
  const splitGap=0;
  const halfHatchDepth=(hatchDepth-splitGap)/2;
  const centerHatchLeft=bedFrame.pos[0];
  const centerHatchRight=bedFrame.pos[0]+bedFrame.size[0]/2;
  const centerHatchWidth=centerHatchRight-centerHatchLeft;
  const centerHatchX=(centerHatchLeft+centerHatchRight)/2;
  const makeLengthHatch=(z,hingeSide,name)=>{
    const hingeX=centerHatchX+hingeSide*centerHatchWidth/2;
    const centerFromHinge=-hingeSide*centerHatchWidth/2;
    const angle=-hingeSide*hatchAngle;
    return {
      id:uid(),name,size:[centerHatchWidth,18,halfHatchDepth],
      pos:[centerHatchX,359,z],rot:[0,0,0],material:'birch',showOnlyWhenStorageOpen:true,
      openPos:[hingeX+Math.cos(THREE.MathUtils.degToRad(angle))*centerFromHinge,359+Math.sin(THREE.MathUtils.degToRad(angle))*centerFromHinge,z],
      openRot:[0,0,angle]
    };
  };
  const frontHatchZ=bedZ-(halfHatchDepth+splitGap)/2;
  const rearHatchZ=bedZ+(halfHatchDepth+splitGap)/2;
  const hatchObjects=[
    makeSideHatch(sideHatchX,hatchWidth,1,'침상 왼쪽 전체 길이 상판'),
    makeLengthHatch(frontHatchZ,-1,'운전석 뒤 침상 절반 상판'),
    makeLengthHatch(rearHatchZ,1,'사람이 앉는 쪽 침상 절반 상판')
  ];
  crateObjects.forEach(crate=>{crate.size[2]=300;});
  const aislePartition={
    id:uid(),name:'침상 통로쪽 우유박스 가림 칸막이',size:[30,285,bedLength-40],
    pos:[bedFrame.pos[0]+bedFrame.size[0]/2-15,167.5,bedZ],rot:[0,0,0],material:'oak'
  };
  aislePartition.size[1]=295;
  aislePartition.pos[1]=147.5;
  state.objects.push(...crateObjects,aislePartition,...hatchObjects);
  state.objects.filter(o=>o.material==='fabric').forEach(cushion=>{cushion.hideWhenStorageOpen=true;});
  state.selectedId=state.objects.find(o=>o.name.startsWith('책상 왼쪽 27인치')).id;
  rebuildObjects();
  saveLocal();
}

function loadPlan4(){
  loadPlan3();
  const bedFrame=state.objects.find(o=>o.hideWhenStorageOpen&&o.material==='oak');
  const desk=state.objects[0];
  const bedRear=bedFrame.pos[2]+bedFrame.size[2]/2;
  const deskFront=desk.pos[2]-desk.size[2]/2;
  const backrestLength=Math.min(820,bedRear-deskFront-40);
  const backrest={
    id:uid(),name:'책상 맞은편 침상 나무 등받이 · 수직형',
    size:[30,500,backrestLength],
    pos:[bedFrame.pos[0]-bedFrame.size[0]/2+55,660,(bedRear+deskFront)/2],
    rot:[0,0,0],material:'cinemaOak'
  };
  state.objects.forEach(o=>{if(o.material==='birch'||o.material==='oak')o.material='cinemaOak';else if(o.material==='fabric')o.material='burgundy';});
  state.objects=state.objects.filter(o=>!o.name.startsWith('침상 대형 빈백 쿠션')&&!['linenWall','sageWall','taupeWall'].includes(o.material));
  const cinemaCushion=state.objects.find(o=>o.name.startsWith('왼쪽 벽 세움 쿠션'));
  if(cinemaCushion){
    cinemaCushion.name='수직 등받이 앞 버건디 영화관 쿠션';
    cinemaCushion.pos=[backrest.pos[0]+165,685,backrest.pos[2]];
    cinemaCushion.rot=[0,0,0];
  }
  state.objects.push(
    backrest,
    ...sideWallObjects('cinemaWall',.27,'4안 차콜')
  );
  state.layoutName='4안 · 영화관 월넛 + 버건디 쿠션 + 차콜 벽';
  state.selectedId=backrest.id;
  rebuildObjects();
  saveLocal();
}

function exportProject(){ const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pv5-cargo-layout.json';a.click();URL.revokeObjectURL(url); }
function importProject(file){ const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.cargo||!Array.isArray(data.objects))throw new Error();Object.assign(state,data);syncSettingsUI();rebuildCargo();rebuildObjects();saveLocal();}catch{$('boundaryWarning').textContent='올바른 PV5 설계 파일이 아닙니다.';$('boundaryWarning').classList.add('show');setTimeout(()=>{$('boundaryWarning').textContent='선택한 판이 적재함 경계를 벗어났습니다.';$('boundaryWarning').classList.remove('show');},2400);}};r.readAsText(file); }
function syncSettingsUI(){ $('cargoLength').value=state.cargo.length;$('cargoWidth').value=state.cargo.width;$('wheelhouseWidth').value=state.cargo.wheelhouseWidth||1330;$('cargoHeight').value=state.cargo.height;$('unitCost').value=state.unitCost;$('toggleShell').checked=state.shell;$('toggleGrid').checked=state.grid;$('togglePerson').checked=state.person;$('toggleStorage').checked=state.storageOpen; }

document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>addObject(b.dataset.preset)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
['propName','sizeX','sizeY','sizeZ','posX','posY','posZ'].forEach(id=>$(id).addEventListener('change',updateFromInspector));
document.querySelectorAll('[data-rotate]').forEach(b=>b.addEventListener('click',()=>{const o=selected();if(!o)return;const i={x:0,y:1,z:2}[b.dataset.rotate];o.rot[i]=(o.rot[i]+90)%360;syncMesh(o);}));
document.querySelectorAll('[data-material]').forEach(b=>b.addEventListener('click',()=>{const o=selected();if(!o)return;o.material=b.dataset.material;syncMesh(o);}));
$('deleteObject').addEventListener('click',deleteSelected);$('duplicateObject').addEventListener('click',duplicateSelected);$('centerObject').addEventListener('click',()=>{const o=selected();if(!o)return;o.pos[0]=0;o.pos[2]=0;syncMesh(o);});
$('toggleShell').addEventListener('change',e=>{state.shell=e.target.checked;cargoGroup.visible=state.shell;saveLocal();});$('toggleGrid').addEventListener('change',e=>{state.grid=e.target.checked;grid.visible=state.grid;saveLocal();});
$('togglePerson').addEventListener('change',e=>{state.person=e.target.checked;updatePerson();saveLocal();});
$('toggleStorage').addEventListener('change',e=>{state.storageOpen=e.target.checked;rebuildObjects();updatePerson();saveLocal();});
$('resetView').addEventListener('click',()=>setView('perspective'));$('saveProject').addEventListener('click',()=>{saveLocal();$('saveState').innerHTML='<i></i> 설계를 저장했습니다';setTimeout(saveLocal,1800);});
$('loadPlan1').addEventListener('click',loadPlan1);$('loadPlan2').addEventListener('click',loadPlan2);$('loadPlan3').addEventListener('click',loadPlan3);$('loadPlan4').addEventListener('click',loadPlan4);$('clearAll').addEventListener('click',()=>{state.objects=[];state.selectedId=null;rebuildObjects();saveLocal();});$('exportProject').addEventListener('click',exportProject);$('importProject').addEventListener('change',e=>e.target.files[0]&&importProject(e.target.files[0]));
$('cargoToggle').addEventListener('click',()=>{$('cargoFields').classList.toggle('collapsed');$('cargoToggle').classList.toggle('closed');});
['cargoLength','cargoWidth','wheelhouseWidth','cargoHeight','unitCost'].forEach(id=>$(id).addEventListener('change',()=>{state.cargo.length=Math.max(500,Number($('cargoLength').value)||2255);state.cargo.width=Math.max(500,Number($('cargoWidth').value)||1565);state.cargo.wheelhouseWidth=Math.min(state.cargo.width,Math.max(500,Number($('wheelhouseWidth').value)||1330));state.cargo.height=Math.max(500,Number($('cargoHeight').value)||1520);state.unitCost=Math.max(0,Number($('unitCost').value)||0);syncSettingsUI();rebuildCargo();updateSummary();selectObject(state.selectedId);saveLocal();}));

loadLocal(); syncSettingsUI(); initThree();
// Refresh saved plan 3/4 once so the real rear opening, mat and clear-opening doors replace cached objects.
const hasPlan3=state.objects.some(o=>(o.size[0]===104&&o.size[1]===390&&o.size[2]===260)||(o.size[0]===390&&o.size[1]===104&&o.size[2]===260));
const hadPlan4=String(state.layoutName||'').startsWith('4');
if(hasPlan3&&state.layoutVersion!==33){if(hadPlan4)loadPlan4();else loadPlan3();}
const hasCeilingWall=state.objects.some(o=>String(o.name||'').includes('천장 반투명 패널'));
if(hasCeilingWall&&String(state.layoutName||'').startsWith('1'))loadPlan1();
if(hasCeilingWall&&String(state.layoutName||'').startsWith('2'))loadPlan2();
const hasPlanWalls=state.objects.some(o=>['linenWall','sageWall','taupeWall','cinemaWall'].includes(o.material));
if(!hasPlanWalls&&String(state.layoutName||'').startsWith('1'))loadPlan1();
if(!hasPlanWalls&&String(state.layoutName||'').startsWith('2'))loadPlan2();
