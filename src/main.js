import * as THREE from "three";
import "./style.css";

const ARENA_HALF_SIZE = 24;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.65;
const GRAVITY = 24;
const JUMP_VELOCITY = 8.8;
const MOVE_SPEED = 8.5;
const FIRE_COOLDOWN = 0.18;
const TRACE_FADE_SPEED = 7.5;
const searchParams = new URLSearchParams(window.location.search);
const FORCE_TOUCH = searchParams.get("touch") === "1";
const LOOK_SENSITIVITY = {
  mouseX: 0.0022,
  mouseY: 0.0019,
  touchX: 0.0035,
  touchY: 0.0031,
};
const STAGE_OBJECTIVE_SITES = [
  { label: "the north ring", position: new THREE.Vector3(0, 1.55, -18) },
  { label: "the east relay", position: new THREE.Vector3(18, 1.55, -3) },
  { label: "the south lane", position: new THREE.Vector3(2, 1.55, 18) },
  { label: "the west tower", position: new THREE.Vector3(-18, 1.55, 3) },
  { label: "the ember platform", position: new THREE.Vector3(13, 1.55, 13) },
];

const ui = {
  app: document.querySelector("#app"),
  score: document.querySelector("#score"),
  stage: document.querySelector("#stage"),
  health: document.querySelector("#health"),
  status: document.querySelector("#status"),
  objective: document.querySelector("#objective"),
  overlay: document.querySelector("#overlay"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  startButton: document.querySelector("#start-button"),
  crosshair: document.querySelector(".crosshair"),
  mobileUi: document.querySelector("#mobile-ui"),
  moveStick: document.querySelector("#move-stick"),
  moveThumb: document.querySelector("#move-thumb"),
  lookZone: document.querySelector("#look-zone"),
  fireButton: document.querySelector("#fire-button"),
  jumpButton: document.querySelector("#jump-button"),
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
ui.app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050c17);
scene.fog = new THREE.Fog(0x050c17, 24, 72);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  120,
);

const pitch = new THREE.Object3D();
pitch.add(camera);

const player = new THREE.Object3D();
player.position.set(0, PLAYER_HEIGHT, 14);
player.add(pitch);
scene.add(player);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouseCenter = new THREE.Vector2(0, 0);
const worldUp = new THREE.Vector3(0, 1, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const muzzleWorldPosition = new THREE.Vector3();
const aimTarget = new THREE.Vector3();
const traceMidpoint = new THREE.Vector3();

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
};

const touchInput = {
  enabled:
    FORCE_TOUCH ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches) ||
    navigator.maxTouchPoints > 0,
  sessionActive: false,
  moveTouchId: null,
  lookTouchId: null,
  moveX: 0,
  moveY: 0,
  lastLookX: 0,
  lastLookY: 0,
  fireHeld: false,
};

const state = {
  started: false,
  gameOver: false,
  isPointerLocked: false,
  health: 100,
  score: 0,
  stage: 1,
  fireCooldown: 0,
  verticalVelocity: 0,
  onGround: true,
  statusTimeout: 0,
  stageTicket: 0,
  impacts: [],
  traces: [],
  recoil: 0,
  muzzleFlash: 0,
  walkPhase: 0,
  lookSwayX: 0,
  lookSwayY: 0,
  jumpQueued: false,
  objectiveActive: false,
  objectiveCollected: false,
  objectiveSiteIndex: 0,
};

const obstacles = [];
const enemies = [];
const worldEffects = [];

buildWorld();
const weapon = createWeapon();
const stageGoal = createStageGoal();
camera.add(weapon.group);
resetRun();
attachEvents();
animate();

