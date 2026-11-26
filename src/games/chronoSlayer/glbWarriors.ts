import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { EnemyArchetype } from './models';

export const SOLDIER_GLB_URL = '/models/Soldier.glb';
export const XBOT_GLB_URL = '/models/Xbot.glb';
const SOLDIER_CDN_FALLBACK = 'https://threejs.org/examples/models/gltf/Soldier.glb';
const XBOT_CDN_FALLBACK = 'https://threejs.org/examples/models/gltf/Xbot.glb';

export type WarriorAnimState = 'idle' | 'walk' | 'run';

export interface LoadedWarriorAssets {
  soldier: GLTF | null;
  xbot: GLTF | null;
}

export interface GlbHeroController {
  root: THREE.Group;
  modelRoot: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  setAnimState: (state: WarriorAnimState) => void;
  update: (dt: number, isAttacking: boolean, comboStep: number, attackProgress: number) => void;
  flameAura: THREE.PointLight;
  bladeEdgeMat: THREE.MeshStandardMaterial;
  bladeTipMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export interface GlbEnemyController {
  root: THREE.Group;
  modelRoot: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  rightArmBone: THREE.Object3D | null;
  leftArmBone: THREE.Object3D | null;
  spineBone: THREE.Object3D | null;
  weaponGlowMat: THREE.MeshStandardMaterial;
  shoulderCrystals?: THREE.Group;
  ringMesh?: THREE.Mesh;
  hpBarGroup: THREE.Group;
  hpBarFill: THREE.Mesh;
  setAnimState: (state: WarriorAnimState) => void;
  updateHealthBar: (hp: number, maxHp: number, cameraQuat: THREE.Quaternion) => void;
  update: (
    dt: number,
    elapsed: number,
    isAttacking?: boolean,
    attackProgress?: number,
    kind?: EnemyArchetype
  ) => void;
  dispose: () => void;
}

export interface FirstPersonViewModel {
  root: THREE.Group;
  armPivot: THREE.Group;
  swordPivot: THREE.Group;
  bladeEdgeMat: THREE.MeshStandardMaterial;
  bladeTipMat: THREE.MeshStandardMaterial;
  swordLight: THREE.PointLight;
  dispose: () => void;
}

/**
 * Shared singleton geometries for cyber-tech armor attachments & weapons so spawning waves
 * creates zero redundant GPU geometry buffers.
 */
interface SharedTechGeometries {
  hilt: THREE.CylinderGeometry;
  pommel: THREE.OctahedronGeometry;
  guard: THREE.CylinderGeometry;
  spine: THREE.BoxGeometry;
  edge: THREE.BoxGeometry;
  tip: THREE.ConeGeometry;
  helmDome: THREE.CylinderGeometry;
  visorStrip: THREE.BoxGeometry;
  helmHorn: THREE.ConeGeometry;
  chestPlate: THREE.BoxGeometry;
  coreReactor: THREE.OctahedronGeometry;
  wingFin: THREE.BoxGeometry;
  pauldron: THREE.BoxGeometry;
  pauldronTrim: THREE.BoxGeometry;
  vambrace: THREE.BoxGeometry;
  conduit: THREE.BoxGeometry;
  shieldHex: THREE.CylinderGeometry;
  hammerShaft: THREE.CylinderGeometry;
  hammerHead: THREE.BoxGeometry;
  mageOrb: THREE.OctahedronGeometry;
}

let sharedGeos: SharedTechGeometries | null = null;

function getSharedTechGeos(): SharedTechGeometries {
  if (sharedGeos) return sharedGeos;
  sharedGeos = {
    hilt: new THREE.CylinderGeometry(0.026, 0.032, 0.36, 8),
    pommel: new THREE.OctahedronGeometry(0.042, 0),
    guard: new THREE.CylinderGeometry(0.085, 0.085, 0.026, 8),
    spine: new THREE.BoxGeometry(0.018, 1.32, 0.046),
    edge: new THREE.BoxGeometry(0.014, 1.34, 0.028),
    tip: new THREE.ConeGeometry(0.038, 0.28, 4),
    helmDome: new THREE.CylinderGeometry(0.115, 0.128, 0.17, 8),
    visorStrip: new THREE.BoxGeometry(0.19, 0.045, 0.14),
    helmHorn: new THREE.ConeGeometry(0.03, 0.18, 5),
    chestPlate: new THREE.BoxGeometry(0.32, 0.28, 0.24),
    coreReactor: new THREE.OctahedronGeometry(0.068, 0),
    wingFin: new THREE.BoxGeometry(0.045, 0.42, 0.16),
    pauldron: new THREE.BoxGeometry(0.18, 0.14, 0.2),
    pauldronTrim: new THREE.BoxGeometry(0.195, 0.035, 0.215),
    vambrace: new THREE.BoxGeometry(0.11, 0.24, 0.11),
    conduit: new THREE.BoxGeometry(0.03, 0.2, 0.125),
    shieldHex: new THREE.CylinderGeometry(0.32, 0.32, 0.04, 6),
    hammerShaft: new THREE.CylinderGeometry(0.026, 0.03, 1.35, 8),
    hammerHead: new THREE.BoxGeometry(0.36, 0.24, 0.24),
    mageOrb: new THREE.OctahedronGeometry(0.16, 1),
  };
  return sharedGeos;
}

/**
 * Builds a sleek, high-detail metallic 3D energy katana assembly using shared geometries.
 */
export function createEnergyKatanaMesh(
  edgeMat: THREE.MeshStandardMaterial,
  tipMat: THREE.MeshStandardMaterial,
  scaleFactor = 1.0
): { group: THREE.Group; dispose: () => void } {
  const g = getSharedTechGeos();
  const group = new THREE.Group();
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x0f121d,
    metalness: 0.55,
    roughness: 0.45,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x9aa6c4,
    metalness: 0.92,
    roughness: 0.18,
  });

  const hilt = new THREE.Mesh(g.hilt, gripMat);
  group.add(hilt);

  const pommel = new THREE.Mesh(g.pommel, edgeMat);
  pommel.position.y = -0.2;
  group.add(pommel);

  const guard = new THREE.Mesh(g.guard, titaniumMat);
  guard.position.y = 0.19;
  group.add(guard);

  const spine = new THREE.Mesh(g.spine, titaniumMat);
  spine.position.set(0, 0.86, -0.01);
  group.add(spine);

  const edge = new THREE.Mesh(g.edge, edgeMat);
  edge.position.set(0, 0.87, 0.024);
  group.add(edge);

  const tip = new THREE.Mesh(g.tip, tipMat);
  tip.scale.set(0.42, 1, 1.05);
  tip.position.set(0, 1.66, 0.006);
  group.add(tip);

  group.scale.setScalar(scaleFactor);

  const dispose = () => {
    gripMat.dispose();
    titaniumMat.dispose();
  };

  return { group, dispose };
}

