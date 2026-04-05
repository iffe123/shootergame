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

const ui = {
  app: document.querySelector("#app"),
  score: document.querySelector("#score"),
  wave: document.querySelector("#wave"),
  health: document.querySelector("#health"),
  status: document.querySelector("#status"),
  overlay: document.querySelector("#overlay"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  startButton: document.querySelector("#start-button"),
  crosshair: document.querySelector(".crosshair"),
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

const state = {
  started: false,
  gameOver: false,
  isPointerLocked: false,
  health: 100,
  score: 0,
  wave: 1,
  fireCooldown: 0,
  verticalVelocity: 0,
  onGround: true,
  statusTimeout: 0,
  waveTicket: 0,
  impacts: [],
  traces: [],
  recoil: 0,
  muzzleFlash: 0,
  walkPhase: 0,
  lookSwayX: 0,
  lookSwayY: 0,
};

const obstacles = [];
const enemies = [];
const worldEffects = [];

buildWorld();
const weapon = createWeapon();
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

    renderer.domElement.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    state.isPointerLocked = document.pointerLockElement === renderer.domElement;
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

    player.rotation.y -= event.movementX * 0.0022;
    pitch.rotation.x -= event.movementY * 0.0019;
    pitch.rotation.x = THREE.MathUtils.clamp(
      pitch.rotation.x,
      -Math.PI / 2.1,
      Math.PI / 2.35,
    );

    state.lookSwayX = THREE.MathUtils.clamp(event.movementX * 0.0009, -0.035, 0.035);
    state.lookSwayY = THREE.MathUtils.clamp(event.movementY * 0.0008, -0.03, 0.03);
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

  window.addEventListener("resize", onResize);
}

function resetRun() {
  clearEnemies();
  clearTransientEffects();

  state.started = true;
  state.gameOver = false;
  state.health = 100;
  state.score = 0;
  state.wave = 1;
  state.fireCooldown = 0;
  state.verticalVelocity = 0;
  state.onGround = true;
  state.recoil = 0;
  state.muzzleFlash = 0;
  state.walkPhase = 0;
  state.lookSwayX = 0;
  state.lookSwayY = 0;
  state.waveTicket += 1;

  player.position.set(0, PLAYER_HEIGHT, 14);
  player.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);

  updateHud();
  setStatus("Arena hot. Secure the sector.");

  ui.overlayTitle.textContent = "Neon Siege";
  ui.overlayCopy.textContent =
    "Drop into the arena with a visible pulse rifle, clear incoming drones, and show that a browser-based first person shooter can be built from zero to live demo fast.";
  ui.startButton.textContent = "Start mission";

  spawnWave(state.wave);
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

function spawnWave(wave) {
  setStatus(`Wave ${wave} entering the grid.`);
  updateHud();

  const count = 3 + wave * 2;
  for (let index = 0; index < count; index += 1) {
    spawnEnemy(wave);
  }
}

function spawnEnemy(wave) {
  const material = new THREE.MeshStandardMaterial({
    color: wave > 3 ? 0xff9a74 : 0xff6f53,
    emissive: wave > 3 ? 0xa63b14 : 0x7a1f0a,
    emissiveIntensity: 1.5 + wave * 0.05,
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
    speed: THREE.MathUtils.randFloat(1.8, 2.7) + wave * 0.12,
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
  if (!state.isPointerLocked || state.gameOver || state.fireCooldown > 0) {
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
    const currentTicket = state.waveTicket;
    window.setTimeout(() => {
      if (!state.gameOver && currentTicket === state.waveTicket) {
        state.wave += 1;
        spawnWave(state.wave);
      }
    }, 900);
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
  ui.wave.textContent = String(state.wave);
  ui.health.textContent = String(Math.max(0, Math.round(state.health)));
  ui.health.style.color = state.health <= 35 ? "#ff6f61" : "#ffd166";
}

function setStatus(message, timeoutMs = 0) {
  ui.status.textContent = message;

  if (state.statusTimeout) {
    window.clearTimeout(state.statusTimeout);
    state.statusTimeout = 0;
  }

  if (timeoutMs > 0) {
    state.statusTimeout = window.setTimeout(() => {
      ui.status.textContent = "Arena hot. Secure the sector.";
    }, timeoutMs);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const skyShards = scene.getObjectByName("sky-shards");

  if (skyShards) {
    skyShards.rotation.y += delta * 0.05;
  }

  updateWorldEffects();

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);

  if (state.isPointerLocked && !state.gameOver) {
    updateMovement(delta);
    updateEnemies(delta);
  }

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

  const isMoving = tempVector.lengthSq() > 0;

  if (isMoving) {
    state.walkPhase += delta * 9.5;
    tempVector.normalize().multiplyScalar(MOVE_SPEED * delta);
    movePlayer(tempVector.x, tempVector.z);
  } else {
    state.walkPhase += delta * 2.2;
  }

  if (keys.jump && state.onGround) {
    state.verticalVelocity = JUMP_VELOCITY;
    state.onGround = false;
  }

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

function updateWeapon(delta) {
  const moving = Number(keys.forward || keys.backward || keys.left || keys.right);
  const bobX = Math.sin(state.walkPhase) * 0.02 * moving;
  const bobY = Math.abs(Math.cos(state.walkPhase * 2)) * 0.016 * moving;

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
  document.exitPointerLock();
  setStatus("Mission failed.");
  ui.overlay.classList.remove("hidden");
  ui.overlayTitle.textContent = "Mission failed";
  ui.overlayCopy.textContent =
    `You reached wave ${state.wave} with ${state.score} points. Lock the pointer to redeploy the VX-9 and restart the arena.`;
  ui.startButton.textContent = "Restart mission";
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