function buildWorld() {
  const ambient = new THREE.HemisphereLight(0xa6f7ff, 0x0a1018, 1.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xf0fbff, 1.9);
  sun.position.set(-10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  const arenaGlow = new THREE.PointLight(0x35dff5, 28, 80, 2);
  arenaGlow.position.set(0, 7, -12);
  scene.add(arenaGlow);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: 0x08131f,
      roughness: 0.95,
      metalness: 0.14,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(72, 72, 0x43c9eb, 0x11263b);
  grid.position.y = 0.02;
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  scene.add(grid);

  createGlowStrip(0, 0.05, 9, 8, 0.08, 1.3, 0x56dfff, 1.8, 0.8);
  createGlowStrip(0, 0.05, 2, 11, 0.08, 0.7, 0xff8a5a, 1.6, 0.2);
  createGlowStrip(0, 0.05, -6, 14, 0.08, 0.9, 0x56dfff, 2, 1.6);
  createGlowStrip(0, 0.05, -14, 12, 0.08, 0.7, 0xff8a5a, 1.7, 2.1);

  const mainRing = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.28, 20, 96),
    new THREE.MeshStandardMaterial({
      color: 0x8af6ff,
      emissive: 0x1d7f93,
      emissiveIntensity: 2.3,
      roughness: 0.3,
      metalness: 0.78,
    }),
  );
  mainRing.rotation.x = Math.PI / 2;
  mainRing.position.set(0, 6, -14);
  scene.add(mainRing);

  const subRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.8, 0.16, 18, 84),
    new THREE.MeshStandardMaterial({
      color: 0xff9f75,
      emissive: 0xa33812,
      emissiveIntensity: 1.9,
      roughness: 0.24,
      metalness: 0.82,
    }),
  );
  subRing.rotation.x = Math.PI / 2;
  subRing.position.set(0, 4.8, -14);
  scene.add(subRing);

  worldEffects.push((elapsed) => {
    mainRing.rotation.z = elapsed * 0.18;
    mainRing.material.emissiveIntensity = 2.1 + Math.sin(elapsed * 1.4) * 0.45;
    subRing.rotation.z = -elapsed * 0.22;
    subRing.material.emissiveIntensity = 1.7 + Math.cos(elapsed * 1.8) * 0.35;
  });

  const backPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.3, 14, 20),
    new THREE.MeshStandardMaterial({
      color: 0x102435,
      metalness: 0.35,
      roughness: 0.78,
    }),
  );
  backPillar.position.set(0, 7, -14);
  backPillar.castShadow = true;
  backPillar.receiveShadow = true;
  scene.add(backPillar);

  createPerimeterWall(0, 2.5, -ARENA_HALF_SIZE - 0.5, 52, 5, 1.2);
  createPerimeterWall(0, 2.5, ARENA_HALF_SIZE + 0.5, 52, 5, 1.2);
  createPerimeterWall(-ARENA_HALF_SIZE - 0.5, 2.5, 0, 1.2, 5, 52);
  createPerimeterWall(ARENA_HALF_SIZE + 0.5, 2.5, 0, 1.2, 5, 52);

  createGlowColumn(-18, 4.6, -18, 0x60ebff, 1.7, 0.4);
  createGlowColumn(18, 4.8, -16, 0xff9066, 1.5, 1.2);
  createGlowColumn(-17, 4.4, 17, 0xff9066, 1.65, 2.1);
  createGlowColumn(17, 4.5, 18, 0x60ebff, 1.8, 2.7);

  createObstacle(-9, 2.2, -4, 4.4, 4.4, 3.2, 0x14283b);
  createObstacle(8, 1.6, 5, 3.2, 3.2, 6.4, 0x112332);
  createObstacle(-3, 1.2, 8, 8.4, 2.4, 2.4, 0x1b3146);
  createObstacle(10, 1.8, -9, 5.4, 3.6, 3.2, 0x173046);
  createObstacle(-14, 1.4, 9, 3.6, 2.8, 5.8, 0x153042);

  const shards = new THREE.Group();
  const shardGeometry = new THREE.OctahedronGeometry(0.36, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x9af6ff,
    emissive: 0x23879b,
    emissiveIntensity: 1.6,
    roughness: 0.15,
    metalness: 0.88,
  });

  for (let index = 0; index < 88; index += 1) {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(
      THREE.MathUtils.randFloatSpread(60),
      THREE.MathUtils.randFloat(4, 20),
      THREE.MathUtils.randFloatSpread(60),
    );
    shard.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    shard.scale.setScalar(THREE.MathUtils.randFloat(0.7, 1.8));
    shards.add(shard);
  }

  shards.name = "sky-shards";
  scene.add(shards);
}

function createStageGoal() {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const starShape = new THREE.Shape();
  const outerRadius = 0.8;
  const innerRadius = 0.34;

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (index === 0) {
      starShape.moveTo(x, y);
    } else {
      starShape.lineTo(x, y);
    }
  }

  starShape.closePath();

  const starMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff1a8,
    emissive: 0xffbf47,
    emissiveIntensity: 1.9,
    roughness: 0.18,
    metalness: 0.55,
  });
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape, {
      depth: 0.22,
      bevelEnabled: false,
    }),
    starMaterial,
  );
  star.geometry.center();
  star.castShadow = true;
  star.rotation.x = Math.PI * 0.12;
  group.add(star);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x9ef8ff,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.08, 12, 42),
    haloMaterial,
  );
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd57b,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.76, 6.8, 16, 1, true),
    beamMaterial,
  );
  beam.position.y = 3.3;
  group.add(beam);

  const baseGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 36),
    new THREE.MeshBasicMaterial({
      color: 0x86f4ff,
      transparent: true,
      opacity: 0.18,
    }),
  );
  baseGlow.rotation.x = -Math.PI / 2;
  baseGlow.position.y = -1.48;
  group.add(baseGlow);

  const light = new THREE.PointLight(0xffd57b, 3.4, 11, 2);
  light.position.set(0, 1.2, 0);
  group.add(light);

  return {
    group,
    star,
    halo,
    light,
    beam,
    starMaterial,
    haloMaterial,
    beamMaterial,
    baseGlow,
  };
}