function getBoneInvScale(bone: THREE.Object3D): number {
  bone.updateWorldMatrix(true, false);
  const s = new THREE.Vector3();
  bone.getWorldScale(s);
  return 1 / Math.max(0.001, s.x);
}

/**
 * Attaches bone-mounted 3D Cyber-Tech Exo-Suit Armor (helmet + glowing visor, chest reactor,
 * thruster wings, winged shoulder pauldrons, forearm gauntlets) onto any Mixamo skeleton.
 */
function attachCyberTechCostume(
  clonedScene: THREE.Object3D,
  role: 'hero' | EnemyArchetype,
  plateMat: THREE.MeshStandardMaterial,
  trimMat: THREE.MeshStandardMaterial,
  glowMat: THREE.MeshStandardMaterial
): void {
  const g = getSharedTechGeos();
  const headBone = findMixamoBone(clonedScene, ['mixamorigHead', 'Head', 'head']);
  const spineBone = findMixamoBone(clonedScene, ['mixamorigSpine2', 'Spine2', 'mixamorigSpine1', 'Spine1']);
  const leftArmBone = findMixamoBone(clonedScene, ['mixamorigLeftArm', 'LeftArm', 'upperarm_l']);
  const rightArmBone = findMixamoBone(clonedScene, ['mixamorigRightArm', 'RightArm', 'upperarm_r']);
  const leftForeArmBone = findMixamoBone(clonedScene, ['mixamorigLeftForeArm', 'LeftForeArm']);
  const rightForeArmBone = findMixamoBone(clonedScene, ['mixamorigRightForeArm', 'RightForeArm']);

  // 1. Cyber Helmet & Neon Visor on Head Bone
  if (headBone) {
    const inv = getBoneInvScale(headBone);
    const helmGroup = new THREE.Group();
    helmGroup.scale.setScalar(inv);
    helmGroup.position.set(0, 0.1 * inv, 0);

    const helm = new THREE.Mesh(g.helmDome, plateMat);
    helm.position.set(0, 0.03, 0);
    helmGroup.add(helm);

    const visor = new THREE.Mesh(g.visorStrip, glowMat);
    visor.position.set(0, 0.02, 0.09);
    helmGroup.add(visor);

    if (role === 'hero') {
      // Twin cyber crest fins on hero helmet
      const leftCrest = new THREE.Mesh(g.helmHorn, trimMat);
      leftCrest.position.set(-0.08, 0.14, -0.02);
      leftCrest.rotation.set(-0.45, 0, 0.35);
      helmGroup.add(leftCrest);

      const rightCrest = new THREE.Mesh(g.helmHorn, trimMat);
      rightCrest.position.set(0.08, 0.14, -0.02);
      rightCrest.rotation.set(-0.45, 0, -0.35);
      helmGroup.add(rightCrest);
    } else if (role === 'stalker' || role === 'boss') {
      // Menacing demonic cyber-horns on villains
      const hornScale = role === 'boss' ? 1.8 : 1.15;
      const lh = new THREE.Mesh(g.helmHorn, glowMat);
      lh.scale.setScalar(hornScale);
      lh.position.set(-0.095, 0.14, 0.03);
      lh.rotation.set(0.35, 0, 0.42);
      helmGroup.add(lh);

      const rh = new THREE.Mesh(g.helmHorn, glowMat);
      rh.scale.setScalar(hornScale);
      rh.position.set(0.095, 0.14, 0.03);
      rh.rotation.set(0.35, 0, -0.42);
      helmGroup.add(rh);

      if (role === 'boss') {
        const crown = new THREE.Mesh(g.helmHorn, glowMat);
        crown.scale.set(1.4, 2.2, 1.4);
        crown.position.set(0, 0.19, 0.02);
        helmGroup.add(crown);
      }
    }

    headBone.add(helmGroup);
  }

  // 2. Layered Chest Exo-Plate, Arc Reactor Core & Back Cyber Thruster Wings on Spine2
  if (spineBone) {
    const inv = getBoneInvScale(spineBone);
    const chestGroup = new THREE.Group();
    chestGroup.scale.setScalar(inv * (role === 'juggernaut' || role === 'boss' ? 1.25 : 1.0));
    chestGroup.position.set(0, 0.06 * inv, 0);

    const chest = new THREE.Mesh(g.chestPlate, plateMat);
    chestGroup.add(chest);

    const reactor = new THREE.Mesh(g.coreReactor, glowMat);
    reactor.position.set(0, 0.03, 0.125);
    chestGroup.add(reactor);

    // Back spine cyber-wings / chrono fins (especially visible in 3rd-person camera!)
    const wingScale = role === 'boss' ? 2.1 : role === 'hero' ? 1.15 : role === 'stalker' ? 0.95 : 1.1;
    const leftWing = new THREE.Mesh(g.wingFin, plateMat);
    leftWing.scale.setScalar(wingScale);
    leftWing.position.set(-0.16, 0.12, -0.17);
    leftWing.rotation.set(-0.35, -0.25, 0.45);
    chestGroup.add(leftWing);

    const leftWingEdge = new THREE.Mesh(g.conduit, glowMat);
    leftWingEdge.scale.set(0.7, wingScale * 1.5, 0.5);
    leftWingEdge.position.set(-0.19, 0.12, -0.21);
    leftWingEdge.rotation.copy(leftWing.rotation);
    chestGroup.add(leftWingEdge);

    const rightWing = new THREE.Mesh(g.wingFin, plateMat);
    rightWing.scale.setScalar(wingScale);
    rightWing.position.set(0.16, 0.12, -0.17);
    rightWing.rotation.set(-0.35, 0.25, -0.45);
    chestGroup.add(rightWing);

    const rightWingEdge = new THREE.Mesh(g.conduit, glowMat);
    rightWingEdge.scale.set(0.7, wingScale * 1.5, 0.5);
    rightWingEdge.position.set(0.19, 0.12, -0.21);
    rightWingEdge.rotation.copy(rightWing.rotation);
    chestGroup.add(rightWingEdge);

    spineBone.add(chestGroup);
  }

  // 3. Armored Shoulder Pauldrons on Left/Right Upper Arms
  const attachPauldron = (armBone: THREE.Object3D | null, side: -1 | 1) => {
    if (!armBone) return;
    const inv = getBoneInvScale(armBone);
    const pGroup = new THREE.Group();
    const pScale = role === 'juggernaut' || role === 'boss' ? 1.45 : 1.05;
    pGroup.scale.setScalar(inv * pScale);
    pGroup.position.set(0, 0.04 * inv, 0);

    const pad = new THREE.Mesh(g.pauldron, plateMat);
    pad.rotation.z = side * -0.25;
    pGroup.add(pad);

    const trim = new THREE.Mesh(g.pauldronTrim, glowMat);
    trim.position.y = 0.055;
    trim.rotation.z = side * -0.25;
    pGroup.add(trim);

    armBone.add(pGroup);
  };
  attachPauldron(leftArmBone, -1);
  attachPauldron(rightArmBone, 1);

  // 4. Tech Forearm Vambraces + Juggernaut Energy Shield
  const attachVambrace = (foreArmBone: THREE.Object3D | null, withShield: boolean) => {
    if (!foreArmBone) return;
    const inv = getBoneInvScale(foreArmBone);
    const vGroup = new THREE.Group();
    vGroup.scale.setScalar(inv);
    vGroup.position.set(0, 0.11 * inv, 0);

    const guard = new THREE.Mesh(g.vambrace, plateMat);
    vGroup.add(guard);

    const strip = new THREE.Mesh(g.conduit, glowMat);
    vGroup.add(strip);

    if (withShield) {
      const shield = new THREE.Mesh(g.shieldHex, glowMat);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.14, 0.02, 0.05);
      vGroup.add(shield);
    }

    foreArmBone.add(vGroup);
  };
  attachVambrace(leftForeArmBone, role === 'juggernaut');
  attachVambrace(rightForeArmBone, false);
}

