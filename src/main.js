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
const MAX_PARTICLES = 40;
const MAX_ENEMY_PROJECTILES = 8;
const MAX_HEALTH_PICKUPS = 2;
const searchParams = new URLSearchParams(window.location.search);
const FORCE_TOUCH = searchParams.get("touch") === "1";
const HAS_FINE_POINTER =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(any-pointer: fine)").matches;
const HAS_COARSE_POINTER =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(any-pointer: coarse)").matches;
const HAS_TOUCH_POINTS = navigator.maxTouchPoints > 0;
const LOOK_SENSITIVITY = {
  mouseX: 0.0022,
  mouseY: 0.0019,
  touchX: 0.0054,
  touchY: 0.0046,
};
const TOUCH_LOOK_TUNING = {
  minDt: 10,
  baseBoost: 1,
  distanceBoost: 0.022,
  velocityBoost: 0.05,
  maxBoostX: 2.75,
  maxBoostY: 2.1,
};
const STAGE_OBJECTIVE_SITES = [
  {
    label: "the north ring",
    mapLabel: "North ring",
    position: new THREE.Vector3(0, 1.55, -18),
  },
  {
    label: "the east relay",
    mapLabel: "East relay",
    position: new THREE.Vector3(18, 1.55, -3),
  },
  {
    label: "the south lane",
    mapLabel: "South lane",
    position: new THREE.Vector3(2, 1.55, 18),
  },
  {
    label: "the west tower",
    mapLabel: "West tower",
    position: new THREE.Vector3(-18, 1.55, 3),
  },
  {
    label: "the ember platform",
    mapLabel: "Ember platform",
    position: new THREE.Vector3(13, 1.55, 13),
  },
];

/* ── Biomes ── */
const BIOMES = [
  {
    name: "Arc Sector",
    floor: 0x112335,
    floorEmissive: 0x07131f,
    fog: 0x050c17,
    background: 0x050c17,
    gridMain: 0x72f0ff,
    gridSecondary: 0x1c4362,
    wallColor: 0x315a76,
    wallEmissive: 0x0d2031,
    obstacleColors: [0x14283b, 0x112332, 0x1b3146, 0x173046, 0x153042],
    accentA: 0x56dfff,
    accentB: 0xff8a5a,
    ambientSky: 0xa6f7ff,
    ambientGround: 0x0a1018,
    ambientIntensity: 1.7,
    sunColor: 0xf0fbff,
    sunIntensity: 1.9,
    shardColor: 0x9af6ff,
    shardEmissive: 0x23879b,
    trimA: 0x5ae5ff,
    trimB: 0xff8b62,
    glowColumnA: 0x60ebff,
    glowColumnB: 0xff9066,
    ringMainColor: 0x8af6ff,
    ringMainEmissive: 0x1d7f93,
    ringSubColor: 0xff9f75,
    ringSubEmissive: 0xa33812,
    arenaGlowColor: 0x35dff5,
  },
  {
    name: "Ember Wastes",
    floor: 0x2a1510,
    floorEmissive: 0x1a0c08,
    fog: 0x1a0a05,
    background: 0x1a0a05,
    gridMain: 0xff6633,
    gridSecondary: 0x4a2211,
    wallColor: 0x5a2e1e,
    wallEmissive: 0x2a1008,
    obstacleColors: [0x3b1e14, 0x4a2818, 0x33180e, 0x502a16, 0x3a1c10],
    accentA: 0xff5522,
    accentB: 0xffaa33,
    ambientSky: 0xffa477,
    ambientGround: 0x150805,
    ambientIntensity: 1.4,
    sunColor: 0xffccaa,
    sunIntensity: 2.2,
    shardColor: 0xff8844,
    shardEmissive: 0x993311,
    trimA: 0xff6622,
    trimB: 0xffbb44,
    glowColumnA: 0xff7733,
    glowColumnB: 0xffaa22,
    ringMainColor: 0xff8844,
    ringMainEmissive: 0x993311,
    ringSubColor: 0xffcc66,
    ringSubEmissive: 0x885500,
    arenaGlowColor: 0xff6633,
  },
  {
    name: "Void Nexus",
    floor: 0x0f0a1f,
    floorEmissive: 0x08051a,
    fog: 0x08041a,
    background: 0x08041a,
    gridMain: 0xaa66ff,
    gridSecondary: 0x2a1444,
    wallColor: 0x3a1e5a,
    wallEmissive: 0x150a2a,
    obstacleColors: [0x1e0e3b, 0x2a1448, 0x180c33, 0x301850, 0x22103a],
    accentA: 0xbb77ff,
    accentB: 0xff55aa,
    ambientSky: 0xcc99ff,
    ambientGround: 0x080418,
    ambientIntensity: 1.3,
    sunColor: 0xeeccff,
    sunIntensity: 1.6,
    shardColor: 0xcc88ff,
    shardEmissive: 0x6622aa,
    trimA: 0xbb77ff,
    trimB: 0xff55aa,
    glowColumnA: 0xcc88ff,
    glowColumnB: 0xff66bb,
    ringMainColor: 0xcc88ff,
    ringMainEmissive: 0x6622aa,
    ringSubColor: 0xff77cc,
    ringSubEmissive: 0x992266,
    arenaGlowColor: 0xaa55ff,
  },
];

function getBiomeForStage(stage) {
  return BIOMES[Math.floor((stage - 1) / 3) % BIOMES.length];
}