function createWeapon() {
  const group = new THREE.Group();
  group.position.set(0.46, -0.42, -0.74);
  group.rotation.set(-0.2, -0.52, 0.06);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x16283f,
    roughness: 0.36,
    metalness: 0.84,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x768fa5,
    roughness: 0.26,
    metalness: 0.92,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9968,
    emissive: 0x9f3817,
    emissiveIntensity: 1.2,
    roughness: 0.28,
    metalness: 0.78,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ef8ff,
    emissive: 0x2ab4ca,
    emissiveIntensity: 2.4,
    roughness: 0.18,
    metalness: 0.4,
    transparent: true,
    opacity: 0.96,
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.2, 0.88),
    bodyMaterial,
  );
  body.position.set(0.02, -0.05, -0.08);
  group.add(body);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.62, 18),
    metalMaterial,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.04, 0.02, -0.58);
  group.add(barrel);

  const muzzleShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 0.2, 18),
    accentMaterial,
  );
  muzzleShroud.rotation.x = Math.PI / 2;
  muzzleShroud.position.set(0.04, 0.03, -0.88);
  group.add(muzzleShroud);

  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.12, 0.46),
    metalMaterial,
  );
  receiver.position.set(0.02, 0.07, -0.18);
  group.add(receiver);

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 0.42),
    bodyMaterial,
  );
  topRail.position.set(0.01, 0.15, -0.2);
  group.add(topRail);

  const sight = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.01, 10, 28),
    coreMaterial,
  );
  sight.position.set(0.01, 0.18, -0.52);
  sight.rotation.x = Math.PI / 2;
  group.add(sight);

  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, 0.28),
    bodyMaterial,
  );
  stock.position.set(0, -0.02, 0.44);
  group.add(stock);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.3, 0.14),
    metalMaterial,
  );
  grip.position.set(-0.06, -0.23, 0.12);
  grip.rotation.z = 0.18;
  group.add(grip);

  const forwardGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.12),
    accentMaterial,
  );
  forwardGrip.position.set(0.02, -0.18, -0.36);
  forwardGrip.rotation.z = -0.12;
  group.add(forwardGrip);

  const energyCell = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.18, 0.3),
    coreMaterial,
  );
  energyCell.position.set(0.13, -0.04, -0.08);
  group.add(energyCell);

  const sideEmitter = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.12, 0.22),
    accentMaterial,
  );
  sideEmitter.position.set(-0.16, -0.03, -0.18);
  group.add(sideEmitter);

  const muzzleFlash = new THREE.Group();

  const flashCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff7d1,
    transparent: true,
    opacity: 0,
  });
  const flashHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0xff9966,
    transparent: true,
    opacity: 0,
  });

  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 14, 14),
    flashCoreMaterial,
  );
  const flashHalo = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.22, 12),
    flashHaloMaterial,
  );
  flashHalo.rotation.x = -Math.PI / 2;
  flashHalo.position.z = -0.12;
  muzzleFlash.add(flashCore, flashHalo);
  muzzleFlash.position.set(0.04, 0.03, -1);
  muzzleFlash.visible = false;
  group.add(muzzleFlash);

  const flashLight = new THREE.PointLight(0xffd28a, 0, 5, 2);
  flashLight.position.copy(muzzleFlash.position);
  group.add(flashLight);

  const muzzleMarker = new THREE.Object3D();
  muzzleMarker.position.copy(muzzleFlash.position);
  group.add(muzzleMarker);

  group.traverse((child) => {
    child.frustumCulled = false;
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.renderOrder = 12;
    }
  });

  return {
    group,
    coreMaterial,
    accentMaterial,
    muzzleFlash,
    flashMaterials: [flashCoreMaterial, flashHaloMaterial],
    flashLight,
    muzzleMarker,
  };
}

function createPerimeterWall(x, y, z, width, height, depth) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x0d1e2e,
    roughness: 0.88,
    metalness: 0.18,
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);

  const trimColor = depth > width ? 0x5ae5ff : 0xff8b62;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(
      width > depth ? width * 0.4 : 0.08,
      0.16,
      depth > width ? depth * 0.22 : 0.08,
    ),
    new THREE.MeshStandardMaterial({
      color: trimColor,
      emissive: trimColor,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.72,
    }),
  );
  trim.position.set(x, y + height / 2 + 0.18, z);
  scene.add(trim);

  worldEffects.push((elapsed) => {
    trim.material.emissiveIntensity = 0.9 + Math.sin(elapsed * 1.4 + x + z) * 0.25;
  });
}

function createGlowStrip(x, y, z, width, height, depth, color, speed, phase) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.24,
    metalness: 0.5,
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);

  worldEffects.push((elapsed) => {
    material.emissiveIntensity = 1.15 + Math.sin(elapsed * speed + phase) * 0.6;
  });
}

function createGlowColumn(x, y, z, color, speed, phase) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.18,
    metalness: 0.52,
    transparent: true,
    opacity: 0.86,
  });

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 14),
    material,
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);

  worldEffects.push((elapsed) => {
    mesh.scale.y = 0.92 + Math.sin(elapsed * speed + phase) * 0.05;
    material.emissiveIntensity = 1.2 + Math.cos(elapsed * speed + phase) * 0.55;
  });
}

function createObstacle(x, y, z, width, height, depth, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.22,
    }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const topAccent = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.6, 0.12, depth * 0.18),
    new THREE.MeshStandardMaterial({
      color: 0x73eeff,
      emissive: 0x33d0e7,
      emissiveIntensity: 1.3,
      roughness: 0.22,
      metalness: 0.68,
    }),
  );
  topAccent.position.set(x, y + height / 2 + 0.16, z);
  scene.add(topAccent);

  worldEffects.push((elapsed) => {
    topAccent.material.emissiveIntensity = 1 + Math.sin(elapsed * 1.7 + x) * 0.35;
  });

  obstacles.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  });
}