/**
 * Loads Soldier.glb and Xbot.glb from local /models/*.glb (offline PWA precached) with CDN fallback.
 */
export async function loadWarriorGlbModels(
  onProgress: (percent: number, label: string) => void
): Promise<LoadedWarriorAssets> {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => url);

  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');

  let soldierDone = 0;
  let xbotDone = 0;
  const emitProgress = (label: string) => {
    const pct = Math.min(99, Math.round(((soldierDone + xbotDone) / 2) * 100));
    onProgress(pct, label);
  };

  const loadWithTimeout = (url: string, label: string, onPct: (p: number) => void) =>
    new Promise<GLTF | null>((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 9500);

      loader.load(
        url,
        (gltf) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          onPct(1);
          emitProgress(label);
          resolve(gltf);
        },
        (evt) => {
          if (evt.total > 0) {
            onPct(Math.min(0.95, evt.loaded / evt.total));
            emitProgress(label);
          }
        },
        () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          onPct(1);
          resolve(null);
        }
      );
    });

  emitProgress('Loading 3D Cyber-Warriors...');
  const [soldier, xbot] = await Promise.all([
    loadWithTimeout(SOLDIER_GLB_URL, 'Loading Tactical Exo-Suit...', (p) => {
      soldierDone = p;
    }).then(
      (res) =>
        res ??
        loadWithTimeout(SOLDIER_CDN_FALLBACK, 'Syncing Tactical Exo-Suit...', (p) => {
          soldierDone = p;
        })
    ),
    loadWithTimeout(XBOT_GLB_URL, 'Loading Cyber-Assassin Frame...', (p) => {
      xbotDone = p;
    }).then(
      (res) =>
        res ??
        loadWithTimeout(XBOT_CDN_FALLBACK, 'Syncing Cyber-Assassin Frame...', (p) => {
          xbotDone = p;
        })
    ),
  ]);
  onProgress(100, '3D Warriors Ready');
  return { soldier, xbot };
}