/* ── Enemy Types ── */
const ENEMY_TYPES = {
  drone: {
    name: "Drone",
    geometryFactory: () => new THREE.IcosahedronGeometry(0.78, 0),
    color: 0xff6f53,
    emissive: 0x7a1f0a,
    eyeWidth: 0.72,
    radius: 0.72,
    baseSpeed: 2.2,
    stageSpeedBonus: 0.12,
    hp: 1,
    damage: 18,
    attackRange: 1.7,
    scoreValue: 100,
    behavior: "chase",
    bobAmplitude: 0.18,
    spinX: 0.9,
    spinY: 1.55,
    minimapColor: "#ff8858",
  },
  scout: {
    name: "Scout",
    geometryFactory: () => new THREE.TetrahedronGeometry(0.55, 0),
    color: 0x44ffaa,
    emissive: 0x117744,
    eyeWidth: 0.48,
    radius: 0.5,
    baseSpeed: 3.2,
    stageSpeedBonus: 0.1,
    hp: 1,
    damage: 6,
    attackRange: 1.5,
    scoreValue: 150,
    behavior: "strafe",
    bobAmplitude: 0.25,
    spinX: 2.2,
    spinY: 3.0,
    minimapColor: "#44ffaa",
  },
  tank: {
    name: "Heavy",
    geometryFactory: () => new THREE.DodecahedronGeometry(1.1, 0),
    color: 0xff4444,
    emissive: 0x880000,
    eyeWidth: 0.92,
    radius: 1.05,
    baseSpeed: 1.2,
    stageSpeedBonus: 0.06,
    hp: 4,
    damage: 20,
    attackRange: 2.0,
    scoreValue: 300,
    behavior: "chase",
    bobAmplitude: 0.08,
    spinX: 0.3,
    spinY: 0.5,
    minimapColor: "#ff4444",
  },
  turret: {
    name: "Turret",
    geometryFactory: () => new THREE.OctahedronGeometry(0.7, 0),
    color: 0xffaa22,
    emissive: 0x884400,
    eyeWidth: 0.6,
    radius: 0.65,
    baseSpeed: 1.6,
    stageSpeedBonus: 0.08,
    hp: 2,
    damage: 12,
    attackRange: 1.7,
    scoreValue: 200,
    behavior: "ranged",
    projectileSpeed: 10,
    projectileDamage: 5,
    fireInterval: 3.0,
    preferredRange: 12,
    bobAmplitude: 0.12,
    spinX: 0.6,
    spinY: 1.2,
    minimapColor: "#ffaa22",
  },
};

function getSpawnComposition(stage) {
  const total = 3 + stage * 2;
  if (stage <= 3) return { drone: total, scout: 0, tank: 0, turret: 0 };
  if (stage <= 5) return { drone: total - 2, scout: 2, tank: 0, turret: 0 };
  if (stage <= 7) {
    return {
      drone: Math.ceil(total * 0.45),
      scout: Math.floor(total * 0.25),
      tank: Math.floor(total * 0.1) || 1,
      turret: Math.ceil(total * 0.15) || 1,
    };
  }
  return {
    drone: Math.ceil(total * 0.35),
    scout: Math.floor(total * 0.25),
    tank: Math.floor(total * 0.15),
    turret: Math.ceil(total * 0.2),
  };
}

/* ── UI References ── */
const ui = {
  app: document.querySelector("#app"),
  score: document.querySelector("#score"),
  stage: document.querySelector("#stage"),
  health: document.querySelector("#health"),
  status: document.querySelector("#status"),
  objective: document.querySelector("#objective"),
  minimap: document.querySelector("#minimap"),
  minimapCaption: document.querySelector("#minimap-caption"),
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
  waveBanner: document.querySelector("#wave-banner"),
  waveBannerText: document.querySelector("#wave-banner-text"),
  waveBannerSub: document.querySelector("#wave-banner-sub"),
};

/* ── Renderer ── */
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
const minimapPoint = new THREE.Vector2();
const minimapPointAlt = new THREE.Vector2();
const minimapTargetPoint = new THREE.Vector2();

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
};

const touchInput = {
  enabled:
    FORCE_TOUCH || ((HAS_COARSE_POINTER || HAS_TOUCH_POINTS) && !HAS_FINE_POINTER),
  sessionActive: false,
  moveTouchId: null,
  lookTouchId: null,
  moveX: 0,
  moveY: 0,
  lastLookX: 0,
  lastLookY: 0,
  lastLookTime: 0,
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
  screenShake: 0,
};

const obstacles = [];
const enemies = [];
const enemyProjectiles = [];
const particles = [];
const healthPickups = [];
const worldEffects = [];
const navigationColliders = [];
const worldRaycastTargets = [];
const minimapWalls = [];
const minimap = {
  canvas: ui.minimap,
  caption: ui.minimapCaption,
  ctx: ui.minimap?.getContext("2d") ?? null,
  width: ui.minimap?.width ?? 200,
  height: ui.minimap?.height ?? 200,
  dpr: 1,
  padding: 14,
};
let skyShards = null;

/* ── World object references for biome swaps ── */
const worldObjects = {
  floor: null,
  floorMaterial: null,
  grid: null,
  ambient: null,
  sun: null,
  arenaGlow: null,
  walls: [],
  wallTrims: [],
  obstacles: [],
  obstacleAccents: [],
  glowStrips: [],
  glowColumns: [],
  shardMaterial: null,
  mainRing: null,
  subRing: null,
};

/* ── Shared geometries for particles (performance) ── */
const particleGeo = new THREE.SphereGeometry(0.06, 6, 6);
const projectileGeo = new THREE.SphereGeometry(0.12, 8, 8);
const healthPickupGeo = new THREE.OctahedronGeometry(0.35, 0);

/* ── Init ── */
buildWorld();
const weapon = createWeapon();
const stageGoal = createStageGoal();
camera.add(weapon.group);
resetRun();
attachEvents();
resizeMinimapCanvas();
animate();

/* ══════════════════════════════════════════
   WORLD BUILDING
   ══════════════════════════════════════════ */

function buildWorld() {
  const ambient = new THREE.HemisphereLight(0xa6f7ff, 0x0a1018, 1.7);
  scene.add(ambient);
  worldObjects.ambient = ambient;

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
  worldObjects.sun = sun;

  const arenaGlow = new THREE.PointLight(0x35dff5, 28, 80, 2);
  arenaGlow.position.set(0, 7, -12);
  scene.add(arenaGlow);
  worldObjects.arenaGlow = arenaGlow;

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x112335,
    emissive: 0x07131f,
    emissiveIntensity: 0.34,
    roughness: 0.9,
    metalness: 0.18,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  worldRaycastTargets.push(floor);
  worldObjects.floor = floor;
  worldObjects.floorMaterial = floorMaterial;

  const grid = new THREE.GridHelper(72, 72, 0x72f0ff, 0x1c4362);
  grid.position.y = 0.02;
  grid.material.opacity = 0.34;
  grid.material.transparent = true;
  scene.add(grid);
  worldObjects.grid = grid;

  worldEffects.push((elapsed) => {
    floorMaterial.emissiveIntensity = 0.28 + Math.sin(elapsed * 0.9) * 0.05;
    if (Array.isArray(grid.material)) {
      grid.material.forEach((m) => { m.opacity = 0.28 + Math.sin(elapsed * 0.6) * 0.05; });
    } else {
      grid.material.opacity = 0.28 + Math.sin(elapsed * 0.6) * 0.05;
    }
  });

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
  worldObjects.mainRing = mainRing;

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
  worldObjects.subRing = subRing;

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
  worldRaycastTargets.push(backPillar);
  navigationColliders.push({
    minX: -3.35,
    maxX: 3.35,
    minZ: -17.35,
    maxZ: -10.65,
  });

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

  skyShards = new THREE.Group();
  const shardGeometry = new THREE.OctahedronGeometry(0.36, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x9af6ff,
    emissive: 0x23879b,
    emissiveIntensity: 1.6,
    roughness: 0.15,
    metalness: 0.88,
  });
  worldObjects.shardMaterial = shardMaterial;

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
    skyShards.add(shard);
  }

  skyShards.name = "sky-shards";
  scene.add(skyShards);
}