function attachEvents() {
  ui.startButton.addEventListener("click", () => {
    if (!state.started || state.gameOver) {
      resetRun();
    }

    if (touchInput.enabled) {
      activateTouchSession();
      return;
    }

    renderer.domElement.requestPointerLock?.();
  });

  document.addEventListener("pointerlockchange", () => {
    state.isPointerLocked = document.pointerLockElement === renderer.domElement;

    if (touchInput.enabled) {
      return;
    }

    ui.crosshair.classList.toggle("active", state.isPointerLocked);
    ui.overlay.classList.toggle("hidden", state.isPointerLocked);

    if (!state.isPointerLocked && !state.gameOver) {
      ui.overlayTitle.textContent = "Mission paused";
      ui.overlayCopy.textContent =
        "Lock the pointer to jump back into the arena and keep the VX-9 on target.";
      ui.startButton.textContent = "Resume mission";
    }
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.isPointerLocked) {
      return;
    }

    applyLookDelta(
      event.movementX,
      event.movementY,
      LOOK_SENSITIVITY.mouseX,
      LOOK_SENSITIVITY.mouseY,
    );
  });

  window.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      fire();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyW") keys.forward = true;
    if (event.code === "KeyS") keys.backward = true;
    if (event.code === "KeyA") keys.left = true;
    if (event.code === "KeyD") keys.right = true;
    if (event.code === "Space") keys.jump = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyW") keys.forward = false;
    if (event.code === "KeyS") keys.backward = false;
    if (event.code === "KeyA") keys.left = false;
    if (event.code === "KeyD") keys.right = false;
    if (event.code === "Space") keys.jump = false;
  });

  if (touchInput.enabled) {
    attachTouchControls();
  }

  window.addEventListener("resize", onResize);
}

function attachTouchControls() {
  const touchOptions = { passive: false };

  ui.mobileUi.classList.remove("is-visible");
  ui.mobileUi.setAttribute("aria-hidden", "true");

  ui.moveStick.addEventListener("touchstart", handleMoveTouchStart, touchOptions);
  ui.lookZone.addEventListener("touchstart", handleLookTouchStart, touchOptions);
  ui.fireButton.addEventListener("touchstart", handleFireTouchStart, touchOptions);
  ui.fireButton.addEventListener("touchend", handleFireTouchEnd, touchOptions);
  ui.fireButton.addEventListener("touchcancel", handleFireTouchEnd, touchOptions);
  ui.jumpButton.addEventListener("touchstart", handleJumpTouchStart, touchOptions);
  ui.jumpButton.addEventListener("touchend", swallowTouch, touchOptions);
  ui.jumpButton.addEventListener("touchcancel", swallowTouch, touchOptions);
  window.addEventListener("touchmove", handleGlobalTouchMove, touchOptions);
  window.addEventListener("touchend", handleGlobalTouchEnd, touchOptions);
  window.addEventListener("touchcancel", handleGlobalTouchEnd, touchOptions);
}

function handleMoveTouchStart(event) {
  if (touchInput.moveTouchId !== null) {
    return;
  }

  const touch = event.changedTouches[0];
  if (!touch) {
    return;
  }

  touchInput.moveTouchId = touch.identifier;
  updateJoystickFromTouch(touch);
  event.preventDefault();
}

function handleLookTouchStart(event) {
  if (touchInput.lookTouchId !== null) {
    return;
  }

  const touch = event.changedTouches[0];
  if (!touch) {
    return;
  }

  touchInput.lookTouchId = touch.identifier;
  touchInput.lastLookX = touch.clientX;
  touchInput.lastLookY = touch.clientY;
  event.preventDefault();
}

function handleGlobalTouchMove(event) {
  let handled = false;

  for (const touch of event.changedTouches) {
    if (touch.identifier === touchInput.moveTouchId) {
      updateJoystickFromTouch(touch);
      handled = true;
    }

    if (touch.identifier === touchInput.lookTouchId) {
      const deltaX = touch.clientX - touchInput.lastLookX;
      const deltaY = touch.clientY - touchInput.lastLookY;
      touchInput.lastLookX = touch.clientX;
      touchInput.lastLookY = touch.clientY;
      applyLookDelta(
        deltaX,
        deltaY,
        LOOK_SENSITIVITY.touchX,
        LOOK_SENSITIVITY.touchY,
      );
      handled = true;
    }
  }

  if (handled) {
    event.preventDefault();
  }
}

function handleGlobalTouchEnd(event) {
  let handled = false;

  for (const touch of event.changedTouches) {
    if (touch.identifier === touchInput.moveTouchId) {
      touchInput.moveTouchId = null;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      ui.moveThumb.style.transform = "translate(-50%, -50%)";
      handled = true;
    }

    if (touch.identifier === touchInput.lookTouchId) {
      touchInput.lookTouchId = null;
      handled = true;
    }
  }

  if (handled) {
    event.preventDefault();
  }
}

function handleFireTouchStart(event) {
  touchInput.fireHeld = true;
  fire();
  event.preventDefault();
  event.stopPropagation();
}

function handleFireTouchEnd(event) {
  touchInput.fireHeld = false;
  event.preventDefault();
  event.stopPropagation();
}

function handleJumpTouchStart(event) {
  queueJump();
  event.preventDefault();
  event.stopPropagation();
}

function swallowTouch(event) {
  event.preventDefault();
  event.stopPropagation();
}

function activateTouchSession() {
  touchInput.sessionActive = true;
  ui.mobileUi.classList.add("is-visible");
  ui.mobileUi.setAttribute("aria-hidden", "false");
  ui.overlay.classList.add("hidden");
  ui.crosshair.classList.add("active");
  setStatus("Touch controls live. Left thumb move, right thumb aim.", 1400);
}

function deactivateTouchSession(showOverlay = false) {
  touchInput.sessionActive = false;
  resetTouchInputState();
  ui.mobileUi.classList.remove("is-visible");
  ui.mobileUi.setAttribute("aria-hidden", "true");

  if (!state.isPointerLocked) {
    ui.crosshair.classList.remove("active");
  }

  if (showOverlay) {
    ui.overlay.classList.remove("hidden");
  }
}