function findClipByRole(clips: THREE.AnimationClip[], role: WarriorAnimState): THREE.AnimationClip | null {
  if (!clips.length) return null;
  const target = role.toLowerCase();
  const exact = clips.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact;
  const partial = clips.find((c) => c.name.toLowerCase().includes(target));
  if (partial) return partial;
  if (role === 'run') {
    return clips.find((c) => c.name.toLowerCase().includes('walk')) ?? clips[0];
  }
  return clips[0];
}

function findMixamoBone(root: THREE.Object3D, candidates: string[]): THREE.Object3D | null {
  for (const name of candidates) {
    const direct = root.getObjectByName(name);
    if (direct) return direct;
  }
  let matched: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (matched) return;
    const lower = obj.name.toLowerCase();
    for (const candidate of candidates) {
      if (lower.includes(candidate.toLowerCase())) {
        matched = obj;
        return;
      }
    }
  });
  return matched;
}

/**
 * Strips muddy camo textures and applies sleek dark carbon-titanium tech armor materials
 * with glowing neon energy joints.
 */
function upgradeArmorMaterials(
  model: THREE.Object3D,
  accentHex: number,
  armorHex: number,
  emissiveIntensity: number,
  castShadows: boolean,
  sharedAccentMat: THREE.MeshStandardMaterial,
  sharedArmorMat: THREE.MeshStandardMaterial
): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadows;
    mesh.receiveShadow = castShadows;
    mesh.frustumCulled = false;

    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const meshName = `${mesh.name} ${srcMat?.name ?? ''}`.toLowerCase();
    const isJointOrAccent =
      meshName.includes('joint') ||
      meshName.includes('alpha_joints') ||
      meshName.includes('visor') ||
      meshName.includes('eye') ||
      meshName.includes('glow') ||
      meshName.includes('trim') ||
      meshName.includes('stripe');

    mesh.material = isJointOrAccent ? sharedAccentMat : sharedArmorMat;
  });

  // Keep signature cleanly utilized without unused param warnings
  void accentHex;
  void armorHex;
  void emissiveIntensity;
}

/**
 * Creates the Hero Warrior controller from Soldier.glb with full Cyber-Knight Exo-Suit armor,
 * Mixamo skeletal animations, and glowing energy katana mounted on mixamorigRightHand.
 */
