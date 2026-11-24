import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Flame,
  Heart,
  Home,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShieldAlert,
  Sparkles,
  Sword,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import type { GameComponentProps } from '../types';
import { checkDomainAuthorization } from '../utils/domainGuard';
import { buildWhatsAppChallengeUrl } from '../utils/playerStorage';
import { ChronoAudioEngine } from './chronoSlayer/audio';
import {
  createChronoArenaTexture,
  createEnemyRigFactory,
  createHeroKnightRig,
  type EnemyRig,
} from './chronoSlayer/models';

type SlayerPhase = 'TITLE_MENU' | 'PLAYING' | 'UPGRADE_PICK' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

type UpgradeId =
  | 'chain-lightning'
  | 'crimson-flame'
  | 'triple-dash'
  | 'vampiric-lifesteal'
  | 'attack-speed'
  | 'chrono-overcharge';

interface UpgradeCard {
  id: UpgradeId;
  title: string;
  description: string;
  accent: 'cyan' | 'crimson';
}

const UPGRADE_POOL: UpgradeCard[] = [
  {
    id: 'chain-lightning',
    title: 'Chain Lightning',
    description: 'Sword strikes arc glowing cyan lightning bolts to up to 3 nearby enemies.',
    accent: 'cyan',
  },
  {
    id: 'crimson-flame',
    title: 'Crimson Flame Blade',
    description: 'Ignites blade fiery crimson-orange, +40% sword damage, and burns enemies over time.',
    accent: 'crimson',
  },
  {
    id: 'triple-dash',
    title: 'Triple Dash',
    description: 'Grants 3 dash charges, faster recharge, and leaves damaging shadow clones behind.',
    accent: 'cyan',
  },
  {
    id: 'vampiric-lifesteal',
    title: 'Vampiric Lifesteal',
    description: 'Restores +15 HP per hit with a green & crimson healing aura burst.',
    accent: 'crimson',
  },
  {
    id: 'attack-speed',
    title: 'Attack Speed +35%',
    description: '35% faster 3-hit combo swings, 35% shorter cooldown, and wider cleave reach.',
    accent: 'cyan',
  },
  {
    id: 'chrono-overcharge',
    title: 'Chrono Overcharge',
    description: '+50% faster Cosmic Nova energy charge and instant +40 HP heal.',
    accent: 'crimson',
  },
];

interface FloatingDmg {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface EnemyEntity {
  id: number;
  kind: 'knight' | 'mage' | 'boss';
  rig: EnemyRig;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  attackCooldown: number;
  hitFlash: number;
  burnTimer: number;
  burnTickTimer: number;
  slamState: 'idle' | 'telegraph';
  slamTimer: number;
  slamTargetX: number;
  slamTargetZ: number;
}

interface PooledProjectile {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

interface PooledGhost {
  active: boolean;
  mesh: THREE.Group;
  life: number;
  isDamagingClone: boolean;
  hasDetonated: boolean;
  x: number;
  z: number;
}

interface PooledLightningBolt {
  active: boolean;
  line: THREE.Line;
  posAttr: THREE.BufferAttribute;
  life: number;
}

const ARENA_RADIUS = 18.2;
const PARTICLE_POOL_SIZE = 96;
const PROJECTILE_POOL_SIZE = 18;
const GHOST_POOL_SIZE = 14;
const LIGHTNING_POOL_SIZE = 9;

// Module-scope reusable math helpers (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();

export const ChronoSlayer3D: React.FC<GameComponentProps> = ({
  gameId,
  gameTitle,
  bestScore,
  isMuted,
  onToggleMute,
  onSessionComplete,
  onExit,
}) => {
  const domainCheck = checkDomainAuthorization();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<ChronoAudioEngine | null>(null);

  const [phase, setPhase] = useState<SlayerPhase>('TITLE_MENU');
  const phaseRef = useRef<SlayerPhase>('TITLE_MENU');

  const [hudState, setHudState] = useState({
    hp: 150,
    maxHp: 150,
    novaEnergy: 35,
    wave: 1,
    score: 0,
    combo: 1,
    maxCombo: 1,
    kills: 0,
    dashCharges: 1,
    maxDashCharges: 1,
    dashProgress: 1,
    bossHp: 0,
    bossMaxHp: 0,
    bossName: '',
    bannerText: '',
  });

  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeCard[]>([]);
  const [acquiredUpgrades, setAcquiredUpgrades] = useState<{ id: UpgradeId; count: number }[]>([]);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingDmg[]>([]);
  const [sessionRewards, setSessionRewards] = useState<{
    score: number;
    xpEarned: number;
    coinsEarned: number;
    isNewBest: boolean;
    victory: boolean;
  } | null>(null);

  // Virtual joystick visual state
  const [joyVisual, setJoyVisual] = useState({ active: false, dx: 0, dy: 0 });

  // Input + Gameplay mutable state refs
  const inputRef = useRef({
    keys: new Set<string>(),
    joyX: 0,
    joyY: 0,
    joyPointerId: null as number | null,
    joyOriginX: 0,
    joyOriginY: 0,
    attackRequested: false,
    dashRequested: false,
    novaRequested: false,
  });

  const gameRef = useRef({
    hp: 150,
    maxHp: 150,
    novaEnergy: 35,
    wave: 1,
    score: 0,
    combo: 1,
    maxCombo: 1,
    comboResetTimer: 0,
    kills: 0,
    hitsLanded: 0,
    swingsMade: 0,
    dashCharges: 1,
    maxDashCharges: 1,
    dashRechargeTimer: 0,
    dashCooldownDuration: 2.1,
    dashActiveTimer: 0,
    dashDirX: 0,
    dashDirZ: 1,
    invulnTimer: 0,
    comboStep: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0.24,
    attackCooldownTimer: 0,
    comboChainWindow: 0,
    attackBuffered: false,
    hitStopTimer: 0,
    cameraShake: 0,
    bannerTimer: 0,
    bannerText: '',
    waveTransitionTimer: 0,
    upgrades: new Map<UpgradeId, number>(),
    nextEntityId: 1,
    nextFloatId: 1,
    reportedSession: false,
    endlessMode: false,
  });

  // Scene callbacks set once during WebGL initialization
  const engineActionsRef = useRef<{
    startNewRun: () => void;
    spawnWave: (waveNum: number) => void;
    triggerAttack: () => void;
    triggerDash: () => void;
    triggerNova: () => void;
    applyUpgradeVisuals: (id: UpgradeId) => void;
  } | null>(null);

  const setSyncedPhase = useCallback((next: SlayerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new ChronoAudioEngine();
    }
    audioRef.current.setMuted(isMuted);
  }, [isMuted]);

  const finishMatch = useCallback(
    (victory: boolean) => {
      const g = gameRef.current;
      if (g.reportedSession) return;
      g.reportedSession = true;

      const accuracy =
        g.swingsMade > 0 ? Math.min(100, Math.round((g.hitsLanded / g.swingsMade) * 100)) : 85;
      const xpEarned = Math.max(
        40,
        Math.round(g.score / 12) + g.wave * 35 + (victory ? 180 : 0)
      );
      const coinsEarned = Math.max(
        15,
        Math.round(g.score / 40) + g.kills * 3 + (victory ? 120 : 0)
      );
      const isNewBest = g.score > bestScore;

      if (victory) {
        audioRef.current?.playVictoryChime();
      } else {
        audioRef.current?.playPlayerHurt();
      }

      setSessionRewards({
        score: g.score,
        xpEarned,
        coinsEarned,
        isNewBest,
        victory,
      });
      setSyncedPhase(victory ? 'VICTORY' : 'GAME_OVER');

      onSessionComplete({
        gameId,
        gameTitle,
        score: g.score,
        maxCombo: g.maxCombo,
        accuracy,
        xpEarned,
        coinsEarned,
      });
    },
    [bestScore, gameId, gameTitle, onSessionComplete, setSyncedPhase]
  );

  // Main Three.js WebGL initialization (isolated mount, zero React re-renders tearing down scene)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount || !domainCheck.authorized) return;

    const audio = audioRef.current ?? new ChronoAudioEngine();
    audioRef.current = audio;
    audio.setMuted(isMuted);

    // Software WebGL & mobile GPU detection for locked 60fps mobile performance
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const isMobileBrowser =
      typeof navigator !== 'undefined' &&
      (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.matchMedia('(pointer: coarse)').matches);

    const enableShadows = !isSoftwareGl && !isMobileBrowser;