function resetTouchInputState() {
  touchInput.moveTouchId = null;
  touchInput.lookTouchId = null;
  touchInput.moveX = 0;
  touchInput.moveY = 0;
  touchInput.lastLookX = 0;
  touchInput.lastLookY = 0;
  touchInput.fireHeld = false;
  ui.moveThumb.style.transform = "translate(-50%, -50%)";
}

function updateJoystickFromTouch(touch) {
  const rect = ui.moveStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = rect.width * 0.28;
  const rawX = touch.clientX - centerX;
  const rawY = touch.clientY - centerY;
  const distance = Math.hypot(rawX, rawY);
  const scale = distance > radius ? radius / distance : 1;
  const clampedX = rawX * scale;
  const clampedY = rawY * scale;

  touchInput.moveX = clampedX / radius;
  touchInput.moveY = clampedY / radius;

  ui.moveThumb.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
}

function applyLookDelta(deltaX, deltaY, sensitivityX, sensitivityY) {
  player.rotation.y -= deltaX * sensitivityX;
  pitch.rotation.x -= deltaY * sensitivityY;
  pitch.rotation.x = THREE.MathUtils.clamp(
    pitch.rotation.x,
    -Math.PI / 2.1,
    Math.PI / 2.35,
  );

  state.lookSwayX = THREE.MathUtils.clamp(deltaX * 0.0009, -0.035, 0.035);
  state.lookSwayY = THREE.MathUtils.clamp(deltaY * 0.0008, -0.03, 0.03);
}

function controlsAreActive() {
  return state.isPointerLocked || touchInput.sessionActive;
}

function queueJump() {
  state.jumpQueued = true;
}

function getStageSite(stage = state.stage) {
  return STAGE_OBJECTIVE_SITES[(stage - 1) % STAGE_OBJECTIVE_SITES.length];
}

function getAliveEnemyCount() {
  return enemies.reduce((count, enemy) => count + Number(enemy.alive), 0);
}

function getIdleStatusMessage() {
  if (state.gameOver) {
    return "Mission failed.";
  }

  if (state.objectiveActive) {
    return `Stage ${state.stage} // Recover the star core`;
  }

  if (getAliveEnemyCount() > 0) {
    return `Stage ${state.stage} // Arena sweep`;
  }

  return `Stage ${state.stage} // Objective exposed`;
}

function updateObjectiveText() {
  const site = getStageSite();
  const enemiesRemaining = getAliveEnemyCount();

  if (state.gameOver) {
    ui.objective.textContent = `Goal failed at stage ${state.stage}. Restart to recover the next star core.`;
    return;
  }

  if (state.objectiveActive) {
    ui.objective.textContent = `Goal: Find and collect the star core near ${site.label}.`;
    return;
  }

  if (enemiesRemaining > 0) {
    ui.objective.textContent = `Goal: Clear ${enemiesRemaining} ${
      enemiesRemaining === 1 ? "drone" : "drones"
    } to reveal the star core near ${site.label}.`;
    return;
  }

  ui.objective.textContent = `Goal: The star core is online near ${site.label}. Move in and recover it.`;
}

function resetRun() {
  clearEnemies();
  clearTransientEffects();
  resetTouchInputState();

  state.started = true;
  state.gameOver = false;
  state.health = 100;
  state.score = 0;
  state.stage = 1;
  state.fireCooldown = 0;
  state.verticalVelocity = 0;
  state.onGround = true;
  state.recoil = 0;
  state.muzzleFlash = 0;
  state.walkPhase = 0;
  state.lookSwayX = 0;
  state.lookSwayY = 0;
  state.jumpQueued = false;
  state.objectiveActive = false;
  state.objectiveCollected = false;
  stageGoal.group.visible = false;
  state.stageTicket += 1;

  if (touchInput.enabled) {
    deactivateTouchSession(false);
  }

  player.position.set(0, PLAYER_HEIGHT, 14);
  player.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);

  ui.overlayTitle.textContent = "Neon Siege";
  ui.overlayCopy.textContent = touchInput.enabled
    ? "Play on iPhone or iPad with the touch HUD: left thumb to move, right thumb to aim, and the on-screen buttons to jump and fire."
    : "Drop into the arena with a visible pulse rifle, clear incoming drones, then recover the glowing star core to finish each stage.";
  ui.startButton.textContent = touchInput.enabled ? "Start touch mission" : "Start mission";

  startStage(1);
}

function clearEnemies() {
  for (const enemy of enemies) {
    scene.remove(enemy.mesh);
  }

  enemies.length = 0;
}

function clearTransientEffects() {
  for (const impact of state.impacts) {
    scene.remove(impact.mesh);
  }

  for (const trace of state.traces) {
    scene.remove(trace.mesh);
  }

  state.impacts = [];
  state.traces = [];
}

function startStage(stage) {
  clearEnemies();
  state.stage = stage;
  state.stageTicket += 1;
  state.objectiveSiteIndex = (stage - 1) % STAGE_OBJECTIVE_SITES.length;
  state.objectiveActive = false;
  state.objectiveCollected = false;
  stageGoal.group.visible = false;
  stageGoal.group.position.copy(getStageSite(stage).position);

  const count = 3 + stage * 2;
  for (let index = 0; index < count; index += 1) {
    spawnEnemy(stage);
  }

  updateHud();
  setStatus(`Stage ${stage} deployed. Sweep the arena.`, 1200);
}