export function createGlbHeroController(
  assets: LoadedWarriorAssets,
  castShadows: boolean,
  skinAccentHex = 0x00f0ff,
  skinArmorHex = 0x1d2336
): GlbHeroController | null {
  const sourceGltf = assets.soldier ?? assets.xbot;
  if (!sourceGltf) return null;

  const root = new THREE.Group();
  const clonedScene = SkeletonUtils.clone(sourceGltf.scene);

  clonedScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clonedScene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetHeight = 1.88;
  const normScale = size.y > 0.05 ? targetHeight / size.y : 1;
  clonedScene.scale.multiplyScalar(normScale);
  clonedScene.updateMatrixWorld(true);

  const postBox = new THREE.Box3().setFromObject(clonedScene);
  clonedScene.position.y -= postBox.min.y;
  clonedScene.rotation.y = Math.PI;
  root.add(clonedScene);

  const armorMat = new THREE.MeshStandardMaterial({
    color: skinArmorHex,
    metalness: 0.88,
    roughness: 0.24,
    emissive: skinAccentHex,
    emissiveIntensity: 0.16,
    envMapIntensity: 1.5,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.94,
    roughness: 0.16,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: skinAccentHex,
    emissive: skinAccentHex,
    emissiveIntensity: 2.15,
    metalness: 0.75,
    roughness: 0.2,
  });

  upgradeArmorMaterials(
    clonedScene,
    skinAccentHex,
    skinArmorHex,
    1.25,
    castShadows,
    accentMat,
    armorMat
  );

  // Mount full 3D Cyber-Knight Exo-Suit Costume onto hero skeleton bones
  attachCyberTechCostume(clonedScene, 'hero', armorMat, trimMat, accentMat);

  // Attach Glowing Energy Katana to mixamorigRightHand
  const bladeEdgeMat = new THREE.MeshStandardMaterial({
    color: skinAccentHex,
    emissive: skinAccentHex,
    emissiveIntensity: 2.6,
    metalness: 0.45,
    roughness: 0.16,
  });
  const bladeTipMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: skinAccentHex,
    emissiveIntensity: 2.3,
    metalness: 0.45,
    roughness: 0.14,
  });

  const rightHandBone = findMixamoBone(clonedScene, [
    'mixamorigRightHand',
    'RightHand',
    'hand_r',
  ]);
  const rightArmBone = findMixamoBone(clonedScene, [
    'mixamorigRightArm',
    'RightArm',
    'upperarm_r',
  ]);
  const spineBone = findMixamoBone(clonedScene, ['mixamorigSpine2', 'Spine2', 'mixamorigSpine1']);

  let katanaCleanup: (() => void) | null = null;
  if (rightHandBone) {
    const invScale = getBoneInvScale(rightHandBone);
    const katana = createEnergyKatanaMesh(bladeEdgeMat, bladeTipMat, invScale * 1.08);
    katana.group.position.set(0, 0.05 * invScale, 0.03 * invScale);
    katana.group.rotation.set(Math.PI * 0.48, 0, -Math.PI * 0.12);
    rightHandBone.add(katana.group);
    katanaCleanup = katana.dispose;
  }

  const mixer = new THREE.AnimationMixer(clonedScene);
  const actions: Partial<Record<WarriorAnimState, THREE.AnimationAction>> = {};
  (['idle', 'walk', 'run'] as WarriorAnimState[]).forEach((role) => {
    const clip = findClipByRole(sourceGltf.animations, role);
    if (clip) {
      actions[role] = mixer.clipAction(clip);
    }
  });

  let currentAnim: WarriorAnimState = 'idle';
  actions.idle?.play();

  const setAnimState = (next: WarriorAnimState) => {
    if (next === currentAnim) return;
    const prevAction = actions[currentAnim];
    const nextAction = actions[next] ?? actions.walk ?? actions.idle;
    if (nextAction && prevAction && nextAction !== prevAction) {
      nextAction.reset();
      nextAction.setEffectiveTimeScale(next === 'run' ? 1.18 : 1.0);
      nextAction.setEffectiveWeight(1);
      nextAction.play();
      prevAction.crossFadeTo(nextAction, 0.16, true);
    } else if (nextAction && !prevAction) {
      nextAction.reset().play();
    }
    currentAnim = next;
  };

  const flameAura = new THREE.PointLight(skinAccentHex, 2.2, 7.0);
  flameAura.position.set(0, 1.45, 0.55);
  root.add(flameAura);

  const update = (
    dt: number,
    isAttacking: boolean,
    comboStep: number,
    attackProgress: number
  ) => {
    mixer.update(dt);
    // Overlay dynamic right-arm + torso katana swing rotation AFTER mixer.update
    if (rightArmBone && isAttacking) {
      if (comboStep === 1) {
        rightArmBone.rotation.x += THREE.MathUtils.lerp(-1.3, 1.25, attackProgress);
        rightArmBone.rotation.z += -0.68;
        if (spineBone) spineBone.rotation.y += THREE.MathUtils.lerp(-0.35, 0.4, attackProgress);
      } else if (comboStep === 2) {
        rightArmBone.rotation.x += THREE.MathUtils.lerp(1.15, -1.35, attackProgress);
        rightArmBone.rotation.z += 0.58;
        if (spineBone) spineBone.rotation.y += THREE.MathUtils.lerp(0.4, -0.38, attackProgress);
      } else {
        rightArmBone.rotation.x += Math.sin(attackProgress * Math.PI) * -1.55;
        rightArmBone.rotation.y += (attackProgress - 0.5) * 2.4;
        if (spineBone) spineBone.rotation.x += Math.sin(attackProgress * Math.PI) * 0.28;
      }
    }
  };

  const dispose = () => {
    mixer.stopAllAction();
    katanaCleanup?.();
    armorMat.dispose();
    trimMat.dispose();
    accentMat.dispose();
    bladeEdgeMat.dispose();
    bladeTipMat.dispose();
  };

  return {
    root,
    modelRoot: clonedScene,
    mixer,
    setAnimState,
    update,
    flameAura,
    bladeEdgeMat,
    bladeTipMat,
    accentMat,
    dispose,
  };
}

/**
 * Creates a cloned rigged enemy instance with unique Cyber-Tech Villain Armor & visible
 * melee attack swing animations driven cleanly after AnimationMixer updates.
 */