/* ── Apply biome colors to existing world objects ── */
function applyBiome(biome) {
  scene.background.set(biome.background);
  scene.fog.color.set(biome.fog);

  worldObjects.floorMaterial.color.set(biome.floor);
  worldObjects.floorMaterial.emissive.set(biome.floorEmissive);

  // Grid helper has array of materials [main, secondary]
  if (Array.isArray(worldObjects.grid.material)) {
    worldObjects.grid.material[0].color.set(biome.gridMain);
    worldObjects.grid.material[1].color.set(biome.gridSecondary);
  } else {
    worldObjects.grid.material.color.set(biome.gridMain);
  }

  worldObjects.ambient.color.set(biome.ambientSky);
  worldObjects.ambient.groundColor.set(biome.ambientGround);
  worldObjects.ambient.intensity = biome.ambientIntensity;
  worldObjects.sun.color.set(biome.sunColor);
  worldObjects.sun.intensity = biome.sunIntensity;
  worldObjects.arenaGlow.color.set(biome.arenaGlowColor);

  for (const wall of worldObjects.walls) {
    wall.material.color.set(biome.wallColor);
    wall.material.emissive.set(biome.wallEmissive);
  }

  for (let i = 0; i < worldObjects.wallTrims.length; i++) {
    const trim = worldObjects.wallTrims[i];
    const color = i % 2 === 0 ? biome.trimA : biome.trimB;
    trim.material.color.set(color);
    trim.material.emissive.set(color);
  }

  for (let i = 0; i < worldObjects.obstacles.length; i++) {
    const obs = worldObjects.obstacles[i];
    obs.material.color.set(biome.obstacleColors[i % biome.obstacleColors.length]);
  }

  for (const accent of worldObjects.obstacleAccents) {
    accent.material.color.set(biome.accentA);
    accent.material.emissive.set(biome.accentA);
  }

  for (let i = 0; i < worldObjects.glowStrips.length; i++) {
    const strip = worldObjects.glowStrips[i];
    const color = i % 2 === 0 ? biome.accentA : biome.accentB;
    strip.material.color.set(color);
    strip.material.emissive.set(color);
  }

  for (let i = 0; i < worldObjects.glowColumns.length; i++) {
    const col = worldObjects.glowColumns[i];
    const color = i % 2 === 0 ? biome.glowColumnA : biome.glowColumnB;
    col.material.color.set(color);
    col.material.emissive.set(color);
  }

  worldObjects.shardMaterial.color.set(biome.shardColor);
  worldObjects.shardMaterial.emissive.set(biome.shardEmissive);

  worldObjects.mainRing.material.color.set(biome.ringMainColor);
  worldObjects.mainRing.material.emissive.set(biome.ringMainEmissive);
  worldObjects.subRing.material.color.set(biome.ringSubColor);
  worldObjects.subRing.material.emissive.set(biome.ringSubEmissive);
}

/* ══════════════════════════════════════════
   STAGE GOAL (Star Core)
   ══════════════════════════════════════════ */

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

/* ══════════════════════════════════════════
   WEAPON
   ══════════════════════════════════════════ */

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

/* ══════════════════════════════════════════
   WORLD BUILDERS
   ══════════════════════════════════════════ */

function createPerimeterWall(x, y, z, width, height, depth) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x315a76,
    emissive: 0x0d2031,
    emissiveIntensity: 0.34,
    roughness: 0.74,
    metalness: 0.28,
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
  worldRaycastTargets.push(mesh);
  worldObjects.walls.push(mesh);

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
  worldObjects.wallTrims.push(trim);

  worldEffects.push((elapsed) => {
    trim.material.emissiveIntensity = 0.9 + Math.sin(elapsed * 1.4 + x + z) * 0.25;
    material.emissiveIntensity = 0.28 + Math.sin(elapsed * 0.9 + x * 0.04 + z * 0.04) * 0.05;
  });

  minimapWalls.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  });
  navigationColliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
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
  worldObjects.glowStrips.push(mesh);

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
  worldObjects.glowColumns.push(mesh);

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
  worldRaycastTargets.push(mesh);
  worldObjects.obstacles.push(mesh);

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
  worldObjects.obstacleAccents.push(topAccent);

  worldEffects.push((elapsed) => {
    topAccent.material.emissiveIntensity = 1 + Math.sin(elapsed * 1.7 + x) * 0.35;
  });

  const collider = {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
  obstacles.push(collider);
  navigationColliders.push(collider);
}

/* ══════════════════════════════════════════
   EVENT HANDLERS
   ══════════════════════════════════════════ */

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

  window.addEventListener("orientationchange", () => {
    setTimeout(onResize, 100);
  });
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
  touchInput.lastLookTime = performance.now();
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
      const now = performance.now();
      const deltaTime = now - touchInput.lastLookTime;
      touchInput.lastLookX = touch.clientX;
      touchInput.lastLookY = touch.clientY;
      touchInput.lastLookTime = now;
      applyTouchLookDelta(deltaX, deltaY, deltaTime);
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
      touchInput.lastLookTime = 0;
      handled = true;
    }
  }

  if (handled) {
    event.preventDefault();
  }
}

function handleFireTouchStart(event) {
  touchInput.fireHeld = true;
  ui.fireButton.style.transform = "scale(0.88)";
  ui.fireButton.style.boxShadow =
    "0 0 24px rgba(255,136,88,0.6), inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 45px rgba(0,0,0,0.26)";
  haptic(15);
  fire();
  event.preventDefault();
  event.stopPropagation();
}