function revealStageGoal() {
  if (state.gameOver || state.objectiveActive || state.objectiveCollected) {
    return;
  }

  const site = getStageSite();
  state.objectiveActive = true;
  stageGoal.group.visible = true;
  updateHud();
  setStatus(`Star core detected near ${site.label}.`, 1500);
}

function collectStageGoal() {
  if (!state.objectiveActive || state.objectiveCollected || state.gameOver) {
    return;
  }

  state.objectiveCollected = true;
  state.objectiveActive = false;
  stageGoal.group.visible = false;
  state.score += 250;
  updateHud();
  setStatus(`Star core secured. Stage ${state.stage + 1} unlocking.`, 1400);

  const currentTicket = state.stageTicket;
  window.setTimeout(() => {
    if (!state.gameOver && currentTicket === state.stageTicket) {
      startStage(state.stage + 1);
    }
  }, 900);
}

function spawnEnemy(stage) {
  const material = new THREE.MeshStandardMaterial({
    color: stage > 3 ? 0xff9a74 : 0xff6f53,
    emissive: stage > 3 ? 0xa63b14 : 0x7a1f0a,
    emissiveIntensity: 1.5 + stage * 0.05,
    roughness: 0.32,
    metalness: 0.3,
  });

  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.78, 0),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.12, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0xeefcff,
      emissive: 0x7cf2ff,
      emissiveIntensity: 2.4,
      roughness: 0.15,
    }),
  );
  eye.position.set(0, 0, 0.7);
  mesh.add(eye);

  const spawnPoint = randomSpawnPoint();
  mesh.position.copy(spawnPoint);
  scene.add(mesh);

  enemies.push({
    mesh,
    speed: THREE.MathUtils.randFloat(1.8, 2.7) + stage * 0.12,
    bobSpeed: THREE.MathUtils.randFloat(3, 5.2),
    bobOffset: Math.random() * Math.PI * 2,
    baseY: spawnPoint.y,
    alive: true,
  });
}

function randomSpawnPoint() {
  const candidate = new THREE.Vector3();
  let valid = false;

  while (!valid) {
    candidate.set(
      THREE.MathUtils.randFloatSpread(ARENA_HALF_SIZE * 1.8),
      THREE.MathUtils.randFloat(1.2, 2.3),
      THREE.MathUtils.randFloat(-ARENA_HALF_SIZE + 3, ARENA_HALF_SIZE - 3),
    );

    const playerDistance = tempVector
      .set(candidate.x - player.position.x, 0, candidate.z - player.position.z)
      .length();

    valid =
      playerDistance > 10 &&
      Math.abs(candidate.x) < ARENA_HALF_SIZE - 2 &&
      Math.abs(candidate.z) < ARENA_HALF_SIZE - 2 &&
      !obstacles.some((obstacle) => pointInsideObstacle(candidate, obstacle, 1.8));
  }

  return candidate;
}

function pointInsideObstacle(point, obstacle, padding = 0) {
  return (
    point.x > obstacle.minX - padding &&
    point.x < obstacle.maxX + padding &&
    point.z > obstacle.minZ - padding &&
    point.z < obstacle.maxZ + padding
  );
}

function fire() {
  if (!controlsAreActive() || state.gameOver || state.fireCooldown > 0) {
    return;
  }

  state.fireCooldown = FIRE_COOLDOWN;
  state.recoil = Math.min(state.recoil + 1.1, 1.4);
  state.muzzleFlash = 1;

  ui.crosshair.classList.add("damage");
  window.setTimeout(() => ui.crosshair.classList.remove("damage"), 120);

  raycaster.setFromCamera(mouseCenter, camera);

  const aliveTargets = enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => enemy.mesh);

  const intersections = raycaster.intersectObjects(aliveTargets, false);
  const firstHit = intersections.at(0);

  if (!firstHit) {
    aimTarget.copy(raycaster.ray.origin).add(
      tempVector.copy(raycaster.ray.direction).multiplyScalar(48),
    );
    createTracer(aimTarget, false);
    setStatus("Pulse burst discharged.", 700);
    return;
  }

  const target = enemies.find((enemy) => enemy.mesh === firstHit.object);
  if (!target) {
    return;
  }

  target.alive = false;
  state.score += 100;
  createTracer(firstHit.point, true);
  createImpact(firstHit.point);
  setStatus("Direct hit. Drone neutralized.", 850);
  scene.remove(target.mesh);
  updateHud();

  if (enemies.every((enemy) => !enemy.alive)) {
    const currentTicket = state.stageTicket;
    window.setTimeout(() => {
      if (!state.gameOver && currentTicket === state.stageTicket) {
        revealStageGoal();
      }
    }, 650);
  }
}

function createTracer(targetPoint, isHit) {
  weapon.muzzleMarker.getWorldPosition(muzzleWorldPosition);

  const direction = targetPoint.clone().sub(muzzleWorldPosition);
  const length = Math.max(direction.length(), 0.1);
  const material = new THREE.MeshBasicMaterial({
    color: isHit ? 0x9ef8ff : 0xffc38b,
    transparent: true,
    opacity: 0.95,
  });
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(isHit ? 0.02 : 0.014, 0.006, length, 8, 1, true),
    material,
  );

  traceMidpoint.copy(muzzleWorldPosition).add(targetPoint).multiplyScalar(0.5);
  mesh.position.copy(traceMidpoint);
  mesh.quaternion.setFromUnitVectors(yAxis, direction.normalize());
  scene.add(mesh);

  state.traces.push({
    mesh,
    material,
    age: 0,
  });
}