export function createGlbEnemyController(
  kind: EnemyArchetype,
  assets: LoadedWarriorAssets,
  castShadows: boolean
): GlbEnemyController | null {
  const prefersXbot = kind === 'stalker' || kind === 'mage';
  const sourceGltf = prefersXbot
    ? assets.xbot ?? assets.soldier
    : assets.soldier ?? assets.xbot;
  if (!sourceGltf) return null;

  const root = new THREE.Group();
  const clonedScene = SkeletonUtils.clone(sourceGltf.scene);

  clonedScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clonedScene);
  const size = new THREE.Vector3();
  box.getSize(size);

  const desiredHeight =
    kind === 'boss' ? 3.85 : kind === 'juggernaut' ? 2.35 : kind === 'mage' ? 1.92 : 1.78;
  const normScale = size.y > 0.05 ? desiredHeight / size.y : 1;
  clonedScene.scale.multiplyScalar(normScale);
  if (kind === 'juggernaut') {
    clonedScene.scale.x *= 1.18;
    clonedScene.scale.z *= 1.14;
  }
  clonedScene.updateMatrixWorld(true);

  const postBox = new THREE.Box3().setFromObject(clonedScene);
  clonedScene.position.y -= postBox.min.y;
  clonedScene.rotation.y = Math.PI;
  root.add(clonedScene);

  const accentHex =
    kind === 'mage' ? 0xd946ef : kind === 'juggernaut' ? 0xff4500 : 0xff1e42;
  const armorHex =
    kind === 'boss' ? 0x160a1e : kind === 'juggernaut' ? 0x241a29 : 0x171122;

  const armorMat = new THREE.MeshStandardMaterial({
    color: armorHex,
    metalness: 0.86,
    roughness: 0.25,
    emissive: accentHex,
    emissiveIntensity: kind === 'boss' ? 0.24 : 0.16,
    envMapIntensity: 1.45,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.22,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: kind === 'boss' ? 2.4 : 2.0,
    metalness: 0.78,
    roughness: 0.2,
  });

  upgradeArmorMaterials(
    clonedScene,
    accentHex,
    armorHex,
    kind === 'boss' ? 1.5 : 1.15,
    castShadows,
    accentMat,
    armorMat
  );

  // Mount Villain Cyber-Tech Costume onto enemy skeleton bones
  attachCyberTechCostume(clonedScene, kind, armorMat, trimMat, accentMat);

  const bladeEdgeMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 2.5,
    metalness: 0.4,
    roughness: 0.2,
  });
  const bladeTipMat = new THREE.MeshStandardMaterial({
    color: 0xffd1d9,
    emissive: accentHex,
    emissiveIntensity: 2.3,
  });

  const rightHandBone = findMixamoBone(clonedScene, [
    'mixamorigRightHand',
    'RightHand',
    'hand_r',
  ]);
  const leftHandBone = findMixamoBone(clonedScene, [
    'mixamorigLeftHand',
    'LeftHand',
    'hand_l',
  ]);
  const rightArmBone = findMixamoBone(clonedScene, [
    'mixamorigRightArm',
    'RightArm',
    'upperarm_r',
  ]);
  const leftArmBone = findMixamoBone(clonedScene, [
    'mixamorigLeftArm',
    'LeftArm',
    'upperarm_l',
  ]);
  const spineBone = findMixamoBone(clonedScene, [
    'mixamorigSpine2',
    'Spine2',
    'mixamorigSpine1',
  ]);

  const disposables: (() => void)[] = [];
  const g = getSharedTechGeos();

  if (rightHandBone) {
    const inv = getBoneInvScale(rightHandBone);
    if (kind === 'juggernaut') {
      // Heavy Spiked Plasma Warhammer for Iron Juggernaut
      const hammerGroup = new THREE.Group();
      const shaft = new THREE.Mesh(g.hammerShaft, trimMat);
      shaft.position.y = 0.55;
      hammerGroup.add(shaft);
      const head = new THREE.Mesh(g.hammerHead, armorMat);
      head.position.y = 1.22;
      hammerGroup.add(head);
      const headCore = new THREE.Mesh(g.coreReactor, bladeEdgeMat);
      headCore.scale.setScalar(2.0);
      headCore.position.y = 1.22;
      hammerGroup.add(headCore);
      hammerGroup.scale.setScalar(inv * 1.18);
      hammerGroup.position.set(0, 0.04 * inv, 0.02 * inv);
      hammerGroup.rotation.set(Math.PI * 0.48, 0, -Math.PI * 0.1);
      rightHandBone.add(hammerGroup);
    } else if (kind === 'mage') {
      const orb = new THREE.Mesh(g.mageOrb, bladeEdgeMat);
      orb.scale.setScalar(inv * 1.15);
      orb.position.set(0, 0.08 * inv, 0.08 * inv);
      rightHandBone.add(orb);
    } else {
      const weaponScale = kind === 'boss' ? 1.75 : 0.88;
      const katana = createEnergyKatanaMesh(bladeEdgeMat, bladeTipMat, inv * weaponScale);
      katana.group.position.set(0, 0.04 * inv, 0.02 * inv);
      katana.group.rotation.set(Math.PI * 0.48, 0, -Math.PI * 0.1);
      rightHandBone.add(katana.group);
      disposables.push(katana.dispose);
    }
  }

  if (kind === 'stalker' && leftHandBone) {
    const inv = getBoneInvScale(leftHandBone);
    const offBlade = createEnergyKatanaMesh(bladeEdgeMat, bladeTipMat, inv * 0.8);
    offBlade.group.position.set(0, 0.04 * inv, 0.02 * inv);
    offBlade.group.rotation.set(Math.PI * 0.48, 0, Math.PI * 0.1);
    leftHandBone.add(offBlade.group);
    disposables.push(offBlade.dispose);
  }

  // Boss Floating Crown Crystals & Chrono Halo
  let shoulderCrystals: THREE.Group | undefined;
  let ringMesh: THREE.Mesh | undefined;
  if (kind === 'boss') {
    shoulderCrystals = new THREE.Group();
    shoulderCrystals.position.set(0, 3.65, 0);
    const crystalGeo = new THREE.OctahedronGeometry(0.28, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xd946ef,
      emissiveIntensity: 2.5,
      metalness: 0.4,
      roughness: 0.15,
    });
    const lc = new THREE.Mesh(crystalGeo, crystalMat);
    lc.position.set(-1.15, 0, 0);
    shoulderCrystals.add(lc);
    const rc = new THREE.Mesh(crystalGeo, crystalMat);
    rc.position.set(1.15, 0, 0);
    shoulderCrystals.add(rc);
    root.add(shoulderCrystals);

    const haloGeo = new THREE.TorusGeometry(1.45, 0.06, 8, 28);
    ringMesh = new THREE.Mesh(haloGeo, accentMat);
    ringMesh.position.set(0, 2.55, -0.45);
    root.add(ringMesh);
    disposables.push(() => {
      crystalGeo.dispose();
      crystalMat.dispose();
      haloGeo.dispose();
    });
  } else if (kind === 'mage') {
    const haloGeo = new THREE.TorusGeometry(0.56, 0.035, 6, 18);
    ringMesh = new THREE.Mesh(haloGeo, accentMat);
    ringMesh.position.set(0, 1.35, -0.2);
    ringMesh.rotation.x = Math.PI / 2.4;
    root.add(ringMesh);
    disposables.push(() => haloGeo.dispose());
  }

  // Floating 3D Head-Level Health Bar
  const hpBarGroup = new THREE.Group();
  const barWidth = kind === 'boss' ? 2.4 : 1.15;
  const barHeight = kind === 'boss' ? 0.18 : 0.11;
  hpBarGroup.position.set(0, desiredHeight + 0.45, 0);

  const bgGeo = new THREE.PlaneGeometry(barWidth + 0.06, barHeight + 0.05);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x07070f,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  hpBarGroup.add(new THREE.Mesh(bgGeo, bgMat));

  const fillGeo = new THREE.PlaneGeometry(barWidth, barHeight);
  fillGeo.translate(barWidth / 2, 0, 0);
  const fillMat = new THREE.MeshBasicMaterial({
    color: kind === 'boss' ? 0xff1e42 : kind === 'mage' ? 0xe879f9 : 0xff3355,
    side: THREE.DoubleSide,
  });
  const hpBarFill = new THREE.Mesh(fillGeo, fillMat);
  hpBarFill.position.set(-barWidth / 2, 0, 0.008);
  hpBarGroup.add(hpBarFill);
  root.add(hpBarGroup);

  disposables.push(() => {
    bgGeo.dispose();
    bgMat.dispose();
    fillGeo.dispose();
    fillMat.dispose();
  });

  const mixer = new THREE.AnimationMixer(clonedScene);
  const actions: Partial<Record<WarriorAnimState, THREE.AnimationAction>> = {};
  (['idle', 'walk', 'run'] as WarriorAnimState[]).forEach((role) => {
    const clip = findClipByRole(sourceGltf.animations, role);
    if (clip) {
      actions[role] = mixer.clipAction(clip);
    }
  });

  let currentAnim: WarriorAnimState = 'walk';
  const startAction = actions.walk ?? actions.run ?? actions.idle;
  startAction?.play();

  const setAnimState = (next: WarriorAnimState) => {
    if (next === currentAnim) return;
    const prevAction = actions[currentAnim];
    const nextAction = actions[next] ?? actions.walk ?? actions.idle;
    if (nextAction && prevAction && nextAction !== prevAction) {
      nextAction.reset();
      nextAction.setEffectiveTimeScale(next === 'run' ? 1.15 : 0.95);
      nextAction.setEffectiveWeight(1);
      nextAction.play();
      prevAction.crossFadeTo(nextAction, 0.18, true);
    } else if (nextAction && !prevAction) {
      nextAction.reset().play();
    }
    currentAnim = next;
  };

  const updateHealthBar = (hp: number, maxHp: number, cameraQuat: THREE.Quaternion) => {
    if (hp <= 0) {
      hpBarGroup.visible = false;
      return;
    }
    const ratio = Math.max(0.001, Math.min(1, hp / Math.max(1, maxHp)));
    hpBarFill.scale.x = ratio;
    hpBarGroup.quaternion.copy(cameraQuat);
    hpBarGroup.visible = true;
  };

  const update = (
    dt: number,
    elapsed: number,
    isAttacking = false,
    attackProgress = 0,
    enemyKind: EnemyArchetype = kind
  ) => {
    mixer.update(dt);

    // Apply unmistakable enemy melee / cast animation AFTER mixer.update so skeleton pose never overwrites it
    if (isAttacking && rightArmBone) {
      const p = Math.max(0, Math.min(1, attackProgress));
      if (enemyKind === 'mage') {
        // Raise arm & thrust forward to cast void orb
        const arc = Math.sin(p * Math.PI);
        rightArmBone.rotation.x -= arc * 1.45;
        rightArmBone.rotation.z -= arc * 0.35;
        if (spineBone) spineBone.rotation.x += arc * 0.2;
      } else {
        // Phase 1 (0..0.38): Windup raise + lean back | Phase 2 (0.38..0.76): Violent slash + lunge | Phase 3: Recover
        let armSwingX = 0;
        let armSwingZ = 0;
        let torsoLeanX = 0;
        if (p < 0.38) {
          const w = p / 0.38;
          armSwingX = THREE.MathUtils.lerp(0, -1.65, w);
          armSwingZ = THREE.MathUtils.lerp(0, -0.55, w);
          torsoLeanX = THREE.MathUtils.lerp(0, -0.24, w);
        } else if (p < 0.76) {
          const s = (p - 0.38) / 0.38;
          armSwingX = THREE.MathUtils.lerp(-1.65, 1.35, s);
          armSwingZ = THREE.MathUtils.lerp(-0.55, 0.45, s);
          torsoLeanX = THREE.MathUtils.lerp(-0.24, 0.36, s);
        } else {
          const r = (p - 0.76) / 0.24;
          armSwingX = THREE.MathUtils.lerp(1.35, 0, r);
          armSwingZ = THREE.MathUtils.lerp(0.45, 0, r);
          torsoLeanX = THREE.MathUtils.lerp(0.36, 0, r);
        }
        rightArmBone.rotation.x += armSwingX;
        rightArmBone.rotation.z += armSwingZ;
        if (leftArmBone && enemyKind === 'stalker') {
          leftArmBone.rotation.x += armSwingX * 0.85;
          leftArmBone.rotation.z -= armSwingZ * 0.85;
        }
        if (spineBone) {
          spineBone.rotation.x += torsoLeanX;
        }
      }
      bladeEdgeMat.emissiveIntensity = 4.2;
    } else {
      bladeEdgeMat.emissiveIntensity = 2.5;
    }

    if (ringMesh) {
      ringMesh.rotation.z += dt * 1.9;
    }
    if (shoulderCrystals) {
      shoulderCrystals.position.y = 3.65 + Math.sin(elapsed * 3.2) * 0.14;
      shoulderCrystals.rotation.y += dt * 1.5;
    }
  };

  const dispose = () => {
    mixer.stopAllAction();
    disposables.forEach((fn) => fn());
    armorMat.dispose();
    trimMat.dispose();
    accentMat.dispose();
    bladeEdgeMat.dispose();
    bladeTipMat.dispose();
  };

  return {
    root,
    modelRoot: clonedScene,
    mixer,
    rightArmBone,
    leftArmBone,
    spineBone,
    weaponGlowMat: bladeEdgeMat,
    shoulderCrystals,
    ringMesh,
    hpBarGroup,
    hpBarFill,
    setAnimState,
    updateHealthBar,
    update,
    dispose,
  };
}