function handleFireTouchEnd(event) {
  touchInput.fireHeld = false;
  ui.fireButton.style.transform = "";
  ui.fireButton.style.boxShadow = "";
  event.preventDefault();
  event.stopPropagation();
}

function handleJumpTouchStart(event) {
  haptic(8);
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

  // Request fullscreen for immersive mobile experience
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    docEl.requestFullscreen().catch(() => {});
  } else if (docEl.webkitRequestFullscreen) {
    docEl.webkitRequestFullscreen();
  }

  // Suggest landscape if in portrait
  if (window.innerHeight > window.innerWidth) {
    setStatus("Rotate to landscape for best experience.", 3000);
  } else {
    setStatus("Touch controls live. Fast swipes for quick turns.", 1600);
  }
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
  touchInput.lastLookTime = 0;
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

  let normX = clampedX / radius;
  let normY = clampedY / radius;

  // Dead zone + quadratic response curve for precise control
  const deadZone = 0.12;
  const applyDeadZone = (v) => {
    const abs = Math.abs(v);
    if (abs < deadZone) return 0;
    const sign = Math.sign(v);
    const normalized = (abs - deadZone) / (1 - deadZone);
    return sign * normalized * normalized;
  };
  touchInput.moveX = applyDeadZone(normX);
  touchInput.moveY = applyDeadZone(normY);

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

function applyTouchLookDelta(deltaX, deltaY, deltaTime) {
  const dt = Math.max(deltaTime, TOUCH_LOOK_TUNING.minDt);
  const swipeDistance = Math.hypot(deltaX, deltaY);
  const swipeVelocity = swipeDistance / dt;
  const rawBoost =
    TOUCH_LOOK_TUNING.baseBoost +
    Math.max(0, swipeDistance - 4) * TOUCH_LOOK_TUNING.distanceBoost +
    swipeVelocity * TOUCH_LOOK_TUNING.velocityBoost;

  const boostX = Math.min(rawBoost, TOUCH_LOOK_TUNING.maxBoostX);
  const boostY = Math.min(rawBoost, TOUCH_LOOK_TUNING.maxBoostY);

  applyLookDelta(
    deltaX * boostX,
    deltaY * boostY,
    LOOK_SENSITIVITY.touchX,
    LOOK_SENSITIVITY.touchY,
  );
}

function controlsAreActive() {
  return state.isPointerLocked || touchInput.sessionActive;
}

function queueJump() {
  state.jumpQueued = true;
}

/* ══════════════════════════════════════════
   HAPTIC FEEDBACK
   ══════════════════════════════════════════ */

function haptic(durationMs = 15) {
  if (navigator.vibrate) {
    navigator.vibrate(durationMs);
  }
}

/* ══════════════════════════════════════════
   WAVE BANNER
   ══════════════════════════════════════════ */

function showWaveBanner(stage, biomeName) {
  if (!ui.waveBanner) return;
  ui.waveBannerText.textContent = `Stage ${stage}`;
  ui.waveBannerSub.textContent = biomeName;
  ui.waveBanner.classList.add("is-visible");
  setTimeout(() => {
    if (ui.waveBanner) ui.waveBanner.classList.remove("is-visible");
  }, 2000);
}

/* ══════════════════════════════════════════
   GAME LOGIC
   ══════════════════════════════════════════ */

function getStageSite(stage = state.stage) {
  return STAGE_OBJECTIVE_SITES[(stage - 1) % STAGE_OBJECTIVE_SITES.length];
}

function updateMinimapCaption() {
  if (!minimap.caption) {
    return;
  }

  const site = getStageSite();
  minimap.caption.textContent = state.objectiveActive
    ? `Star core live: ${site.mapLabel}`
    : `Next star site: ${site.mapLabel}`;
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
      enemiesRemaining === 1 ? "hostile" : "hostiles"
    } to reveal the star core near ${site.label}.`;
    return;
  }

  ui.objective.textContent = `Goal: The star core is online near ${site.label}. Move in and recover it.`;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose?.();
    }
    return;
  }

  material?.dispose?.();
}

function disposeObject3D(object) {
  if (!object) {
    return;
  }

  object.traverse((child) => {
    child.geometry?.dispose?.();
    disposeMaterial(child.material);
  });
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
  state.screenShake = 0;
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
    if (!enemy.mesh) {
      continue;
    }

    scene.remove(enemy.mesh);
    disposeObject3D(enemy.mesh);
    enemy.mesh = null;
  }

  enemies.length = 0;

  // Clear enemy projectiles
  for (const proj of enemyProjectiles) {
    scene.remove(proj.mesh);
  }
  enemyProjectiles.length = 0;
}

function clearTransientEffects() {
  for (const impact of state.impacts) {
    scene.remove(impact.mesh);
    disposeObject3D(impact.mesh);
  }

  for (const trace of state.traces) {
    scene.remove(trace.mesh);
    disposeObject3D(trace.mesh);
  }

  for (const p of particles) {
    scene.remove(p.mesh);
  }

  for (const hp of healthPickups) {
    scene.remove(hp.mesh);
  }

  state.impacts = [];
  state.traces = [];
  particles.length = 0;
  healthPickups.length = 0;
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

  // Apply biome
  const biome = getBiomeForStage(stage);
  applyBiome(biome);

  // Spawn enemies by type
  const composition = getSpawnComposition(stage);
  for (const [typeName, count] of Object.entries(composition)) {
    for (let i = 0; i < count; i++) {
      spawnEnemy(stage, typeName);
    }
  }

  updateHud();
  showWaveBanner(stage, biome.name);
  setStatus(`Stage ${stage} // ${biome.name}. Sweep the arena.`, 1200);
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
  haptic(20);
  setStatus(`Star core secured. Stage ${state.stage + 1} unlocking.`, 1400);

  const currentTicket = state.stageTicket;
  window.setTimeout(() => {
    if (!state.gameOver && currentTicket === state.stageTicket) {
      startStage(state.stage + 1);
    }
  }, 900);
}

/* ══════════════════════════════════════════
   ENEMY SPAWNING & BEHAVIOR
   ══════════════════════════════════════════ */