    const width = Math.max(320, mount.clientWidth || 960);
    const height = Math.max(180, mount.clientHeight || 540);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && !isMobileBrowser,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // Cap pixelRatio <= 1.25 for butter-smooth 60fps on high-DPI mobile screens
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(width, height);
    // Disable heavy shadow maps on mobile browsers & software WebGL
    renderer.shadowMap.enabled = enableShadows;
    if (enableShadows) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.oncontextmenu = (e) => e.preventDefault();
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070f);
    scene.fog = new THREE.FogExp2(0x07070f, 0.021);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 140);
    camera.position.set(0, 11.5, 13.5);
    camera.lookAt(0, 1.2, 0);

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x6ee7ff, 0x1e0b36, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.0);
    keyLight.position.set(12, 22, 14);
    keyLight.castShadow = enableShadows;
    if (enableShadows) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 55;
      keyLight.shadow.camera.left = -22;
      keyLight.shadow.camera.right = 22;
      keyLight.shadow.camera.top = 22;
      keyLight.shadow.camera.bottom = -22;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff1e42, 1.4);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    // Extended dark horizon void floor + glowing Rune Arena disc
    const outerVoidGeo = new THREE.CircleGeometry(95, 36);
    outerVoidGeo.rotateX(-Math.PI / 2);
    const outerVoidMat = new THREE.MeshStandardMaterial({
      color: 0x06060c,
      roughness: 0.95,
      metalness: 0.1,
    });
    const outerVoidFloor = new THREE.Mesh(outerVoidGeo, outerVoidMat);
    outerVoidFloor.position.y = -0.03;
    scene.add(outerVoidFloor);

    const arenaTex = createChronoArenaTexture(renderer.capabilities.getMaxAnisotropy());
    const arenaFloorGeo = new THREE.CylinderGeometry(
      ARENA_RADIUS + 0.5,
      ARENA_RADIUS + 1.2,
      0.35,
      48
    );
    const arenaFloorMat = new THREE.MeshStandardMaterial({
      map: arenaTex,
      roughness: 0.42,
      metalness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
    arenaFloor.position.y = -0.175;
    arenaFloor.receiveShadow = enableShadows;
    scene.add(arenaFloor);

    // Glowing arena boundary ring
    const rimRingGeo = new THREE.TorusGeometry(ARENA_RADIUS + 0.15, 0.11, 8, 64);
    rimRingGeo.rotateX(Math.PI / 2);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.5,
    });
    const rimRing = new THREE.Mesh(rimRingGeo, rimRingMat);
    rimRing.position.y = 0.03;
    scene.add(rimRing);

    // 12 Obsidian Perimeter Rune Pillars
    const pillarGeo = new THREE.BoxGeometry(1.3, 6.2, 1.3);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x130d24,
      metalness: 0.75,
      roughness: 0.35,
    });
    const bandGeo = new THREE.BoxGeometry(1.38, 0.25, 1.38);
    const cyanBandMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.0,
    });
    const crimsonBandMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 2.0,
    });

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const dist = ARENA_RADIUS + 1.7;
      const px = Math.cos(ang) * dist;
      const pz = Math.sin(ang) * dist;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 3.0, pz);
      pillar.lookAt(0, 3.0, 0);
      pillar.castShadow = enableShadows;
      scene.add(pillar);

      const band = new THREE.Mesh(bandGeo, i % 2 === 0 ? cyanBandMat : crimsonBandMat);
      band.position.set(px, 4.4, pz);
      band.lookAt(0, 4.4, 0);
      scene.add(band);
    }

    // Instanced Floating Ambient Energy Motes
    const moteCount = 48;
    const moteGeo = new THREE.OctahedronGeometry(0.11, 0);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const moteInstanced = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    moteInstanced.frustumCulled = false;
    const moteData: { angle: number; radius: number; y: number; speed: number; phase: number }[] =
      [];
    for (let i = 0; i < moteCount; i++) {
      moteData.push({
        angle: Math.random() * Math.PI * 2,
        radius: 4 + Math.random() * (ARENA_RADIUS + 3),
        y: 0.5 + Math.random() * 7,
        speed: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      });
      _tmpColor.setHex(i % 2 === 0 ? 0x00f0ff : i % 3 === 0 ? 0xff1e42 : 0xa855f7);
      moteInstanced.setColorAt(i, _tmpColor);
    }
    if (moteInstanced.instanceColor) moteInstanced.instanceColor.needsUpdate = true;
    scene.add(moteInstanced);

    // Hero Shadow Knight Rig
    const heroRig = createHeroKnightRig();
    if (!enableShadows) {
      heroRig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = false;
        }
      });
    }
    scene.add(heroRig.root);

    // Contact shadow disc under hero
    const contactShadowGeo = new THREE.CircleGeometry(0.85, 20);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const heroShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    heroShadow.position.y = 0.02;
    heroRig.root.add(heroShadow);

    // Active slash trail arc mesh (reused)
    const slashArcGeo = new THREE.RingGeometry(1.5, 3.6, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);
    slashArcGeo.rotateX(-Math.PI / 2);
    const slashArcMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const slashArcMesh = new THREE.Mesh(slashArcGeo, slashArcMat);
    slashArcMesh.position.y = 1.25;
    slashArcMesh.visible = false;
    scene.add(slashArcMesh);

    // Vampiric Lifesteal Healing Aura Ring (reused)
    const healAuraGeo = new THREE.RingGeometry(0.65, 1.55, 24);
    healAuraGeo.rotateX(-Math.PI / 2);
    const healAuraMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const healAuraMesh = new THREE.Mesh(healAuraGeo, healAuraMat);
    healAuraMesh.position.y = 0.14;
    healAuraMesh.visible = false;
    scene.add(healAuraMesh);
    let healAuraTimer = 0;

    // Cosmic Nova Dome Mesh (reused)
    const novaSphereGeo = new THREE.SphereGeometry(1, 20, 14);
    const novaSphereMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      wireframe: true,
      depthWrite: false,
    });
    const novaSphere = new THREE.Mesh(novaSphereGeo, novaSphereMat);
    novaSphere.visible = false;
    scene.add(novaSphere);
    let novaAnimTimer = 0;

    // Boss Ground-Slam Telegraph Ring (reused)
    const bossTeleGeo = new THREE.RingGeometry(0.4, 4.5, 32);
    bossTeleGeo.rotateX(-Math.PI / 2);
    const bossTeleMat = new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const bossTelegraphMesh = new THREE.Mesh(bossTeleGeo, bossTeleMat);
    bossTelegraphMesh.visible = false;
    scene.add(bossTelegraphMesh);

    // === OBJECT POOLS (Zero per-frame allocations & zero scene.add/remove churn) ===

    // 1. Pooled Burst Particles via single InstancedMesh (1 draw call total)
    const particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleInstanced.frustumCulled = false;
    const particlePool: PooledParticle[] = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      particlePool.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        colorHex: 0x00f0ff,
      });
      _dummy.position.set(0, -10, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      particleInstanced.setMatrixAt(i, _dummy.matrix);
      _tmpColor.setHex(0x00f0ff);
      particleInstanced.setColorAt(i, _tmpColor);
    }
    particleInstanced.instanceMatrix.needsUpdate = true;
    if (particleInstanced.instanceColor) particleInstanced.instanceColor.needsUpdate = true;
    scene.add(particleInstanced);

    // 2. Pooled Void Mage Projectiles
    const projGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const projMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    const projectilePool: PooledProjectile[] = [];
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(projGeo, projMat);
      mesh.visible = false;
      scene.add(mesh);
      projectilePool.push({
        active: false,
        mesh,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        life: 0,
        damage: 14,
      });
    }

    // 3. Pooled Dash Ghosts / Triple-Dash Shadow Clones
    const ghostTorsoGeo = new THREE.BoxGeometry(0.76, 1.5, 0.42);
    const ghostHeadGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const ghostRingGeo = new THREE.RingGeometry(0.45, 2.3, 20);
    ghostRingGeo.rotateX(-Math.PI / 2);
    const ghostBasicMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const ghostCloneMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const ghostPool: PooledGhost[] = [];
    for (let i = 0; i < GHOST_POOL_SIZE; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(ghostTorsoGeo, ghostBasicMat);
      body.position.y = 0.85;
      group.add(body);
      const head = new THREE.Mesh(ghostHeadGeo, ghostBasicMat);
      head.position.y = 1.85;
      group.add(head);
      const cloneRing = new THREE.Mesh(ghostRingGeo, ghostCloneMat);
      cloneRing.position.y = 0.08;
      cloneRing.visible = false;
      group.add(cloneRing);
      group.visible = false;
      scene.add(group);
      ghostPool.push({
        active: false,
        mesh: group,
        life: 0,
        isDamagingClone: false,
        hasDetonated: false,
        x: 0,
        z: 0,
      });
    }

    // 4. Pooled Chain Lightning Bolts (pre-allocated Float32Array BufferAttributes)
    const lightningMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
    });
    const lightningPool: PooledLightningBolt[] = [];
    const LIGHTNING_VERTS = 6;
    for (let i = 0; i < LIGHTNING_POOL_SIZE; i++) {
      const positions = new Float32Array(LIGHTNING_VERTS * 3);
      const lineGeo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      lineGeo.setAttribute('position', posAttr);
      const line = new THREE.Line(lineGeo, lightningMat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      lightningPool.push({
        active: false,
        line,
        posAttr,
        life: 0,
      });
    }

    // Session-scoped Enemy Factory
    const enemyFactory = createEnemyRigFactory();
    let enemies: EnemyEntity[] = [];

    const floatingQueue: {
      id: number;
      worldPos: THREE.Vector3;
      text: string;
      color: string;
      ttl: number;
    }[] = [];

    const pushFloatingNumber = (
      worldX: number,
      worldY: number,
      worldZ: number,
      text: string,
      color: string
    ) => {
      floatingQueue.push({
        id: gameRef.current.nextFloatId++,
        worldPos: new THREE.Vector3(worldX, worldY, worldZ),
        text,
        color,
        ttl: 0.72,
      });
      if (floatingQueue.length > 16) floatingQueue.shift();
    };

    const spawnBurstParticles = (
      x: number,
      y: number,
      z: number,
      colorHex: number,
      count = 10
    ) => {
      let spawned = 0;
      for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) {
        const p = particlePool[i];
        if (p.active) continue;
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const ang = Math.random() * Math.PI * 2;
        const spd = 3 + Math.random() * 6.5;
        p.vx = Math.cos(ang) * spd;
        p.vy = 2.5 + Math.random() * 5;
        p.vz = Math.sin(ang) * spd;
        p.maxLife = 0.4 + Math.random() * 0.24;
        p.life = p.maxLife;
        p.colorHex = colorHex;
        _tmpColor.setHex(colorHex);
        particleInstanced.setColorAt(i, _tmpColor);
        spawned++;
      }
      if (spawned > 0 && particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }
    };

    const spawnDashGhost = (isDamagingClone: boolean) => {
      for (let i = 0; i < GHOST_POOL_SIZE; i++) {
        const gh = ghostPool[i];
        if (gh.active) continue;
        gh.active = true;
        gh.life = isDamagingClone ? 0.36 : 0.26;
        gh.isDamagingClone = isDamagingClone;
        gh.hasDetonated = false;
        gh.x = heroRig.root.position.x;
        gh.z = heroRig.root.position.z;
        gh.mesh.position.copy(heroRig.root.position);
        gh.mesh.rotation.copy(heroRig.root.rotation);
        gh.mesh.scale.setScalar(1);
        const bodyMesh = gh.mesh.children[0] as THREE.Mesh;
        const headMesh = gh.mesh.children[1] as THREE.Mesh;
        const ringMesh = gh.mesh.children[2] as THREE.Mesh;
        const matToUse = isDamagingClone ? ghostCloneMat : ghostBasicMat;
        bodyMesh.material = matToUse;
        headMesh.material = matToUse;
        ringMesh.visible = isDamagingClone;
        gh.mesh.visible = true;
        break;
      }
    };

    const spawnLightningArc = (x1: number, z1: number, x2: number, z2: number) => {
      for (let i = 0; i < LIGHTNING_POOL_SIZE; i++) {
        const bolt = lightningPool[i];
        if (bolt.active) continue;
        bolt.active = true;
        bolt.life = 0.2;
        const segments = LIGHTNING_VERTS - 1;
        for (let s = 0; s < LIGHTNING_VERTS; s++) {
          const t = s / segments;
          const jitter = s === 0 || s === segments ? 0 : (Math.random() - 0.5) * 0.85;
          bolt.posAttr.setXYZ(
            s,
            THREE.MathUtils.lerp(x1, x2, t) + jitter,
            1.15 + (s === 0 || s === segments ? 0 : Math.random() * 0.5),
            THREE.MathUtils.lerp(z1, z2, t) + jitter
          );
        }
        bolt.posAttr.needsUpdate = true;
        bolt.line.visible = true;
        break;
      }
    };

    const spawnMageProjectile = (x: number, z: number, vx: number, vz: number) => {
      for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
        const p = projectilePool[i];
        if (p.active) continue;
        p.active = true;
        p.x = x;
        p.z = z;
        p.vx = vx;
        p.vz = vz;
        p.life = 3.0;
        p.damage = 14;
        p.mesh.position.set(x, 1.35, z);
        p.mesh.visible = true;
        break;
      }
    };

    const applyUpgradeVisuals = (upgradeId?: UpgradeId) => {
      const g = gameRef.current;
      const hasFlame = (g.upgrades.get('crimson-flame') ?? 0) > 0;
      if (hasFlame) {
        // Transform greatsword cyan edge & aura into fiery crimson-orange flame!
        heroRig.cyanEdgeMat.color.setHex(0xff5500);
        heroRig.cyanEdgeMat.emissive.setHex(0xff4500);
        heroRig.cyanEdgeMat.emissiveIntensity = 3.0;
        heroRig.bladeTipMat.emissive.setHex(0xff5500);
        heroRig.bladeTipMat.emissiveIntensity = 2.8;
        heroRig.flameAura.color.setHex(0xff4500);
        heroRig.flameAura.intensity = 2.8;
      } else {
        heroRig.cyanEdgeMat.color.setHex(0x00f0ff);
        heroRig.cyanEdgeMat.emissive.setHex(0x00f0ff);
        heroRig.cyanEdgeMat.emissiveIntensity = 2.2;
        heroRig.bladeTipMat.emissive.setHex(0x00f0ff);
        heroRig.bladeTipMat.emissiveIntensity = 1.8;
        heroRig.flameAura.color.setHex(0x00f0ff);
        heroRig.flameAura.intensity = 2.0;
      }

      if (upgradeId === 'vampiric-lifesteal' || upgradeId === 'chrono-overcharge') {
        healAuraMesh.visible = true;
        healAuraMesh.position.set(heroRig.root.position.x, 0.14, heroRig.root.position.z);
        healAuraMesh.scale.setScalar(1);
        healAuraMat.opacity = 0.9;
        healAuraTimer = 0.35;
      }
    };

    const clearDynamicEntities = () => {
      enemies.forEach((e) => {
        scene.remove(e.rig.root);
      });
      enemies = [];
      bossTelegraphMesh.visible = false;

      for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
        projectilePool[i].active = false;
        projectilePool[i].mesh.visible = false;
      }
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        particlePool[i].active = false;
        _dummy.position.set(0, -10, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummy.matrix);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < GHOST_POOL_SIZE; i++) {
        ghostPool[i].active = false;
        ghostPool[i].mesh.visible = false;
      }
      for (let i = 0; i < LIGHTNING_POOL_SIZE; i++) {
        lightningPool[i].active = false;
        lightningPool[i].line.visible = false;
      }
      healAuraMesh.visible = false;
      healAuraTimer = 0;
    };

    const spawnWave = (waveNum: number) => {
      const g = gameRef.current;
      g.wave = waveNum;

      const isBossWave = waveNum % 5 === 0;
      const knightCount = isBossWave ? 2 : 3 + waveNum * 2;
      const mageCount = waveNum >= 2 ? (isBossWave ? 1 : Math.min(5, waveNum)) : 0;

      const placeAtPerimeter = (idx: number, total: number, minDist = 11, maxDist = 15.5) => {
        const ang = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.4;
        const r = minDist + Math.random() * (maxDist - minDist);
        return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
      };

      const totalRegular = knightCount + mageCount;
      for (let i = 0; i < knightCount; i++) {
        const pos = placeAtPerimeter(i, totalRegular);
        const rig = enemyFactory.spawn('knight', enableShadows);
        rig.root.position.set(pos.x, 0, pos.z);
        scene.add(rig.root);
        const maxHp = 85 + waveNum * 22;
        enemies.push({
          id: g.nextEntityId++,
          kind: 'knight',
          rig,
          hp: maxHp,
          maxHp,
          speed: 3.4 + Math.min(1.8, waveNum * 0.25),
          radius: 0.72,
          attackCooldown: 0.6 + Math.random() * 0.6,
          hitFlash: 0,
          burnTimer: 0,
          burnTickTimer: 0,
          slamState: 'idle',
          slamTimer: 0,
          slamTargetX: 0,
          slamTargetZ: 0,
        });
      }

      for (let i = 0; i < mageCount; i++) {
        const pos = placeAtPerimeter(knightCount + i, totalRegular, 12.5, 16.2);
        const rig = enemyFactory.spawn('mage', enableShadows);
        rig.root.position.set(pos.x, 0, pos.z);
        scene.add(rig.root);
        const maxHp = 65 + waveNum * 16;
        enemies.push({
          id: g.nextEntityId++,
          kind: 'mage',
          rig,
          hp: maxHp,
          maxHp,
          speed: 2.5 + Math.min(1.0, waveNum * 0.12),
          radius: 0.68,
          attackCooldown: 1.4 + Math.random() * 1.1,
          hitFlash: 0,
          burnTimer: 0,
          burnTickTimer: 0,
          slamState: 'idle',
          slamTimer: 0,
          slamTargetX: 0,
          slamTargetZ: 0,
        });
      }

      if (isBossWave) {
        const bossRig = enemyFactory.spawn('boss', enableShadows);
        bossRig.root.position.set(0, 0, -12);
        scene.add(bossRig.root);
        const bossHp = 1150 + Math.max(0, waveNum - 5) * 280;
        enemies.push({
          id: g.nextEntityId++,
          kind: 'boss',
          rig: bossRig,
          hp: bossHp,
          maxHp: bossHp,
          speed: 2.85,
          radius: 1.55,
          attackCooldown: 2.2,
          hitFlash: 0,
          burnTimer: 0,
          burnTickTimer: 0,
          slamState: 'idle',
          slamTimer: 0,
          slamTargetX: 0,
          slamTargetZ: 0,
        });
        g.bannerText = `WAVE ${waveNum} · VOID TITAN AWAKENS`;
        g.bannerTimer = 2.8;
      } else {
        g.bannerText = `WAVE ${waveNum} · ENGAGE`;
        g.bannerTimer = 2.1;
      }
    };

    const triggerLifestealHeal = (healAmount: number) => {
      const g = gameRef.current;
      g.hp = Math.min(g.maxHp, g.hp + healAmount);
      healAuraMesh.visible = true;
      healAuraMesh.position.set(heroRig.root.position.x, 0.14, heroRig.root.position.z);
      healAuraMesh.scale.setScalar(0.8);
      healAuraMat.opacity = 0.92;
      healAuraTimer = 0.34;
      spawnBurstParticles(heroRig.root.position.x, 1.1, heroRig.root.position.z, 0x10b981, 6);
      pushFloatingNumber(
        heroRig.root.position.x,
        2.5,
        heroRig.root.position.z,
        `+${healAmount} HP`,
        '#34D399'
      );
    };

    const damageEnemy = (
      enemy: EnemyEntity,
      rawDmg: number,
      knockbackStrength: number,
      hitColor = '#FFFFFF',
      allowVampiric = true
    ) => {
      const g = gameRef.current;
      const dmg = Math.round(rawDmg);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      enemy.hitFlash = 0.14;

      const flameStacks = g.upgrades.get('crimson-flame') ?? 0;
      if (flameStacks > 0 && enemy.hp > 0) {
        enemy.burnTimer = 3.0;
      }

      // Knockback away from player
      const dx = enemy.rig.root.position.x - heroRig.root.position.x;
      const dz = enemy.rig.root.position.z - heroRig.root.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const kb = enemy.kind === 'boss' ? knockbackStrength * 0.25 : knockbackStrength;
      enemy.rig.root.position.x += (dx / dist) * kb;
      enemy.rig.root.position.z += (dz / dist) * kb;

      pushFloatingNumber(
        enemy.rig.root.position.x,
        enemy.kind === 'boss' ? 4.4 : 2.2,
        enemy.rig.root.position.z,
        `-${dmg}`,
        hitColor
      );

      spawnBurstParticles(
        enemy.rig.root.position.x,
        enemy.kind === 'boss' ? 2.2 : 1.2,
        enemy.rig.root.position.z,
        flameStacks > 0 ? 0xff4500 : enemy.kind === 'boss' ? 0xff1e42 : 0x00f0ff,
        7
      );

      // Vampiric Lifesteal: +15 HP per enemy hit (scales with stacks) + green/crimson aura burst
      const vampStacks = g.upgrades.get('vampiric-lifesteal') ?? 0;
      if (allowVampiric && vampStacks > 0) {
        triggerLifestealHeal(15 * vampStacks);
      }

      if (enemy.hp <= 0) {
        g.kills += 1;
        g.score +=
          (enemy.kind === 'boss' ? 1200 : enemy.kind === 'mage' ? 160 : 120) *
          Math.min(4, 1 + Math.floor(g.combo / 5));
        const overchargeStacks = g.upgrades.get('chrono-overcharge') ?? 0;
        const novaGain = (enemy.kind === 'boss' ? 50 : 14) * (1 + overchargeStacks * 0.5);
        g.novaEnergy = Math.min(100, g.novaEnergy + novaGain);
        if (vampStacks > 0) {
          triggerLifestealHeal(28);
        }
        spawnBurstParticles(
          enemy.rig.root.position.x,
          1.3,
          enemy.rig.root.position.z,
          0xff1e42,
          enemy.kind === 'boss' ? 26 : 12
        );
        scene.remove(enemy.rig.root);
        if (enemy.kind === 'boss') {
          bossTelegraphMesh.visible = false;
        }
      }
    };

    const executeSwordAttack = () => {
      const g = gameRef.current;
      if (phaseRef.current !== 'PLAYING') return;

      const speedStacks = g.upgrades.get('attack-speed') ?? 0;
      const speedMult = 1 + speedStacks * 0.35;

      if (g.attackAnimTimer > 0.05 / speedMult || g.attackCooldownTimer > 0) {
        g.attackBuffered = true;
        return;
      }

      g.swingsMade += 1;
      g.comboStep = g.comboChainWindow > 0 ? (g.comboStep % 3) + 1 : 1;
      g.attackAnimDuration = (g.comboStep === 3 ? 0.3 : 0.22) / speedMult;
      g.attackAnimTimer = g.attackAnimDuration;
      g.attackCooldownTimer = (g.comboStep === 3 ? 0.14 : 0.08) / speedMult;
      g.comboChainWindow = 0.72;
      g.attackBuffered = false;

      audio.playSwordSwing(g.comboStep);

      const flameStacks = g.upgrades.get('crimson-flame') ?? 0;

      // Show glowing slash arc (turns fiery crimson-orange with Crimson Flame Blade!)
      slashArcMesh.visible = true;
      slashArcMesh.position.set(heroRig.root.position.x, 1.25, heroRig.root.position.z);
      slashArcMesh.rotation.y = heroRig.root.rotation.y + (g.comboStep === 2 ? 0.35 : -0.2);
      const scaleMult = (g.comboStep === 3 ? 1.26 : 1.0) * (speedStacks > 0 ? 1.18 : 1.0);
      slashArcMesh.scale.setScalar(scaleMult);
      if (flameStacks > 0) {
        slashArcMat.color.setHex(g.comboStep === 3 ? 0xff1e42 : 0xff4500);
      } else {
        slashArcMat.color.setHex(
          g.comboStep === 2 ? 0xff1e42 : g.comboStep === 3 ? 0xc084fc : 0x00f0ff
        );
      }
      slashArcMat.opacity = 0.9;

      // Slight forward lunge on strike
      const fx = Math.sin(heroRig.root.rotation.y);
      const fz = Math.cos(heroRig.root.rotation.y);
      heroRig.root.position.x += fx * (g.comboStep === 3 ? 0.85 : 0.45);
      heroRig.root.position.z += fz * (g.comboStep === 3 ? 0.85 : 0.45);

      const baseDmg = g.comboStep === 3 ? 74 : g.comboStep === 2 ? 46 : 38;
      const flameMult = 1 + flameStacks * 0.4;
      const dmg = baseDmg * flameMult;
      const reach = (g.comboStep === 3 ? 4.4 : 3.65) * (speedStacks > 0 ? 1.18 : 1.0);
      const minDot = g.comboStep === 3 ? -0.45 : 0.15;

      let landedAny = false;
      const primaryHitEnemies: EnemyEntity[] = [];

      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const dx = enemy.rig.root.position.x - heroRig.root.position.x;
        const dz = enemy.rig.root.position.z - heroRig.root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= reach + enemy.radius) {
          const dot = dist > 0.001 ? (dx / dist) * fx + (dz / dist) * fz : 1;
          if (dot >= minDot || dist < 1.5) {
            landedAny = true;
            primaryHitEnemies.push(enemy);
            damageEnemy(
              enemy,
              dmg,
              g.comboStep === 3 ? 1.35 : 0.65,
              flameStacks > 0 ? '#FF6B35' : g.comboStep === 3 ? '#00F0FF' : '#FFFFFF',
              true
            );
          }
        }
      }

      if (landedAny) {
        g.hitsLanded += 1;
        g.combo += 1;
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        g.comboResetTimer = 3.2;
        g.score += (g.comboStep === 3 ? 65 : 30) * Math.min(4, 1 + Math.floor(g.combo / 5));
        const overchargeStacks = g.upgrades.get('chrono-overcharge') ?? 0;
        g.novaEnergy = Math.min(
          100,
          g.novaEnergy + (g.comboStep === 3 ? 14 : 8) * (1 + overchargeStacks * 0.5)
        );
        g.hitStopTimer = g.comboStep === 3 ? 0.05 : 0.025;
        g.cameraShake = g.comboStep === 3 ? 0.42 : 0.2;
        audio.playSwordHit(g.comboStep === 3);

        // Chain Lightning Upgrade Proc: arc visible cyan bolts to up to 3 nearby enemies
        const lightningStacks = g.upgrades.get('chain-lightning') ?? 0;
        if (lightningStacks > 0 && primaryHitEnemies.length > 0) {
          const source = primaryHitEnemies[0];
          let arcs = 0;
          for (const target of enemies) {
            if (target.hp <= 0 || target.id === source.id) continue;
            const d = Math.hypot(
              target.rig.root.position.x - source.rig.root.position.x,
              target.rig.root.position.z - source.rig.root.position.z
            );
            if (d <= 10.5 && arcs < 3) {
              arcs++;
              spawnLightningArc(
                source.rig.root.position.x,
                source.rig.root.position.z,
                target.rig.root.position.x,
                target.rig.root.position.z
              );
              damageEnemy(target, 38 * lightningStacks, 0.25, '#00F0FF', false);
            }
          }
          if (arcs > 0) audio.playLightning();
        }
      }

      enemies = enemies.filter((e) => e.hp > 0);
    };

    const executeDash = () => {
      const g = gameRef.current;
      if (phaseRef.current !== 'PLAYING') return;
      if (g.dashCharges <= 0 || g.dashActiveTimer > 0) return;

      g.dashCharges -= 1;
      g.dashActiveTimer = 0.22;
      g.invulnTimer = 0.34;

      const moveVec = getInputVector();
      if (Math.hypot(moveVec.x, moveVec.z) > 0.1) {
        g.dashDirX = moveVec.x;
        g.dashDirZ = moveVec.z;
      } else {
        g.dashDirX = Math.sin(heroRig.root.rotation.y);
        g.dashDirZ = Math.cos(heroRig.root.rotation.y);
      }

      heroRig.root.rotation.y = Math.atan2(g.dashDirX, g.dashDirZ);
      audio.playDash();
      const tripleDashStacks = g.upgrades.get('triple-dash') ?? 0;
      spawnDashGhost(tripleDashStacks > 0);
    };

    const executeCosmicNova = () => {
      const g = gameRef.current;
      if (phaseRef.current !== 'PLAYING') return;
      if (g.novaEnergy < 100) return;

      g.novaEnergy = 0;
      g.invulnTimer = 0.6;
      g.cameraShake = 0.68;
      g.hitStopTimer = 0.06;
      audio.playCosmicNova();

      novaSphere.visible = true;
      novaSphere.position.set(heroRig.root.position.x, 1.0, heroRig.root.position.z);
      novaSphere.scale.setScalar(1);
      novaSphereMat.opacity = 0.95;
      novaAnimTimer = 0.55;

      const novaRadius = 11.2;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const d = Math.hypot(
          enemy.rig.root.position.x - heroRig.root.position.x,
          enemy.rig.root.position.z - heroRig.root.position.z
        );
        if (d <= novaRadius) {
          damageEnemy(enemy, 185, 2.6, '#FF1E42', true);
          g.combo += 1;
          g.maxCombo = Math.max(g.maxCombo, g.combo);
        }
      }
      g.comboResetTimer = 3.5;
      enemies = enemies.filter((e) => e.hp > 0);
      spawnBurstParticles(heroRig.root.position.x, 1.2, heroRig.root.position.z, 0x00f0ff, 22);
      pushFloatingNumber(
        heroRig.root.position.x,
        3.1,
        heroRig.root.position.z,
        'COSMIC NOVA!',
        '#00F0FF'
      );
    };

    const getInputVector = () => {
      const inp = inputRef.current;
      let x = inp.joyX;
      let z = inp.joyY;

      if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) z -= 1;
      if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) z += 1;
      if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) x -= 1;
      if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) x += 1;

      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      return { x, z };
    };

    const startNewRun = () => {
      clearDynamicEntities();
      const g = gameRef.current;
      g.hp = 150;
      g.maxHp = 150;
      g.novaEnergy = 35;
      g.wave = 1;
      g.score = 0;
      g.combo = 1;
      g.maxCombo = 1;
      g.comboResetTimer = 0;
      g.kills = 0;
      g.hitsLanded = 0;
      g.swingsMade = 0;
      g.dashCharges = 1;
      g.maxDashCharges = 1;
      g.dashRechargeTimer = 0;
      g.dashCooldownDuration = 2.1;
      g.dashActiveTimer = 0;
      g.invulnTimer = 0;
      g.comboStep = 0;
      g.attackAnimTimer = 0;
      g.attackCooldownTimer = 0;
      g.comboChainWindow = 0;
      g.attackBuffered = false;
      g.hitStopTimer = 0;
      g.cameraShake = 0;
      g.waveTransitionTimer = 0;
      g.upgrades.clear();
      g.reportedSession = false;
      g.endlessMode = false;

      heroRig.root.position.set(0, 0, 3);
      heroRig.root.rotation.y = Math.PI;
      applyUpgradeVisuals();
      setAcquiredUpgrades([]);
      setSessionRewards(null);
      floatingQueue.length = 0;
      setFloatingNumbers([]);

      spawnWave(1);
      setSyncedPhase('PLAYING');
    };

    engineActionsRef.current = {
      startNewRun,
      spawnWave,
      triggerAttack: executeSwordAttack,
      triggerDash: executeDash,
      triggerNova: executeCosmicNova,
      applyUpgradeVisuals,
    };

    // Pre-compile shaders on hardware GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ResizeObserver & orientation change sync
    const handleResize = () => {
      if (!mount) return;
      const w = Math.max(320, mount.clientWidth);
      const h = Math.max(180, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Simulation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let hudSyncAccum = 0;
    let ghostSpawnTimer = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const rawDt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const g = gameRef.current;

      // Animate floating ambient energy motes even in Title Menu
      for (let i = 0; i < moteCount; i++) {
        const m = moteData[i];
        m.y += rawDt * m.speed;
        if (m.y > 8.5) m.y = 0.4;
        _dummy.position.set(
          Math.cos(m.angle + elapsed * 0.1) * m.radius,
          m.y + Math.sin(elapsed * 2 + m.phase) * 0.25,
          Math.sin(m.angle + elapsed * 0.1) * m.radius
        );
        _dummy.rotation.y = elapsed * 1.4 + m.phase;
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        moteInstanced.setMatrixAt(i, _dummy.matrix);
      }
      moteInstanced.instanceMatrix.needsUpdate = true;

      if (phaseRef.current === 'PLAYING') {
        // Consume queued touch/button actions
        if (inputRef.current.attackRequested) {
          inputRef.current.attackRequested = false;
          executeSwordAttack();
        }
        if (inputRef.current.dashRequested) {
          inputRef.current.dashRequested = false;
          executeDash();
        }
        if (inputRef.current.novaRequested) {
          inputRef.current.novaRequested = false;
          executeCosmicNova();
        }

        // Hit-stop freeze frame for visceral sword impact
        let dt = rawDt;
        if (g.hitStopTimer > 0) {
          g.hitStopTimer = Math.max(0, g.hitStopTimer - rawDt);
          dt = rawDt * 0.14;
        }

        // Dash recharge
        if (g.dashCharges < g.maxDashCharges) {
          g.dashRechargeTimer += dt;
          if (g.dashRechargeTimer >= g.dashCooldownDuration) {
            g.dashRechargeTimer = 0;
            g.dashCharges += 1;
          }
        }

        // Timers
        if (g.invulnTimer > 0) g.invulnTimer = Math.max(0, g.invulnTimer - dt);
        if (g.attackCooldownTimer > 0)
          g.attackCooldownTimer = Math.max(0, g.attackCooldownTimer - dt);
        if (g.comboChainWindow > 0) g.comboChainWindow = Math.max(0, g.comboChainWindow - dt);
        if (g.bannerTimer > 0) {
          g.bannerTimer = Math.max(0, g.bannerTimer - dt);
          if (g.bannerTimer === 0) g.bannerText = '';
        }
        if (g.combo > 1) {
          g.comboResetTimer -= dt;
          if (g.comboResetTimer <= 0) g.combo = 1;
        }

        // Player Movement & Dash
        if (g.dashActiveTimer > 0) {
          g.dashActiveTimer = Math.max(0, g.dashActiveTimer - dt);
          heroRig.root.position.x += g.dashDirX * 22 * dt;
          heroRig.root.position.z += g.dashDirZ * 22 * dt;
          ghostSpawnTimer += dt;
          if (ghostSpawnTimer >= 0.065) {
            ghostSpawnTimer = 0;
            const tripleDashStacks = g.upgrades.get('triple-dash') ?? 0;
            spawnDashGhost(tripleDashStacks > 0);
          }
        } else {
          const mv = getInputVector();
          const mag = Math.hypot(mv.x, mv.z);
          if (mag > 0.08) {
            const moveSpeed = 7.6;
            heroRig.root.position.x += mv.x * moveSpeed * dt;
            heroRig.root.position.z += mv.z * moveSpeed * dt;
            const targetRot = Math.atan2(mv.x, mv.z);
            let diff = targetRot - heroRig.root.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            heroRig.root.rotation.y += diff * Math.min(1, dt * 14);

            // Walk stride animation
            const walkCycle = Math.sin(elapsed * 14);
            heroRig.leftLeg.rotation.x = walkCycle * 0.5;
            heroRig.rightLeg.rotation.x = -walkCycle * 0.5;
            heroRig.leftArm.rotation.x = -walkCycle * 0.35;
            heroRig.capeMesh.rotation.x = 0.45 + Math.sin(elapsed * 10) * 0.12;
          } else {
            heroRig.leftLeg.rotation.x = THREE.MathUtils.damp(heroRig.leftLeg.rotation.x, 0, 12, dt);
            heroRig.rightLeg.rotation.x = THREE.MathUtils.damp(
              heroRig.rightLeg.rotation.x,
              0,
              12,
              dt
            );
            heroRig.leftArm.rotation.x = THREE.MathUtils.damp(heroRig.leftArm.rotation.x, 0, 12, dt);
            heroRig.capeMesh.rotation.x = 0.22 + Math.sin(elapsed * 3) * 0.05;
          }
        }

        // Clamp hero inside circular Rune Arena
        const heroDist = Math.hypot(heroRig.root.position.x, heroRig.root.position.z);
        if (heroDist > ARENA_RADIUS - 0.7) {
          const clampScale = (ARENA_RADIUS - 0.7) / heroDist;
          heroRig.root.position.x *= clampScale;
          heroRig.root.position.z *= clampScale;
        }

        // 3-Hit Sword Swing Animation
        if (g.attackAnimTimer > 0) {
          g.attackAnimTimer = Math.max(0, g.attackAnimTimer - dt);
          const progress = 1 - g.attackAnimTimer / g.attackAnimDuration;
          if (g.comboStep === 1) {
            heroRig.weaponPivot.rotation.y = THREE.MathUtils.lerp(-1.4, 1.5, progress);
            heroRig.weaponPivot.rotation.x = 0.4;
          } else if (g.comboStep === 2) {
            heroRig.weaponPivot.rotation.y = THREE.MathUtils.lerp(1.5, -1.5, progress);
            heroRig.weaponPivot.rotation.x = 0.1;
          } else {
            heroRig.weaponPivot.rotation.y = progress * Math.PI * 2;
            heroRig.weaponPivot.rotation.x = Math.sin(progress * Math.PI) * 1.1;
          }

          slashArcMat.opacity = Math.max(0, (1 - progress) * 0.9);
          if (g.attackAnimTimer === 0) {
            slashArcMesh.visible = false;
            if (g.attackBuffered && g.attackCooldownTimer === 0) {
              executeSwordAttack();
            }
          }
        } else {
          heroRig.weaponPivot.rotation.y = THREE.MathUtils.damp(
            heroRig.weaponPivot.rotation.y,
            0,
            12,
            dt
          );
          heroRig.weaponPivot.rotation.x = THREE.MathUtils.damp(
            heroRig.weaponPivot.rotation.x,
            0,
            12,
            dt
          );
          if (g.attackBuffered && g.attackCooldownTimer === 0) {
            executeSwordAttack();
          }
        }

        // Cosmic Nova Dome Expansion
        if (novaAnimTimer > 0) {
          novaAnimTimer = Math.max(0, novaAnimTimer - dt);
          const p = 1 - novaAnimTimer / 0.55;
          novaSphere.scale.setScalar(1 + p * 11.5);
          novaSphere.rotation.y += dt * 4;
          novaSphereMat.opacity = (1 - p) * 0.9;
          if (novaAnimTimer === 0) novaSphere.visible = false;
        }

        // Vampiric Healing Aura Ring Expansion
        if (healAuraTimer > 0) {
          healAuraTimer = Math.max(0, healAuraTimer - dt);
          const hp = 1 - healAuraTimer / 0.35;
          healAuraMesh.position.set(heroRig.root.position.x, 0.14, heroRig.root.position.z);
          healAuraMesh.scale.setScalar(0.8 + hp * 1.6);
          healAuraMat.opacity = (1 - hp) * 0.9;
          if (healAuraTimer === 0) healAuraMesh.visible = false;
        }

        // Enemy AI Update
        const flameStacks = g.upgrades.get('crimson-flame') ?? 0;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;

          // Crimson Flame Blade burn damage-over-time
          if (enemy.burnTimer > 0) {
            enemy.burnTimer -= dt;
            enemy.burnTickTimer += dt;
            if (enemy.burnTickTimer >= 0.5) {
              enemy.burnTickTimer = 0;
              const burnDmg = 18 * Math.max(1, flameStacks);
              enemy.hp = Math.max(0, enemy.hp - burnDmg);
              spawnBurstParticles(
                enemy.rig.root.position.x,
                1.2,
                enemy.rig.root.position.z,
                0xff4500,
                4
              );
              pushFloatingNumber(
                enemy.rig.root.position.x,
                2.0,
                enemy.rig.root.position.z,
                `-${burnDmg} BURN`,
                '#FF6B35'
              );
              if (enemy.hp <= 0) {
                g.kills += 1;
                g.score += 120;
                scene.remove(enemy.rig.root);
                if (enemy.kind === 'boss') bossTelegraphMesh.visible = false;
                continue;
              }
            }
          }

          // Hit flash visual scale bounce
          if (enemy.hitFlash > 0) {
            enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
            const bounce = 1 + (enemy.hitFlash / 0.14) * 0.12;
            enemy.rig.bodyGroup.scale.setScalar(bounce);
          } else {
            enemy.rig.bodyGroup.scale.setScalar(1);
          }

          if (enemy.rig.ringMesh) {
            enemy.rig.ringMesh.rotation.z += dt * 2.1;
          }

          const dx = heroRig.root.position.x - enemy.rig.root.position.x;
          const dz = heroRig.root.position.z - enemy.rig.root.position.z;
          const dist = Math.hypot(dx, dz) || 1;
          enemy.rig.root.rotation.y = Math.atan2(dx, dz);

          if (enemy.kind === 'knight') {
            if (dist > 1.75) {
              enemy.rig.root.position.x += (dx / dist) * enemy.speed * dt;
              enemy.rig.root.position.z += (dz / dist) * enemy.speed * dt;
            }
            enemy.attackCooldown -= dt;
            if (dist <= 2.15 && enemy.attackCooldown <= 0) {
              enemy.attackCooldown = 1.25;
              enemy.rig.weaponPivot.rotation.x = 1.2;
              if (g.invulnTimer <= 0) {
                g.hp = Math.max(0, g.hp - 12);
                g.invulnTimer = 0.45;
                g.cameraShake = 0.28;
                audio.playPlayerHurt();
                pushFloatingNumber(
                  heroRig.root.position.x,
                  2.3,
                  heroRig.root.position.z,
                  '-12',
                  '#FF1E42'
                );
              }
            } else {
              enemy.rig.weaponPivot.rotation.x = THREE.MathUtils.damp(
                enemy.rig.weaponPivot.rotation.x,
                0,
                8,
                dt
              );
            }
          } else if (enemy.kind === 'mage') {
            if (dist > 10.5) {
              enemy.rig.root.position.x += (dx / dist) * enemy.speed * dt;
              enemy.rig.root.position.z += (dz / dist) * enemy.speed * dt;
            } else if (dist < 6.0) {
              enemy.rig.root.position.x -= (dx / dist) * enemy.speed * 0.7 * dt;
              enemy.rig.root.position.z -= (dz / dist) * enemy.speed * 0.7 * dt;
            }
            enemy.rig.bodyGroup.position.y = Math.sin(elapsed * 3 + enemy.id) * 0.18;

            enemy.attackCooldown -= dt;
            if (enemy.attackCooldown <= 0) {
              enemy.attackCooldown = 2.4;
              spawnMageProjectile(
                enemy.rig.root.position.x,
                enemy.rig.root.position.z,
                (dx / dist) * 8.6,
                (dz / dist) * 8.6
              );
            }
          } else if (enemy.kind === 'boss') {
            if (enemy.slamState === 'idle') {
              if (dist > 2.8) {
                enemy.rig.root.position.x += (dx / dist) * enemy.speed * dt;
                enemy.rig.root.position.z += (dz / dist) * enemy.speed * dt;
              }
              enemy.attackCooldown -= dt;
              if (enemy.attackCooldown <= 0) {
                if (dist < 7.5) {
                  enemy.slamState = 'telegraph';
                  enemy.slamTimer = 1.25;
                  enemy.slamTargetX = heroRig.root.position.x;
                  enemy.slamTargetZ = heroRig.root.position.z;
                  bossTelegraphMesh.position.set(enemy.slamTargetX, 0.05, enemy.slamTargetZ);
                  bossTelegraphMesh.scale.setScalar(0.4);
                  bossTelegraphMesh.visible = true;
                } else {
                  enemy.attackCooldown = 1.2;
                }
              }
            } else {
              enemy.slamTimer -= dt;
              enemy.rig.bodyGroup.position.y = Math.sin((1.25 - enemy.slamTimer) * 2.5) * 0.9;
              const s = 0.4 + (1 - Math.max(0, enemy.slamTimer) / 1.25) * 0.65;
              bossTelegraphMesh.scale.setScalar(s);

              if (enemy.slamTimer <= 0) {
                enemy.slamState = 'idle';
                enemy.slamTimer = 0;
                enemy.attackCooldown = 2.8;
                enemy.rig.bodyGroup.position.y = 0;
                bossTelegraphMesh.visible = false;
                audio.playBossSlam();
                g.cameraShake = 0.65;
                spawnBurstParticles(enemy.slamTargetX, 0.4, enemy.slamTargetZ, 0xff1e42, 20);

                const hitDist = Math.hypot(
                  heroRig.root.position.x - enemy.slamTargetX,
                  heroRig.root.position.z - enemy.slamTargetZ
                );
                if (hitDist <= 4.7 && g.invulnTimer <= 0) {
                  g.hp = Math.max(0, g.hp - 28);
                  g.invulnTimer = 0.65;
                  audio.playPlayerHurt();
                  pushFloatingNumber(
                    heroRig.root.position.x,
                    2.5,
                    heroRig.root.position.z,
                    '-28 SLAM!',
                    '#FF1E42'
                  );
                }
              }
            }
          }

          // Clamp enemies inside arena
          const eDist = Math.hypot(enemy.rig.root.position.x, enemy.rig.root.position.z);
          if (eDist > ARENA_RADIUS - 0.8) {
            const s = (ARENA_RADIUS - 0.8) / eDist;
            enemy.rig.root.position.x *= s;
            enemy.rig.root.position.z *= s;
          }
        }
        enemies = enemies.filter((e) => e.hp > 0);

        // Update Pooled Void Projectiles
        for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
          const p = projectilePool[i];
          if (!p.active) continue;
          p.life -= dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.mesh.position.set(p.x, 1.35, p.z);

          const distToHero = Math.hypot(
            p.x - heroRig.root.position.x,
            p.z - heroRig.root.position.z
          );
          if (distToHero < 0.9) {
            if (g.invulnTimer <= 0) {
              g.hp = Math.max(0, g.hp - p.damage);
              g.invulnTimer = 0.45;
              g.cameraShake = 0.24;
              audio.playPlayerHurt();
              pushFloatingNumber(
                heroRig.root.position.x,
                2.2,
                heroRig.root.position.z,
                `-${p.damage}`,
                '#FF1E42'
              );
            }
            p.active = false;
            p.mesh.visible = false;
            continue;
          }
          if (p.life <= 0 || Math.hypot(p.x, p.z) >= ARENA_RADIUS + 2) {
            p.active = false;
            p.mesh.visible = false;
          }
        }

        // Check Player Defeat or Wave Clear
        if (g.hp <= 0) {
          finishMatch(false);
        } else if (enemies.length === 0) {
          if (g.wave === 5 && !g.endlessMode) {
            finishMatch(true);
          } else {
            g.waveTransitionTimer += dt;
            if (g.waveTransitionTimer >= 0.45) {
              g.waveTransitionTimer = 0;
              audio.playVictoryChime();
              const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
              setUpgradeChoices(shuffled);
              setSyncedPhase('UPGRADE_PICK');
            }
          }
        }
      } else {
        heroRig.capeMesh.rotation.x = 0.22 + Math.sin(elapsed * 2.5) * 0.06;
      }

      // Update Pooled Instanced Burst Particles
      let particlesDirty = false;
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        particlesDirty = true;
        p.life -= rawDt;
        if (p.life > 0) {
          p.vy -= 14 * rawDt;
          p.x += p.vx * rawDt;
          p.y = Math.max(0.08, p.y + p.vy * rawDt);
          p.z += p.vz * rawDt;
          _dummy.position.set(p.x, p.y, p.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(Math.max(0.1, p.life / p.maxLife));
          _dummy.updateMatrix();
          particleInstanced.setMatrixAt(i, _dummy.matrix);
        } else {
          p.active = false;
          _dummy.position.set(0, -10, 0);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          particleInstanced.setMatrixAt(i, _dummy.matrix);
        }
      }
      if (particlesDirty) {
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // Update Pooled Dash Ghosts & Triple-Dash Shadow Clone Explosions
      const tripleDashStacks = g.upgrades.get('triple-dash') ?? 0;
      for (let i = 0; i < GHOST_POOL_SIZE; i++) {
        const gh = ghostPool[i];
        if (!gh.active) continue;
        gh.life -= rawDt;
        if (gh.life > 0) {
          gh.mesh.scale.setScalar(0.85 + (gh.life / 0.36) * 0.2);
          if (gh.isDamagingClone && !gh.hasDetonated && gh.life <= 0.14 && phaseRef.current === 'PLAYING') {
            gh.hasDetonated = true;
            const cloneDmg = 44 * Math.max(1, tripleDashStacks);
            for (const enemy of enemies) {
              if (enemy.hp <= 0) continue;
              const d = Math.hypot(
                enemy.rig.root.position.x - gh.x,
                enemy.rig.root.position.z - gh.z
              );
              if (d <= 3.1 + enemy.radius) {
                damageEnemy(enemy, cloneDmg, 0.45, '#C084FC', false);
              }
            }
            enemies = enemies.filter((e) => e.hp > 0);
            spawnBurstParticles(gh.x, 1.0, gh.z, 0xa855f7, 6);
          }
        } else {
          gh.active = false;
          gh.mesh.visible = false;
        }
      }

      // Update Pooled Lightning Bolts
      for (let i = 0; i < LIGHTNING_POOL_SIZE; i++) {
        const lb = lightningPool[i];
        if (!lb.active) continue;
        lb.life -= rawDt;
        if (lb.life <= 0) {
          lb.active = false;
          lb.line.visible = false;
        }
      }

      // Smooth Third-Person Camera Follow + Damped Shake
      if (g.cameraShake > 0) {
        g.cameraShake = Math.max(0, g.cameraShake - rawDt * 2.4);
      }
      const shakeX = (Math.random() - 0.5) * g.cameraShake;
      const shakeY = (Math.random() - 0.5) * g.cameraShake;

      _v1.set(heroRig.root.position.x + shakeX, 11.4 + shakeY, heroRig.root.position.z + 12.2);
      camera.position.lerp(_v1, 1 - Math.exp(-8 * rawDt));
      _v2.set(heroRig.root.position.x, 1.3, heroRig.root.position.z - 0.6);
      camera.lookAt(_v2);

      renderer.render(scene, camera);

      // Sync React HUD + Projected Floating Damage Numbers (~15Hz)
      hudSyncAccum += rawDt;
      if (hudSyncAccum >= 0.065) {
        hudSyncAccum = 0;

        const boss = enemies.find((e) => e.kind === 'boss');
        setHudState({
          hp: Math.ceil(g.hp),
          maxHp: g.maxHp,
          novaEnergy: Math.floor(g.novaEnergy),
          wave: g.wave,
          score: g.score,
          combo: g.combo,
          maxCombo: g.maxCombo,
          kills: g.kills,
          dashCharges: g.dashCharges,
          maxDashCharges: g.maxDashCharges,
          dashProgress:
            g.dashCharges < g.maxDashCharges
              ? Math.min(1, g.dashRechargeTimer / g.dashCooldownDuration)
              : 1,
          bossHp: boss ? Math.ceil(boss.hp) : 0,
          bossMaxHp: boss ? boss.maxHp : 0,
          bossName: boss ? 'VOID TITAN · WAVE 5 OVERLORD' : '',
          bannerText: g.bannerText,
        });

        const mountW = mount.clientWidth || 960;
        const mountH = mount.clientHeight || 540;
        const nextFloats: FloatingDmg[] = [];
        for (let i = floatingQueue.length - 1; i >= 0; i--) {
          const item = floatingQueue[i];
          item.ttl -= 0.065;
          item.worldPos.y += 0.14;
          if (item.ttl <= 0) {
            floatingQueue.splice(i, 1);
            continue;
          }
          _projVec.copy(item.worldPos).project(camera);
          if (_projVec.z < 1) {
            nextFloats.push({
              id: item.id,
              x: ((_projVec.x + 1) * 0.5) * mountW,
              y: ((-_projVec.y + 1) * 0.5) * mountH,
              text: item.text,
              color: item.color,
            });
          }
        }
        setFloatingNumbers(nextFloats);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);

      clearDynamicEntities();
      enemyFactory.dispose();

      // Strictly dispose all WebGL geometries, materials, and textures in scene
      const disposedGeos = new Set<THREE.BufferGeometry>();
      const disposedMats = new Set<THREE.Material>();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
          disposedGeos.add(mesh.geometry);
          mesh.geometry.dispose();
        }
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m && !disposedMats.has(m)) {
              disposedMats.add(m);
              m.dispose();
            }
          });
        } else if (mat && !disposedMats.has(mat)) {
          disposedMats.add(mat);
          mat.dispose();
        }
      });

      arenaTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [domainCheck.authorized, finishMatch, isMuted, setSyncedPhase]);

  // Keyboard bindings (WASD + Space/J Attack + Shift/K Dash + Q/E/L Cosmic Nova + P Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      inputRef.current.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyJ') {
        if (phaseRef.current === 'PLAYING') {
          e.preventDefault();
          inputRef.current.attackRequested = true;
        }
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') {
        if (phaseRef.current === 'PLAYING') {
          e.preventDefault();
          inputRef.current.dashRequested = true;
        }
      } else if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyL') {
        if (phaseRef.current === 'PLAYING') {
          e.preventDefault();
          inputRef.current.novaRequested = true;
        }
      } else if (e.code === 'KeyP') {
        if (phaseRef.current === 'PLAYING') setSyncedPhase('PAUSED');
        else if (phaseRef.current === 'PAUSED') setSyncedPhase('PLAYING');
      } else if (e.code === 'KeyM') {
        onToggleMute();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputRef.current.keys.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onToggleMute, setSyncedPhase]);

  const handleSelectUpgrade = (card: UpgradeCard) => {
    const g = gameRef.current;
    const nextStacks = (g.upgrades.get(card.id) ?? 0) + 1;
    g.upgrades.set(card.id, nextStacks);

    if (card.id === 'triple-dash') {
      g.maxDashCharges = Math.min(5, nextStacks === 1 ? 3 : g.maxDashCharges + 1);
      g.dashCharges = g.maxDashCharges;
      g.dashCooldownDuration = Math.max(0.95, 2.1 * Math.pow(0.76, nextStacks));
    } else if (card.id === 'chrono-overcharge') {
      g.hp = Math.min(g.maxHp, g.hp + 40);
      g.novaEnergy = Math.min(100, g.novaEnergy + 35);
    }

    engineActionsRef.current?.applyUpgradeVisuals(card.id);
    setAcquiredUpgrades(
      Array.from(g.upgrades.entries()).map(([id, count]) => ({ id, count }))
    );
    engineActionsRef.current?.spawnWave(g.wave + 1);
    setSyncedPhase('PLAYING');
  };

  const handleContinueEndless = () => {
    const g = gameRef.current;
    g.endlessMode = true;
    g.reportedSession = false;
    g.hp = Math.min(g.maxHp, g.hp + 60);
    setSessionRewards(null);
    engineActionsRef.current?.spawnWave(g.wave + 1);
    setSyncedPhase('PLAYING');
  };

  // Virtual Joystick Pointer Handlers (multi-touch safe)
  const handleJoystickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    inputRef.current.joyPointerId = e.pointerId;
    inputRef.current.joyOriginX = cx;
    inputRef.current.joyOriginY = cy;
    updateJoystick(e.clientX, e.clientY, cx, cy);
  };

  const updateJoystick = (clientX: number, clientY: number, cx: number, cy: number) => {
    const maxR = 54;
    const screenDx = clientX - cx;
    const screenDy = clientY - cy;

    const mount = canvasMountRef.current;
    const mountRect = mount?.getBoundingClientRect();
    const isCssRotated = Boolean(
      mount &&
        mountRect &&
        mountRect.width < mountRect.height &&
        mount.clientWidth > mount.clientHeight
    );

    // Remap physical portrait touch deltas into local rotated landscape coordinates (rotate(90deg))
    const rawDx = isCssRotated ? screenDy : screenDx;
    const rawDy = isCssRotated ? -screenDx : screenDy;

    const dist = Math.hypot(rawDx, rawDy);
    const clamped = Math.min(maxR, dist);
    const ang = Math.atan2(rawDy, rawDx);
    const dx = Math.cos(ang) * clamped;
    const dy = Math.sin(ang) * clamped;
    inputRef.current.joyX = dx / maxR;
    inputRef.current.joyY = dy / maxR;
    setJoyVisual({ active: true, dx, dy });
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inputRef.current.joyPointerId !== e.pointerId) return;
    updateJoystick(
      e.clientX,
      e.clientY,
      inputRef.current.joyOriginX,
      inputRef.current.joyOriginY
    );
  };

  const handleJoystickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inputRef.current.joyPointerId !== e.pointerId) return;
    inputRef.current.joyPointerId = null;
    inputRef.current.joyX = 0;
    inputRef.current.joyY = 0;
    setJoyVisual({ active: false, dx: 0, dy: 0 });
  };

  if (!domainCheck.authorized) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#07070F] p-6 text-center">
        <div className="max-w-md rounded-2xl bg-[#120B24] border border-[#FF1E42]/50 p-6">
          <ShieldAlert className="w-10 h-10 text-[#FF1E42] mx-auto" />
          <h2 className="mt-3 font-display text-lg font-bold text-white">
            Unauthorized Domain Blocked
          </h2>
          <p className="mt-2 text-xs text-slate-300">
            © 2026 Shadow Knight Game Zone. All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-[#07070F] select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={canvasMountRef}
        onPointerDown={() => {
          if (phaseRef.current === 'PLAYING') {
            inputRef.current.attackRequested = true;
          }
        }}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* Projected Floating Damage Numbers */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {floatingNumbers.map((fn) => (
          <div
            key={fn.id}
            style={{
              transform: `translate3d(${fn.x}px, ${fn.y}px, 0) translate(-50%, -50%)`,
              color: fn.color,
            }}
            className="absolute font-display text-xs sm:text-sm font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
          >
            {fn.text}
          </div>
        ))}
      </div>

      {/* Top Combat HUD (No backdrop-blur over WebGL per Three.js performance guidelines) */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-20 p-3 sm:p-4 flex items-start justify-between gap-3">
        {/* Left: HP & Cosmic Nova Energy */}
        <div className="w-44 sm:w-60 rounded-xl bg-[#07070F]/85 border border-white/12 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-[11px] font-mono-nums">
            <span className="inline-flex items-center gap-1 font-semibold text-white">
              <Heart className="w-3.5 h-3.5 text-[#FF1E42] fill-[#FF1E42]" />
              {hudState.hp}/{hudState.maxHp}
            </span>
            <span className="text-[#00F0FF] font-bold">Wave {hudState.wave}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#120B24] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF1E42] to-[#fb7185] transition-all duration-150"
              style={{ width: `${Math.max(0, Math.min(100, (hudState.hp / hudState.maxHp) * 100))}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono-nums text-slate-300">
            <span>Cosmic Nova</span>
            <span className="text-[#00F0FF]">{hudState.novaEnergy}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[#120B24] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00F0FF] to-[#a855f7] transition-all duration-150"
              style={{ width: `${hudState.novaEnergy}%` }}
            />
          </div>

          {/* Active Unlocked Power-Up Icons under HP/Nova Bar */}
          {acquiredUpgrades.length > 0 && (
            <div
              aria-label="Active Roguelike Powers"
              className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5"
            >
              {acquiredUpgrades.map(({ id, count }) => {
                const cardMeta = UPGRADE_POOL.find((u) => u.id === id);
                return (
                  <div
                    key={id}
                    title={`${cardMeta?.title ?? id}${count > 1 ? ` (x${count})` : ''}`}
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono-nums font-bold border ${
                      id === 'crimson-flame'
                        ? 'bg-[#FF1E42]/20 border-[#FF4500]/60 text-orange-300'
                        : id === 'vampiric-lifesteal'
                        ? 'bg-emerald-500/18 border-emerald-400/55 text-emerald-300'
                        : 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                    }`}
                  >
                    {id === 'chain-lightning' && <Zap className="w-3 h-3" />}
                    {id === 'crimson-flame' && <Flame className="w-3 h-3 text-[#FF4500]" />}
                    {id === 'triple-dash' && <Wind className="w-3 h-3" />}
                    {id === 'vampiric-lifesteal' && (
                      <Heart className="w-3 h-3 text-emerald-400 fill-[#FF1E42]" />
                    )}
                    {id === 'attack-speed' && <Sword className="w-3 h-3 text-amber-300" />}
                    {id === 'chrono-overcharge' && <Sparkles className="w-3 h-3 text-purple-300" />}
                    {count > 1 && <span>x{count}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: Wave 5 Boss Health Bar OR Wave Announcement */}
        <div className="flex-1 max-w-md flex flex-col items-center">
          {hudState.bossMaxHp > 0 && (
            <div className="w-full rounded-xl bg-[#07070F]/90 border border-[#FF1E42]/60 px-3.5 py-2">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-display font-bold text-[#FF1E42]">
                <span>{hudState.bossName}</span>
                <span className="font-mono-nums text-white">
                  {hudState.bossHp}/{hudState.bossMaxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-[#120B24] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF1E42] via-[#dc2626] to-[#f97316] transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hudState.bossHp / hudState.bossMaxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {hudState.bannerText && (
            <div className="mt-2 rounded-lg bg-[#120B24]/95 border border-[#00F0FF]/50 px-4 py-1.5 font-display text-xs sm:text-sm font-extrabold tracking-wider text-white">
              {hudState.bannerText}
            </div>
          )}
        </div>

        {/* Right: Score, Combo, Mute & Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-xl bg-[#07070F]/85 border border-white/12 px-3 py-1.5 text-right">
            <div className="font-mono-nums text-sm sm:text-base font-bold text-white leading-tight">
              {hudState.score.toLocaleString()}
            </div>
            <div className="font-mono-nums text-[10px] font-bold text-[#00F0FF]">
              {hudState.combo}x Combo
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-[#07070F]/85 border border-white/12 text-slate-200 hover:border-[#00F0FF] cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {phase === 'PLAYING' && (
            <button
              type="button"
              onClick={() => setSyncedPhase('PAUSED')}
              aria-label="Pause Chrono Slayer 3D"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-[#07070F]/85 border border-white/12 text-slate-200 hover:border-[#FF1E42] cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Subtle Copyright Corner Watermark */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-400/80 whitespace-nowrap">
        © 2026 Shadow Knight Game Zone. All Rights Reserved.
      </div>

      {/* Free Fire / BGMI Style 16:9 Landscape Touch & Combat Controls */}
      {phase === 'PLAYING' && (
        <>
          {/* Bottom-Left: Enlarged 144px (w-36 h-36) Virtual Joystick with Wide Touch-Capture Zone */}
          <div
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            aria-label="360 Movement Joystick"
            className="absolute bottom-2 left-2 z-20 w-44 h-44 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          >
            <div className="relative w-36 h-36 rounded-full bg-[#120B24]/72 border-2 border-[#00F0FF]/55 shadow-[0_0_24px_rgba(0,240,255,0.22)] flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full border border-white/20" />
              <div
                style={{
                  transform: `translate3d(${joyVisual.dx}px, ${joyVisual.dy}px, 0)`,
                }}
                className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-[#00F0FF] via-[#38bdf8] to-[#2563eb] border-2 border-white shadow-[0_0_20px_rgba(0,240,255,0.85)]"
              />
            </div>
          </div>

          {/* PC Hint Bar (subtle, bottom-center above copyright) */}
          <div className="pointer-events-none hidden md:block absolute bottom-7 left-1/2 -translate-x-1/2 z-10 text-[11px] text-slate-400 bg-[#07070F]/75 px-3 py-1 rounded-md border border-white/10">
            WASD Move · Space / Click Attack (3-Hit) · Shift Dash · Q Cosmic Nova
          </div>

          {/* Bottom-Right: Ergonomic Attack, Dash & Cosmic Nova Buttons */}
          <div className="absolute bottom-5 right-5 z-20 flex items-end gap-3 touch-none">
            {/* Cosmic Nova Ultimate Button */}
            <button
              type="button"
              disabled={hudState.novaEnergy < 100}
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerNova();
              }}
              className={`min-w-[58px] min-h-[58px] sm:min-w-[66px] sm:min-h-[66px] rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-display font-bold transition ${
                hudState.novaEnergy >= 100
                  ? 'bg-gradient-to-br from-[#a855f7] to-[#FF1E42] border-[#00F0FF] text-white shadow-lg shadow-[#FF1E42]/40 scale-105 cursor-pointer'
                  : 'bg-[#120B24]/85 border-white/15 text-slate-400 opacity-75 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span className="mt-0.5">NOVA</span>
            </button>

            {/* Invincible Dash Button */}
            <button
              type="button"
              disabled={hudState.dashCharges <= 0}
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerDash();
              }}
              className={`relative min-w-[60px] min-h-[60px] sm:min-w-[68px] sm:min-h-[68px] rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-display font-bold transition ${
                hudState.dashCharges > 0
                  ? 'bg-[#120B24]/90 border-[#00F0FF] text-[#00F0FF] active:scale-95 cursor-pointer'
                  : 'bg-[#120B24]/70 border-white/15 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Wind className="w-5 h-5" />
              <span className="mt-0.5">DASH {hudState.dashCharges}</span>
            </button>

            {/* Primary 3-Hit Greatsword Attack Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerAttack();
              }}
              className="min-w-[78px] min-h-[78px] sm:min-w-[88px] sm:min-h-[88px] rounded-full bg-gradient-to-br from-[#FF1E42] to-[#be123c] border-2 border-white/80 text-white shadow-xl shadow-[#FF1E42]/35 flex flex-col items-center justify-center font-display text-xs font-black active:scale-90 transition cursor-pointer"
            >
              <Sword className="w-7 h-7" />
              <span className="mt-0.5">ATTACK</span>
            </button>
          </div>
        </>
      )}

      {/* Title Menu Overlay */}
      {phase === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/82 p-4">
          <div className="max-w-xl w-full rounded-2xl bg-[#120B24]/95 border border-white/15 p-5 sm:p-7 shadow-2xl grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            <div className="sm:col-span-5 aspect-square rounded-xl overflow-hidden border border-[#00F0FF]/35 bg-[#07070F]">
              <img
                src="/assets/aistudio/IMG_20261123_200155_bf5615db.jpg"
                alt="Chrono Slayer 3D Key Art"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="sm:col-span-7 text-left">
              <div className="text-[11px] font-semibold text-[#00F0FF] uppercase tracking-wider">
                3D Third-Person Action Arena
              </div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                CHRONO SLAYER <span className="text-[#FF1E42]">3D</span>
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Chain 3-hit greatsword combos, dash through Void Mage bolts, draft Roguelike power
                cards, and defeat the Wave 5 Void Titan Boss.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => engineActionsRef.current?.startNewRun()}
                  className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] px-6 py-2.5 font-display text-sm font-bold text-white shadow-lg shadow-[#FF1E42]/30 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  ENTER ARENA
                </button>

                {bestScore > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono-nums text-amber-400">
                    <Trophy className="w-4 h-4" />
                    Best: {bestScore.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roguelike Wave Upgrade Cards Overlay */}
      {phase === 'UPGRADE_PICK' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/88 p-4">
          <div className="max-w-3xl w-full rounded-2xl bg-[#120B24] border border-[#00F0FF]/40 p-5 sm:p-6 shadow-2xl text-center">
            <div className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider">
              Wave {hudState.wave} Cleared
            </div>
            <h3 className="mt-1 font-display text-xl sm:text-2xl font-black text-white">
              CHOOSE A CHRONO POWER-UP
            </h3>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left">
              {upgradeChoices.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelectUpgrade(card)}
                  className={`group rounded-xl p-4 border transition flex flex-col justify-between gap-3 cursor-pointer ${
                    card.accent === 'crimson'
                      ? 'bg-[#1a0b1e] border-[#FF1E42]/50 hover:border-[#FF1E42] hover:bg-[#270e29]'
                      : 'bg-[#0b1328] border-[#00F0FF]/50 hover:border-[#00F0FF] hover:bg-[#0f1d3a]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {card.accent === 'crimson' ? (
                        <Flame className="w-5 h-5 text-[#FF1E42] shrink-0" />
                      ) : (
                        <Zap className="w-5 h-5 text-[#00F0FF] shrink-0" />
                      )}
                      <span className="font-display text-sm font-bold text-white">
                        {card.title}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-bold ${
                      card.accent === 'crimson' ? 'text-[#FF1E42]' : 'text-[#00F0FF]'
                    }`}
                  >
                    {acquiredUpgrades.some((u) => u.id === card.id)
                      ? 'Stack Power-Up →'
                      : 'Equip Relic →'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {phase === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/85 p-4">
          <div className="max-w-sm w-full rounded-2xl bg-[#120B24] border border-white/15 p-6 text-center">
            <h3 className="font-display text-xl font-bold text-white">Combat Paused</h3>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setSyncedPhase('PLAYING')}
                className="min-h-[44px] rounded-xl bg-[#00F0FF] text-[#07070F] font-display text-sm font-bold cursor-pointer"
              >
                Resume Battle
              </button>
              <button
                type="button"
                onClick={() => engineActionsRef.current?.startNewRun()}
                className="min-h-[44px] rounded-xl bg-white/8 border border-white/12 text-white text-sm font-semibold cursor-pointer"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[40px] text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Exit to Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal with XP/Coin Sync & WhatsApp Challenge */}
      {(phase === 'GAME_OVER' || phase === 'VICTORY') && sessionRewards && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/90 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-[#120B24] border border-white/15 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#00F0FF]">
                  {sessionRewards.victory
                    ? 'Wave 5 Void Titan Defeated!'
                    : sessionRewards.isNewBest
                    ? 'New Personal Best!'
                    : `Reached Wave ${hudState.wave}`}
                </div>
                <h3 className="font-display text-2xl font-black text-white">
                  {sessionRewards.victory ? 'CHRONO VICTORY' : 'FALLEN IN BATTLE'}
                </h3>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="font-mono-nums text-2xl font-bold text-[#FF1E42]">
                  {sessionRewards.score.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[#07070F]/85 border border-white/10 p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Wave</div>
                <div className="font-mono-nums text-sm font-bold text-white">{hudState.wave}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Max Combo</div>
                <div className="font-mono-nums text-sm font-bold text-[#00F0FF]">
                  {hudState.maxCombo}x
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">XP Synced</div>
                <div className="font-mono-nums text-sm font-bold text-emerald-400">
                  +{sessionRewards.xpEarned}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Coins</div>
                <div className="font-mono-nums text-sm font-bold text-amber-400">
                  +{sessionRewards.coinsEarned}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => engineActionsRef.current?.startNewRun()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] text-white px-4 py-2.5 font-display text-xs sm:text-sm font-bold cursor-pointer transition"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                Play Again
              </button>

              <a
                href={buildWhatsAppChallengeUrl(gameTitle, sessionRewards.score)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                Challenge Friend on WhatsApp
              </a>

              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#07070F] hover:bg-white/10 border border-white/20 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer transition"
              >
                <Home className="w-4 h-4 shrink-0 text-[#00F0FF]" />
                Back to Home
              </button>
            </div>

            {sessionRewards.victory && (
              <button
                type="button"
                onClick={handleContinueEndless}
                className="mt-2.5 w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-[#07070F] px-4 py-2 font-display text-xs sm:text-sm font-bold cursor-pointer transition"
              >
                <Zap className="w-4 h-4" />
                Continue Endless (Wave 6+)
              </button>
            )}

            <div className="mt-4 text-center text-[11px] text-slate-400">
              © 2026 Shadow Knight Game Zone. All Rights Reserved.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