/**
 * Detailed First-Person POV Cyber-Arm + Glowing Energy Katana mounted directly on the Camera.
 */
export function createFirstPersonViewModel(
  skinAccentHex = 0x00f0ff,
  skinArmorHex = 0x262d42
): FirstPersonViewModel {
  const root = new THREE.Group();
  root.visible = false;

  const armPivot = new THREE.Group();
  armPivot.position.set(0.36, -0.34, -0.58);
  root.add(armPivot);

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x101320,
    metalness: 0.45,
    roughness: 0.55,
  });
  const titaniumArmorMat = new THREE.MeshStandardMaterial({
    color: skinArmorHex,
    metalness: 0.88,
    roughness: 0.24,
  });
  const bladeEdgeMat = new THREE.MeshStandardMaterial({
    color: skinAccentHex,
    emissive: skinAccentHex,
    emissiveIntensity: 2.6,
    metalness: 0.45,
    roughness: 0.16,
  });
  const bladeTipMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: skinAccentHex,
    emissiveIntensity: 2.4,
  });

  const forearmGeo = new THREE.CylinderGeometry(0.062, 0.078, 0.44, 10);
  const forearm = new THREE.Mesh(forearmGeo, sleeveMat);
  forearm.rotation.x = Math.PI * 0.42;
  forearm.position.set(0.02, -0.08, 0.18);
  armPivot.add(forearm);

  const vambraceGeo = new THREE.BoxGeometry(0.11, 0.08, 0.28);
  const vambrace = new THREE.Mesh(vambraceGeo, titaniumArmorMat);
  vambrace.rotation.x = -0.2;
  vambrace.position.set(0.02, -0.02, 0.1);
  armPivot.add(vambrace);

  const conduitGeo = new THREE.BoxGeometry(0.02, 0.018, 0.24);
  const conduit = new THREE.Mesh(conduitGeo, bladeEdgeMat);
  conduit.rotation.x = -0.2;
  conduit.position.set(0.02, 0.026, 0.09);
  armPivot.add(conduit);

  const gauntletGeo = new THREE.SphereGeometry(0.064, 10, 8);
  const gauntlet = new THREE.Mesh(gauntletGeo, titaniumArmorMat);
  gauntlet.scale.set(1.05, 0.85, 1.2);
  gauntlet.position.set(0.01, 0.01, -0.04);
  armPivot.add(gauntlet);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.0, 0.02, -0.05);
  swordPivot.rotation.set(-0.34, 0.24, 0.36);
  armPivot.add(swordPivot);

  const katana = createEnergyKatanaMesh(bladeEdgeMat, bladeTipMat, 0.68);
  swordPivot.add(katana.group);

  const swordLight = new THREE.PointLight(skinAccentHex, 2.0, 4.5);
  swordLight.position.set(-0.1, 0.25, -0.35);
  root.add(swordLight);

  const dispose = () => {
    katana.dispose();
    forearmGeo.dispose();
    vambraceGeo.dispose();
    conduitGeo.dispose();
    gauntletGeo.dispose();
    sleeveMat.dispose();
    titaniumArmorMat.dispose();
    bladeEdgeMat.dispose();
    bladeTipMat.dispose();
  };

  return {
    root,
    armPivot,
    swordPivot,
    bladeEdgeMat,
    bladeTipMat,
    swordLight,
    dispose,
  };
}