function spawnEnemy(stage, typeName = "drone") {
  const type = ENEMY_TYPES[typeName];
  const material = new THREE.MeshStandardMaterial({
    color: type.color,
    emissive: type.emissive,
    emissiveIntensity: 1.5 + stage * 0.05,
    roughness: 0.32,
    metalness: 0.3,
  });

  const mesh = new THREE.Mesh(type.geometryFactory(), material);
  mesh.castShadow = typeName !== "scout"; // scouts too small/fast
  mesh.receiveShadow = true;

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(type.eyeWidth, 0.12, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0xeefcff,
      emissive: 0x7cf2ff,
      emissiveIntensity: 2.4,
      roughness: 0.15,
    }),
  );
  eye.position.set(0, 0, type.radius * 0.97);
  mesh.add(eye);

  const spawnPoint = randomSpawnPoint();
  mesh.position.copy(spawnPoint);
  scene.add(mesh);

  const enemy = {
    mesh,
    type: typeName,
    speed: THREE.MathUtils.randFloat(type.baseSpeed * 0.85, type.baseSpeed * 1.15) + stage * type.stageSpeedBonus,
    bobSpeed: THREE.MathUtils.randFloat(3, 5.2),
    bobOffset: Math.random() * Math.PI * 2,
    baseY: spawnPoint.y,
    alive: true,
    hp: type.hp,
    // Strafe behavior (scout)
    strafeAngle: Math.random() * Math.PI * 2,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    dartTimer: THREE.MathUtils.randFloat(3.5, 6),
    isDarting: false,
    dartDuration: 0,
    // Ranged behavior (turret)
    fireCooldown: THREE.MathUtils.randFloat(0, type.fireInterval || 2),
  };
  mesh.userData.enemyRef = enemy;
  eye.userData.enemyRef = enemy;
  enemies.push(enemy);
}

function randomSpawnPoint() {
  const candidate = new THREE.Vector3();

  for (let attempts = 0; attempts < 80; attempts += 1) {
    candidate.set(
      THREE.MathUtils.randFloatSpread(ARENA_HALF_SIZE * 1.8),
      THREE.MathUtils.randFloat(1.2, 2.3),
      THREE.MathUtils.randFloat(-ARENA_HALF_SIZE + 3, ARENA_HALF_SIZE - 3),
    );

    if (isValidSpawnPoint(candidate, 1.8)) {
      return candidate.clone();
    }
  }

  return findFallbackSpawnPoint();
}

function isValidSpawnPoint(candidate, clearance = 1.8) {
  const playerDistance = tempVector
    .set(candidate.x - player.position.x, 0, candidate.z - player.position.z)
    .length();

  return (
    playerDistance > 10 &&
    Math.abs(candidate.x) < ARENA_HALF_SIZE - 2 &&
    Math.abs(candidate.z) < ARENA_HALF_SIZE - 2 &&
    !collidesWithColliders(candidate.x, candidate.z, clearance)
  );
}

function findFallbackSpawnPoint() {
  const candidate = new THREE.Vector3();
  let bestCandidate = null;
  let bestDistance = -Infinity;

  for (let x = -18; x <= 18; x += 6) {
    for (let z = -18; z <= 18; z += 6) {
      candidate.set(x, 1.7, z);
      if (!isValidSpawnPoint(candidate, 1.8)) {
        continue;
      }

      const distance = candidate.distanceTo(player.position);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestCandidate = candidate.clone();
      }
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return new THREE.Vector3(0, 1.7, -18);
}

/* ══════════════════════════════════════════
   SHOOTING
   ══════════════════════════════════════════ */

function fire() {
  if (!controlsAreActive() || state.gameOver || state.fireCooldown > 0) {
    return;
  }

  state.fireCooldown = FIRE_COOLDOWN;
  state.recoil = Math.min(state.recoil + 1.1, 1.4);
  state.muzzleFlash = 1;
  haptic(15);

  ui.crosshair.classList.add("damage");
  window.setTimeout(() => ui.crosshair.classList.remove("damage"), 120);

  raycaster.setFromCamera(mouseCenter, camera);

  const aliveTargets = enemies
    .filter((enemy) => enemy.alive && enemy.mesh)
    .map((enemy) => enemy.mesh);

  const intersections = raycaster.intersectObjects(
    [...aliveTargets, ...worldRaycastTargets],
    true,
  );
  const firstHit = intersections.at(0);

  if (!firstHit) {
    aimTarget.copy(raycaster.ray.origin).add(
      tempVector.copy(raycaster.ray.direction).multiplyScalar(48),
    );
    createTracer(aimTarget, false);
    setStatus("Pulse burst discharged.", 700);
    return;
  }

  const target = firstHit.object.userData.enemyRef;
  if (!target || !target.alive) {
    createTracer(firstHit.point, false);
    createImpact(firstHit.point);
    setStatus("Shot blocked by cover.", 700);
    return;
  }

  const type = ENEMY_TYPES[target.type];

  target.hp -= 1;
  createTracer(firstHit.point, true);
  createImpact(firstHit.point);

  if (target.hp <= 0) {
    // Kill
    target.alive = false;
    state.score += type.scoreValue;
    setStatus(`Direct hit. ${type.name} neutralized.`, 850);
    spawnKillParticles(target.mesh.position, type.color);
    maybeSpawnHealthPickup();
    scene.remove(target.mesh);
    disposeObject3D(target.mesh);
    target.mesh = null;
    updateHud();

    if (enemies.every((enemy) => !enemy.alive)) {
      const currentTicket = state.stageTicket;
      window.setTimeout(() => {
        if (!state.gameOver && currentTicket === state.stageTicket) {
          revealStageGoal();
        }
      }, 650);
    }
  } else {
    // Hit but not dead — flash white
    state.score += 10;
    const origColor = target.mesh.material.color.getHex();
    target.mesh.material.color.set(0xffffff);
    target.mesh.material.emissiveIntensity = 4;
    const meshRef = target.mesh;
    window.setTimeout(() => {
      if (meshRef) {
        meshRef.material.color.set(origColor);
        meshRef.material.emissiveIntensity = 1.5;
      }
    }, 80);
    setStatus(`Hit! ${type.name} damaged (${target.hp} HP left).`, 700);
    updateHud();
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

/* ══════════════════════════════════════════
   KILL PARTICLES
   ══════════════════════════════════════════ */

function spawnKillParticles(position, color) {
  const count = Math.min(10, MAX_PARTICLES - particles.length);
  if (count <= 0) return;

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.copy(position);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5,
      (Math.random() - 0.5) * 2,
    ).normalize();
    scene.add(mesh);
    particles.push({
      mesh,
      mat,
      dir,
      speed: THREE.MathUtils.randFloat(4, 8),
      age: 0,
    });
  }
}

/* ══════════════════════════════════════════
   HEALTH PICKUPS
   ══════════════════════════════════════════ */

function maybeSpawnHealthPickup() {
  if (healthPickups.length >= MAX_HEALTH_PICKUPS || Math.random() > 0.3) return;

  const mat = new THREE.MeshStandardMaterial({
    color: 0x44ff88,
    emissive: 0x11aa44,
    emissiveIntensity: 2.0,
    roughness: 0.2,
    metalness: 0.5,
  });
  const mesh = new THREE.Mesh(healthPickupGeo, mat);
  const pos = randomSpawnPoint();
  pos.y = 0.8;
  mesh.position.copy(pos);
  mesh.castShadow = true;
  scene.add(mesh);
  healthPickups.push({ mesh, mat, age: 0 });
}

/* ══════════════════════════════════════════
   ENEMY PROJECTILES
   ══════════════════════════════════════════ */

function fireEnemyProjectile(enemy) {
  if (enemyProjectiles.length >= MAX_ENEMY_PROJECTILES) return;

  const dir = new THREE.Vector3();
  dir.subVectors(player.position, enemy.mesh.position).normalize();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffaa22,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(projectileGeo, mat);
  mesh.position.copy(enemy.mesh.position);
  scene.add(mesh);
  enemyProjectiles.push({
    mesh,
    mat,
    direction: dir,
    speed: ENEMY_TYPES.turret.projectileSpeed,
    damage: ENEMY_TYPES.turret.projectileDamage,
    age: 0,
  });
}

/* ══════════════════════════════════════════
   HUD
   ══════════════════════════════════════════ */

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.stage.textContent = String(state.stage);
  ui.health.textContent = String(Math.max(0, Math.round(state.health)));
  ui.health.style.color = state.health <= 35 ? "#ff6f61" : "#ffd166";
  updateObjectiveText();
  updateMinimapCaption();
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
  resizeMinimapCanvas();

  if (touchInput.moveTouchId === null) {
    ui.moveThumb.style.transform = "translate(-50%, -50%)";
  }
}

