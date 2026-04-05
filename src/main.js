import * as THREE from "three";
import "./style.css";

const ARENA_HALF_SIZE = 24;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.65;
const GRAVITY = 24;
const JUMP_VELOCITY = 8.8;
const MOVE_SPEED = 8.5;
const FIRE_COOLDOWN = 0.18;

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
scene.background = new THREE.Color(0x06131f);
scene.fog = new THREE.Fog(0x06131f, 24, 70);

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
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const tempVector = new THREE.Vector3();

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
  impacts: [],
};

const obstacles = [];
const enemies = [];

buildWorld();
resetRun();
attachEvents();
animate();

function buildWorld() {
  const ambient = new THREE.HemisphereLight(0xa4f5ff, 0x0a0f19, 1.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xf4f7ff, 1.8);
  sun.position.set(-12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      color: 0x0b1720,
      roughness: 0.94,
      metalness: 0.14,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(72, 72, 0x4eb6d8, 0x173145);
  grid.position.y = 0.02;
  grid.material.opacity = 0.28;
  grid.material.transparent = true;
  scene.add(grid);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.28, 18, 96),
    new THREE.MeshStandardMaterial({
      color: 0x7cf2ff,
      emissive: 0x1d7783,
      emissiveIntensity: 2.1,
      roughness: 0.4,
      metalness: 0.7,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 6, -14);
  scene.add(ring);

  const backPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.2, 14, 18),
    new THREE.MeshStandardMaterial({
      color: 0x122537,
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

  createObstacle(-9, 2.2, -4, 4.4, 4.4, 3.2, 0x132536);
  createObstacle(8, 1.6, 5, 3.2, 3.2, 6.4, 0x12202d);
  createObstacle(-3, 1.2, 8, 8.4, 2.4, 2.4, 0x1b2f42);
  createObstacle(10, 1.8, -9, 5.4, 3.6, 3.2, 0x142a3d);
  createObstacle(-14, 1.4, 9, 3.6, 2.8, 5.8, 0x152a3a);

  const shards = new THREE.Group();
  const shardGeometry = new THREE.OctahedronGeometry(0.36, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x9af6ff,
    emissive: 0x2d93a3,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.85,
  });

  for (let index = 0; index < 80; index += 1) {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.position.set(
      THREE.MathUtils.randFloatSpread(60),
      THREE.MathUtils.randFloat(4, 18),
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

function createPerimeterWall(x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0x0f1f2d,
      roughness: 0.86,
      metalness: 0.16,
    }),
  );
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);
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
        "Lock the pointer to resume the fight inside the arena.";
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
  state.started = true;
  state.gameOver = false;
  state.health = 100;
  state.score = 0;
  state.wave = 1;
  state.fireCooldown = 0;
  state.verticalVelocity = 0;
  state.onGround = true;
  state.impacts = [];
  player.position.set(0, PLAYER_HEIGHT, 14);
  player.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  updateHud();
  setStatus("Secure the arena.");
  ui.overlayTitle.textContent = "Neon Siege";
  ui.overlayCopy.textContent =
    "A browser FPS prototype. Lock the pointer, move with WASD, jump with Space, and click to eliminate incoming drones.";
  ui.startButton.textContent = "Start mission";
  spawnWave(state.wave);
}

function clearEnemies() {
  for (const enemy of enemies) {
    scene.remove(enemy.mesh);
  }

  enemies.length = 0;
}

function spawnWave(wave) {
  setStatus(`Wave ${wave} incoming.`);
  updateHud();

  const count = 3 + wave * 2;
  for (let index = 0; index < count; index += 1) {
    spawnEnemy(wave);
  }
}