function createImpact(position) {
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x87f5ff,
    transparent: true,
    opacity: 0.95,
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.04, 10, 28),
    ringMaterial,
  );
  ring.position.copy(position);
  ring.lookAt(camera.position);
  scene.add(ring);

  state.impacts.push({
    mesh: ring,
    material: ringMaterial,
    age: 0,
  });
}

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.stage.textContent = String(state.stage);
  ui.health.textContent = String(Math.max(0, Math.round(state.health)));
  ui.health.style.color = state.health <= 35 ? "#ff6f61" : "#ffd166";
  updateObjectiveText();
}

function setStatus(message, timeoutMs = 0) {
  ui.status.textContent = message;

  if (state.statusTimeout) {
    window.clearTimeout(state.statusTimeout);
    state.statusTimeout = 0;
  }

  if (timeoutMs > 0) {
    state.statusTimeout = window.setTimeout(() => {
      ui.status.textContent = getIdleStatusMessage();
    }, timeoutMs);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (touchInput.moveTouchId === null) {
    ui.moveThumb.style.transform = "translate(-50%, -50%)";
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const skyShards = scene.getObjectByName("sky-shards");

  if (skyShards) {
    skyShards.rotation.y += delta * 0.05;
  }

  updateWorldEffects();

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);

  if (controlsAreActive() && !state.gameOver) {
    updateMovement(delta);
    updateEnemies(delta);

    if (touchInput.fireHeld) {
      fire();
    }
  }

  updateStageGoal(delta);
  updateWeapon(delta);
  updateImpacts(delta);
  updateTraces(delta);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateWorldEffects() {
  const elapsed = clock.elapsedTime;
  for (const effect of worldEffects) {
    effect(elapsed);
  }
}

function updateMovement(delta) {
  camera.getWorldDirection(moveForward);
  moveForward.y = 0;
  moveForward.normalize();

  moveRight.crossVectors(moveForward, worldUp).normalize();

  tempVector.set(0, 0, 0);
  if (keys.forward) tempVector.add(moveForward);
  if (keys.backward) tempVector.sub(moveForward);
  if (keys.right) tempVector.add(moveRight);
  if (keys.left) tempVector.sub(moveRight);

  if (Math.abs(touchInput.moveY) > 0.05) {
    tempVector.addScaledVector(moveForward, -touchInput.moveY);
  }

  if (Math.abs(touchInput.moveX) > 0.05) {
    tempVector.addScaledVector(moveRight, touchInput.moveX);
  }

  const isMoving = tempVector.lengthSq() > 0;

  if (isMoving) {
    state.walkPhase += delta * 9.5;
    tempVector.normalize().multiplyScalar(MOVE_SPEED * delta);
    movePlayer(tempVector.x, tempVector.z);
  } else {
    state.walkPhase += delta * 2.2;
  }

  if ((keys.jump || state.jumpQueued) && state.onGround) {
    state.verticalVelocity = JUMP_VELOCITY;
    state.onGround = false;
  }

  state.jumpQueued = false;
  state.verticalVelocity -= GRAVITY * delta;
  player.position.y += state.verticalVelocity * delta;

  if (player.position.y <= PLAYER_HEIGHT) {
    player.position.y = PLAYER_HEIGHT;
    state.verticalVelocity = 0;
    state.onGround = true;
  }
}

function movePlayer(offsetX, offsetZ) {
  const proposedX = THREE.MathUtils.clamp(
    player.position.x + offsetX,
    -ARENA_HALF_SIZE + PLAYER_RADIUS,
    ARENA_HALF_SIZE - PLAYER_RADIUS,
  );

  if (!collidesWithObstacles(proposedX, player.position.z)) {
    player.position.x = proposedX;
  }

  const proposedZ = THREE.MathUtils.clamp(
    player.position.z + offsetZ,
    -ARENA_HALF_SIZE + PLAYER_RADIUS,
    ARENA_HALF_SIZE - PLAYER_RADIUS,
  );

  if (!collidesWithObstacles(player.position.x, proposedZ)) {
    player.position.z = proposedZ;
  }
}

function collidesWithObstacles(x, z) {
  return obstacles.some((obstacle) => {
    const nearestX = THREE.MathUtils.clamp(x, obstacle.minX, obstacle.maxX);
    const nearestZ = THREE.MathUtils.clamp(z, obstacle.minZ, obstacle.maxZ);
    const dx = x - nearestX;
    const dz = z - nearestZ;

    return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      continue;
    }

    tempVector
      .set(
        player.position.x - enemy.mesh.position.x,
        0,
        player.position.z - enemy.mesh.position.z,
      )
      .normalize();

    enemy.mesh.position.x += tempVector.x * enemy.speed * delta;
    enemy.mesh.position.z += tempVector.z * enemy.speed * delta;
    enemy.mesh.position.y =
      enemy.baseY +
      Math.sin(clock.elapsedTime * enemy.bobSpeed + enemy.bobOffset) * 0.18;

    enemy.mesh.rotation.x += delta * 0.9;
    enemy.mesh.rotation.y += delta * 1.55;
    enemy.mesh.material.emissiveIntensity =
      1.35 + Math.sin(clock.elapsedTime * 2.4 + enemy.bobOffset) * 0.3;

    const distance = enemy.mesh.position.distanceTo(player.position);
    if (distance < 1.7) {
      takeDamage(18 * delta);
    }
  }
}

function updateStageGoal(delta) {
  if (!stageGoal.group.visible) {
    return;
  }

  const elapsed = clock.elapsedTime;
  stageGoal.group.rotation.y += delta * 1.35;
  stageGoal.star.rotation.z += delta * 1.8;
  stageGoal.star.position.y = Math.sin(elapsed * 2.8) * 0.12;
  stageGoal.halo.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.08);
  stageGoal.haloMaterial.opacity = 0.42 + Math.sin(elapsed * 4.4) * 0.12;
  stageGoal.beamMaterial.opacity = 0.18 + Math.sin(elapsed * 2.4) * 0.06;
  stageGoal.baseGlow.scale.setScalar(1 + Math.sin(elapsed * 3.6) * 0.1);
  stageGoal.light.intensity = 3.1 + Math.sin(elapsed * 5.2) * 0.45;
  stageGoal.starMaterial.emissiveIntensity = 1.75 + Math.sin(elapsed * 5.2) * 0.3;

  if (player.position.distanceTo(stageGoal.group.position) < 2.1) {
    collectStageGoal();
  }
}

function updateWeapon(delta) {
  const moving =
    Number(keys.forward || keys.backward || keys.left || keys.right) +
    Number(Math.abs(touchInput.moveX) > 0.05 || Math.abs(touchInput.moveY) > 0.05);
  const bobX = Math.sin(state.walkPhase) * 0.02 * Math.min(moving, 1);
  const bobY = Math.abs(Math.cos(state.walkPhase * 2)) * 0.016 * Math.min(moving, 1);

  state.recoil = smoothTo(state.recoil, 0, delta, 10);
  state.muzzleFlash = smoothTo(state.muzzleFlash, 0, delta, 16);
  state.lookSwayX = smoothTo(state.lookSwayX, 0, delta, 9);
  state.lookSwayY = smoothTo(state.lookSwayY, 0, delta, 9);

  weapon.group.position.set(
    0.46 - state.lookSwayX * 1.6 + bobX,
    -0.42 + state.lookSwayY * 1.3 - bobY - state.recoil * 0.11,
    -0.74 + state.recoil * 0.16,
  );
  weapon.group.rotation.set(
    -0.2 - state.recoil * 0.34 + bobY * 0.9 + state.lookSwayY,
    -0.52 - state.lookSwayX * 1.6,
    0.06 + state.lookSwayX * 1.8 - bobX * 1.2 + state.recoil * 0.08,
  );

  weapon.muzzleFlash.visible = state.muzzleFlash > 0.03;
  weapon.muzzleFlash.scale.setScalar(1 + state.muzzleFlash * 0.65);
  weapon.flashMaterials[0].opacity = state.muzzleFlash * 0.95;
  weapon.flashMaterials[1].opacity = state.muzzleFlash * 0.7;
  weapon.flashLight.intensity = state.muzzleFlash * 6;
  weapon.coreMaterial.emissiveIntensity = 1.9 + state.muzzleFlash * 1.4;
  weapon.accentMaterial.emissiveIntensity = 0.95 + state.muzzleFlash * 0.8;
}

function takeDamage(amount) {
  if (state.gameOver) {
    return;
  }

  state.health = Math.max(0, state.health - amount);
  updateHud();
  document.body.classList.add("damage");
  window.setTimeout(() => document.body.classList.remove("damage"), 120);

  if (state.health <= 0) {
    endRun();
  }
}

function endRun() {
  state.gameOver = true;
  state.objectiveActive = false;
  stageGoal.group.visible = false;
  if (document.exitPointerLock) {
    document.exitPointerLock();
  }
  if (touchInput.enabled) {
    deactivateTouchSession(true);
  }
  setStatus("Mission failed.");
  ui.overlay.classList.remove("hidden");
  ui.overlayTitle.textContent = "Mission failed";
  ui.overlayCopy.textContent = touchInput.enabled
    ? `You reached stage ${state.stage} with ${state.score} points. Tap restart and jump back in with the touch HUD.`
    : `You reached stage ${state.stage} with ${state.score} points. Lock the pointer to redeploy the VX-9 and restart the arena.`;
  ui.startButton.textContent = touchInput.enabled ? "Restart touch mission" : "Restart mission";
  updateHud();
}

function updateImpacts(delta) {
  const survivors = [];

  for (const impact of state.impacts) {
    impact.age += delta;
    impact.mesh.scale.setScalar(1 + impact.age * 7);
    impact.material.opacity = Math.max(0, 0.95 - impact.age * 2.2);
    impact.mesh.rotation.z += delta * 6;

    if (impact.age < 0.4) {
      survivors.push(impact);
    } else {
      scene.remove(impact.mesh);
    }
  }

  state.impacts = survivors;
}

function updateTraces(delta) {
  const survivors = [];

  for (const trace of state.traces) {
    trace.age += delta;
    trace.material.opacity = Math.max(0, 0.95 - trace.age * TRACE_FADE_SPEED);
    trace.mesh.scale.x = Math.max(0.2, 1 - trace.age * 1.6);
    trace.mesh.scale.z = trace.mesh.scale.x;

    if (trace.age < 0.2) {
      survivors.push(trace);
    } else {
      scene.remove(trace.mesh);
    }
  }

  state.traces = survivors;
}

function smoothTo(current, target, delta, speed) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}