/* ══════════════════════════════════════════
   GAME LOOP
   ══════════════════════════════════════════ */

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);

  if (skyShards) {
    skyShards.rotation.y += delta * 0.05;
  }

  updateWorldEffects();

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);

  if (controlsAreActive() && !state.gameOver) {
    updateMovement(delta);
    updateEnemies(delta);
    updateEnemyProjectiles(delta);

    if (touchInput.fireHeld) {
      fire();
    }
  }

  updateStageGoal(delta);
  updateWeapon(delta);
  updateScreenShake(delta);
  updateImpacts(delta);
  updateTraces(delta);
  updateParticles(delta);
  updateHealthPickups(delta);
  drawMinimap();

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

  if (!collidesWithColliders(proposedX, player.position.z, PLAYER_RADIUS)) {
    player.position.x = proposedX;
  }

  const proposedZ = THREE.MathUtils.clamp(
    player.position.z + offsetZ,
    -ARENA_HALF_SIZE + PLAYER_RADIUS,
    ARENA_HALF_SIZE - PLAYER_RADIUS,
  );

  if (!collidesWithColliders(player.position.x, proposedZ, PLAYER_RADIUS)) {
    player.position.z = proposedZ;
  }
}

function collidesWithColliders(x, z, radius) {
  return navigationColliders.some((collider) => {
    const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
    const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
    const dx = x - nearestX;
    const dz = z - nearestZ;

    return dx * dx + dz * dz < radius * radius;
  });
}

/* ══════════════════════════════════════════
   ENEMY UPDATE WITH BEHAVIORS
   ══════════════════════════════════════════ */

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.mesh) {
      continue;
    }

    const type = ENEMY_TYPES[enemy.type];
    const distToPlayer = enemy.mesh.position.distanceTo(player.position);

    // Behavior branching
    if (type.behavior === "chase") {
      updateChaseEnemy(enemy, delta);
    } else if (type.behavior === "strafe") {
      updateStrafeEnemy(enemy, delta, distToPlayer);
    } else if (type.behavior === "ranged") {
      updateRangedEnemy(enemy, delta, distToPlayer);
    }

    // Bobbing
    enemy.mesh.position.y =
      enemy.baseY +
      Math.sin(clock.elapsedTime * enemy.bobSpeed + enemy.bobOffset) * type.bobAmplitude;

    // Spinning
    enemy.mesh.rotation.x += delta * type.spinX;
    enemy.mesh.rotation.y += delta * type.spinY;
    enemy.mesh.material.emissiveIntensity =
      1.35 + Math.sin(clock.elapsedTime * 2.4 + enemy.bobOffset) * 0.3;

    // Contact damage
    if (distToPlayer < type.attackRange) {
      takeDamage(type.damage * delta);
    }
  }
}

function updateChaseEnemy(enemy, delta) {
  tempVector.set(
    player.position.x - enemy.mesh.position.x,
    0,
    player.position.z - enemy.mesh.position.z,
  );

  if (tempVector.lengthSq() > 0.0001) {
    tempVector.normalize().multiplyScalar(enemy.speed * delta);
    moveEnemy(enemy, tempVector.x, tempVector.z);
  }
}