function spawnEnemy(wave) {
  const material = new THREE.MeshStandardMaterial({
    color: wave > 3 ? 0xff9270 : 0xff6f53,
    emissive: wave > 3 ? 0xa02810 : 0x741706,
    emissiveIntensity: 1.4 + wave * 0.05,
    roughness: 0.36,
    metalness: 0.28,
  });

  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.75, 0),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.12, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0xeefcff,
      emissive: 0x7cf2ff,
      emissiveIntensity: 2.3,
      roughness: 0.2,
    }),
  );
  eye.position.set(0, 0, 0.7);
  mesh.add(eye);

  const spawnPoint = randomSpawnPoint();
  mesh.position.copy(spawnPoint);
  scene.add(mesh);

  enemies.push({
    mesh,
    speed: THREE.MathUtils.randFloat(1.7, 2.6) + wave * 0.12,
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
      THREE.MathUtils.randFloat(1.2, 2.2),
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
  ui.crosshair.classList.add("damage");
  window.setTimeout(() => ui.crosshair.classList.remove("damage"), 120);

  raycaster.setFromCamera(mouseCenter, camera);

  const aliveTargets = enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => enemy.mesh);

  const intersections = raycaster.intersectObjects(aliveTargets, false);
  const firstHit = intersections.at(0);

  if (!firstHit) {
    setStatus("Missed shot.");
    return;
  }

  const target = enemies.find((enemy) => enemy.mesh === firstHit.object);
  if (!target) {
    return;
  }

  target.alive = false;
  state.score += 100;
  setStatus("Drone neutralized.");
  createImpact(firstHit.point);
  scene.remove(target.mesh);
  updateHud();

  if (enemies.every((enemy) => !enemy.alive)) {
    window.setTimeout(() => {
      if (!state.gameOver) {
        state.wave += 1;
        spawnWave(state.wave);
      }
    }, 900);
  }
}

function createImpact(position) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.04, 10, 28),
    new THREE.MeshBasicMaterial({
      color: 0x87f5ff,
      transparent: true,
      opacity: 0.95,
    }),
  );
  ring.position.copy(position);
  ring.lookAt(camera.position);
  scene.add(ring);

  state.impacts.push({
    mesh: ring,
    age: 0,
  });
}

function updateHud() {
  ui.score.textContent = String(state.score);
  ui.wave.textContent = String(state.wave);
  ui.health.textContent = String(Math.max(0, Math.round(state.health)));
  ui.health.style.color = state.health <= 35 ? "#ff7d5c" : "#ffd166";
}

function setStatus(message, timeoutMs = 0) {
  ui.status.textContent = message;

  if (state.statusTimeout) {
    window.clearTimeout(state.statusTimeout);
    state.statusTimeout = 0;
  }

  if (timeoutMs > 0) {
    state.statusTimeout = window.setTimeout(() => {
      ui.status.textContent = "Secure the arena.";
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
    skyShards.rotation.y += delta * 0.04;
  }

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);

  if (state.isPointerLocked && !state.gameOver) {
    updateMovement(delta);
    updateEnemies(delta);
  }

  updateImpacts(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
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

  if (tempVector.lengthSq() > 0) {
    tempVector.normalize().multiplyScalar(MOVE_SPEED * delta);
    movePlayer(tempVector.x, tempVector.z);
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

    enemy.mesh.rotation.x += delta * 0.8;
    enemy.mesh.rotation.y += delta * 1.4;

    const distance = enemy.mesh.position.distanceTo(player.position);
    if (distance < 1.7) {
      takeDamage(18 * delta);
    }
  }
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
    `You reached wave ${state.wave} with ${state.score} points. Lock the pointer to restart the arena.`;
  ui.startButton.textContent = "Restart mission";
}

function updateImpacts(delta) {
  const survivors = [];

  for (const impact of state.impacts) {
    impact.age += delta;
    impact.mesh.scale.setScalar(1 + impact.age * 7);
    impact.mesh.material.opacity = Math.max(0, 0.95 - impact.age * 2.2);
    impact.mesh.rotation.z += delta * 6;

    if (impact.age < 0.4) {
      survivors.push(impact);
    } else {
      scene.remove(impact.mesh);
    }
  }

  state.impacts = survivors;
}