function updateStrafeEnemy(enemy, delta, distToPlayer) {
  enemy.dartTimer -= delta;

  if (enemy.isDarting) {
    // Dart directly at player
    enemy.dartDuration -= delta;
    if (enemy.dartDuration <= 0) {
      enemy.isDarting = false;
      enemy.dartTimer = THREE.MathUtils.randFloat(3.5, 6);
    }
    tempVector.set(
      player.position.x - enemy.mesh.position.x,
      0,
      player.position.z - enemy.mesh.position.z,
    );
    if (tempVector.lengthSq() > 0.0001) {
      tempVector.normalize().multiplyScalar(enemy.speed * 1.5 * delta);
      moveEnemy(enemy, tempVector.x, tempVector.z);
    }
  } else {
    // Circle around player
    enemy.strafeAngle += enemy.strafeDir * delta * 1.8;

    // Move perpendicular to player direction
    const toPlayer = tempVector.set(
      player.position.x - enemy.mesh.position.x,
      0,
      player.position.z - enemy.mesh.position.z,
    );
    const dist = toPlayer.length();
    if (dist > 0.1) {
      toPlayer.normalize();
      // Perpendicular vector
      const perpX = -toPlayer.z * enemy.strafeDir;
      const perpZ = toPlayer.x * enemy.strafeDir;

      // Combine: mostly perpendicular, slight inward pull
      const inwardPull = dist > 8 ? 0.4 : dist < 4 ? -0.3 : 0.1;
      const mx = (perpX * 0.8 + toPlayer.x * inwardPull) * enemy.speed * delta;
      const mz = (perpZ * 0.8 + toPlayer.z * inwardPull) * enemy.speed * delta;
      moveEnemy(enemy, mx, mz);
    }

    // Trigger dart attack
    if (enemy.dartTimer <= 0 && distToPlayer < 15) {
      enemy.isDarting = true;
      enemy.dartDuration = 0.5;
    }
  }
}

function updateRangedEnemy(enemy, delta, distToPlayer) {
  const type = ENEMY_TYPES[enemy.type];

  // Movement: maintain preferred range
  tempVector.set(
    player.position.x - enemy.mesh.position.x,
    0,
    player.position.z - enemy.mesh.position.z,
  );

  if (tempVector.lengthSq() > 0.0001) {
    const dir = tempVector.clone().normalize();

    if (distToPlayer > type.preferredRange * 1.2) {
      // Too far, move closer
      tempVector.copy(dir).multiplyScalar(enemy.speed * delta);
      moveEnemy(enemy, tempVector.x, tempVector.z);
    } else if (distToPlayer < type.preferredRange * 0.5) {
      // Too close, back away
      tempVector.copy(dir).multiplyScalar(-enemy.speed * delta);
      moveEnemy(enemy, tempVector.x, tempVector.z);
    } else {
      // In range, strafe slightly
      const perpX = -dir.z;
      const perpZ = dir.x;
      tempVector.set(perpX, 0, perpZ).multiplyScalar(enemy.speed * 0.5 * delta);
      moveEnemy(enemy, tempVector.x, tempVector.z);
    }
  }

  // Fire projectile
  enemy.fireCooldown -= delta;
  if (enemy.fireCooldown <= 0 && distToPlayer < type.preferredRange * 1.5) {
    fireEnemyProjectile(enemy);
    enemy.fireCooldown = type.fireInterval;
  }
}

function moveEnemy(enemy, offsetX, offsetZ) {
  const type = ENEMY_TYPES[enemy.type];
  const radius = type.radius;

  const proposedX = THREE.MathUtils.clamp(
    enemy.mesh.position.x + offsetX,
    -ARENA_HALF_SIZE + radius,
    ARENA_HALF_SIZE - radius,
  );

  if (!collidesWithColliders(proposedX, enemy.mesh.position.z, radius)) {
    enemy.mesh.position.x = proposedX;
  }

  const proposedZ = THREE.MathUtils.clamp(
    enemy.mesh.position.z + offsetZ,
    -ARENA_HALF_SIZE + radius,
    ARENA_HALF_SIZE - radius,
  );

  if (!collidesWithColliders(enemy.mesh.position.x, proposedZ, radius)) {
    enemy.mesh.position.z = proposedZ;
  }
}

/* ══════════════════════════════════════════
   UPDATES
   ══════════════════════════════════════════ */

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

function updateScreenShake(delta) {
  state.screenShake = smoothTo(state.screenShake, 0, delta, 6);
  if (state.screenShake > 0.01) {
    camera.position.x = (Math.random() - 0.5) * state.screenShake * 0.5;
    camera.position.y = (Math.random() - 0.5) * state.screenShake * 0.3;
  } else {
    camera.position.x = 0;
    camera.position.y = 0;
  }
}

function updateEnemyProjectiles(delta) {
  const survivors = [];
  for (const proj of enemyProjectiles) {
    proj.age += delta;
    proj.mesh.position.addScaledVector(proj.direction, proj.speed * delta);

    // Hit player check
    if (proj.mesh.position.distanceTo(player.position) < 1.0) {
      takeDamage(proj.damage);
      scene.remove(proj.mesh);
      continue;
    }

    // Out of bounds or too old
    if (
      proj.age > 4 ||
      Math.abs(proj.mesh.position.x) > ARENA_HALF_SIZE + 5 ||
      Math.abs(proj.mesh.position.z) > ARENA_HALF_SIZE + 5
    ) {
      scene.remove(proj.mesh);
      continue;
    }

    // Pulse effect
    proj.mat.opacity = 0.7 + Math.sin(proj.age * 20) * 0.3;
    proj.mesh.scale.setScalar(1 + Math.sin(proj.age * 15) * 0.15);

    survivors.push(proj);
  }
  enemyProjectiles.length = 0;
  enemyProjectiles.push(...survivors);
}

function updateParticles(delta) {
  const survivors = [];
  for (const p of particles) {
    p.age += delta;
    p.mesh.position.addScaledVector(p.dir, p.speed * delta);
    p.speed *= 0.96;
    p.mat.opacity = Math.max(0, 1 - p.age * 2.5);
    p.mesh.scale.setScalar(Math.max(0.1, 1 - p.age * 1.8));
    if (p.age < 0.5) {
      survivors.push(p);
    } else {
      scene.remove(p.mesh);
    }
  }
  particles.length = 0;
  particles.push(...survivors);
}

function updateHealthPickups(delta) {
  const elapsed = clock.elapsedTime;
  const survivors = [];
  for (const hp of healthPickups) {
    hp.age += delta;
    hp.mesh.rotation.y = elapsed * 2.5;
    hp.mesh.position.y = 0.8 + Math.sin(elapsed * 3) * 0.15;
    hp.mat.emissiveIntensity = 1.5 + Math.sin(elapsed * 4) * 0.5;

    // Blink when about to despawn
    if (hp.age > 12) {
      hp.mesh.visible = Math.sin(hp.age * 12) > 0;
    }

    if (player.position.distanceTo(hp.mesh.position) < 1.8) {
      state.health = Math.min(100, state.health + 25);
      updateHud();
      setStatus("+25 HP restored.", 800);
      haptic(20);
      scene.remove(hp.mesh);
      continue;
    }

    if (hp.age > 15) {
      scene.remove(hp.mesh);
      continue;
    }
    survivors.push(hp);
  }
  healthPickups.length = 0;
  healthPickups.push(...survivors);
}

function resizeMinimapCanvas() {
  if (!minimap.canvas || !minimap.ctx) {
    return;
  }

  const rect = minimap.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(1, Math.round(rect.width * dpr));
  const nextHeight = Math.max(1, Math.round(rect.height * dpr));

  if (
    minimap.canvas.width !== nextWidth ||
    minimap.canvas.height !== nextHeight
  ) {
    minimap.canvas.width = nextWidth;
    minimap.canvas.height = nextHeight;
  }

  minimap.width = rect.width;
  minimap.height = rect.height;
  minimap.dpr = dpr;
}

function mapWorldToMinimap(position, target = new THREE.Vector2()) {
  const usableWidth = minimap.width - minimap.padding * 2;
  const usableHeight = minimap.height - minimap.padding * 2;
  const x =
    minimap.padding +
    ((position.x + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * usableWidth;
  const y =
    minimap.padding +
    ((position.z + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * usableHeight;

  target.set(x, y);
  return target;
}

function drawMinimapWorldRect(ctx, area, fillStyle) {
  mapWorldToMinimap(
    { x: area.minX, z: area.minZ },
    minimapPoint,
  );
  mapWorldToMinimap(
    { x: area.maxX, z: area.maxZ },
    minimapPointAlt,
  );

  const x = minimapPoint.x;
  const y = minimapPoint.y;
  const width = minimapPointAlt.x - minimapPoint.x;
  const height = minimapPointAlt.y - minimapPoint.y;

  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, width, height);
}

function drawPlayerMarker(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.rotation.y);
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6.5, 7);
  ctx.lineTo(0, 3.8);
  ctx.lineTo(-6.5, 7);
  ctx.closePath();
  ctx.fillStyle = "#f4fbff";
  ctx.shadowColor = "rgba(255,255,255,0.55)";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();
}

function drawStarMarker(ctx, x, y, radius, fillStyle, strokeStyle) {
  ctx.save();
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const spokeRadius = index % 2 === 0 ? radius : radius * 0.46;
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const px = x + Math.cos(angle) * spokeRadius;
    const py = y + Math.sin(angle) * spokeRadius;

    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = strokeStyle;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMinimap() {
  if (!minimap.canvas || !minimap.ctx) {
    return;
  }

  const ctx = minimap.ctx;
  const width = minimap.width;
  const height = minimap.height;
  const pulse = clock.elapsedTime;
  const site = getStageSite();
  const targetPosition = state.objectiveActive
    ? stageGoal.group.position
    : site.position;

  ctx.setTransform(minimap.dpr, 0, 0, minimap.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(6, 15, 27, 0.96)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(134, 244, 255, 0.1)";
  ctx.lineWidth = 1;
  const guideStep = (width - minimap.padding * 2) / 4;
  for (let index = 1; index < 4; index += 1) {
    const axis = minimap.padding + guideStep * index;
    ctx.beginPath();
    ctx.moveTo(axis, minimap.padding);
    ctx.lineTo(axis, height - minimap.padding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(minimap.padding, axis);
    ctx.lineTo(width - minimap.padding, axis);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(134, 244, 255, 0.38)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    minimap.padding,
    minimap.padding,
    width - minimap.padding * 2,
    height - minimap.padding * 2,
  );

  for (const wall of minimapWalls) {
    drawMinimapWorldRect(ctx, wall, "rgba(102, 171, 214, 0.72)");
  }

  for (const obstacle of obstacles) {
    drawMinimapWorldRect(ctx, obstacle, "rgba(34, 73, 106, 0.92)");
  }

  mapWorldToMinimap(player.position, minimapPoint);
  mapWorldToMinimap(targetPosition, minimapTargetPoint);

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash(state.objectiveActive ? [] : [5, 5]);
  ctx.strokeStyle = state.objectiveActive
    ? "rgba(255, 209, 102, 0.58)"
    : "rgba(255, 209, 102, 0.3)";
  ctx.lineWidth = 1.4;
  ctx.moveTo(minimapPoint.x, minimapPoint.y);
  ctx.lineTo(minimapTargetPoint.x, minimapTargetPoint.y);
  ctx.stroke();
  ctx.restore();

  // Draw enemies color-coded by type
  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.mesh) {
      continue;
    }

    const type = ENEMY_TYPES[enemy.type];
    mapWorldToMinimap(enemy.mesh.position, minimapPointAlt);
    ctx.beginPath();
    ctx.fillStyle = type.minimapColor;
    const dotSize = enemy.type === "tank" ? 4.5 : 3.3;
    ctx.arc(minimapPointAlt.x, minimapPointAlt.y, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw health pickups as green dots
  for (const hp of healthPickups) {
    mapWorldToMinimap(hp.mesh.position, minimapPointAlt);
    ctx.beginPath();
    ctx.fillStyle = "#44ff88";
    ctx.arc(minimapPointAlt.x, minimapPointAlt.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw enemy projectiles as small orange dots
  for (const proj of enemyProjectiles) {
    mapWorldToMinimap(proj.mesh.position, minimapPointAlt);
    ctx.beginPath();
    ctx.fillStyle = "#ffaa22";
    ctx.arc(minimapPointAlt.x, minimapPointAlt.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const objectiveRadius = state.objectiveActive
    ? 8.2 + Math.sin(pulse * 4.8) * 1.2
    : 6.8;
  drawStarMarker(
    ctx,
    minimapTargetPoint.x,
    minimapTargetPoint.y,
    objectiveRadius,
    state.objectiveActive ? "#ffd166" : "rgba(255, 209, 102, 0.42)",
    state.objectiveActive ? "#fff3b2" : "rgba(255, 243, 178, 0.46)",
  );

  ctx.beginPath();
  ctx.strokeStyle = "rgba(134, 244, 255, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.arc(
    minimapTargetPoint.x,
    minimapTargetPoint.y,
    12 + Math.sin(pulse * 3.1) * 1.6,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  drawPlayerMarker(ctx, minimapPoint.x, minimapPoint.y);

  ctx.fillStyle = "rgba(223, 242, 255, 0.72)";
  ctx.font = '700 10px "Orbitron", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("N", width / 2, 10);
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
  state.screenShake = Math.min(state.screenShake + 0.3, 0.6);
  haptic(40);
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
