import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Eye,
  Flame,
  Heart,
  Home,
  Pause,
  Play,
  RotateCcw,
  Share2,
  ShieldAlert,
  Skull,
  Sparkles,
  Sword,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { getArmorySkinConfig } from '../config/armory';
import type { GameComponentProps } from '../types';
import { checkDomainAuthorization } from '../utils/domainGuard';
import { buildWhatsAppChallengeUrl } from '../utils/playerStorage';
import { ChronoAudioEngine } from './chronoSlayer/audio';
import {
  createFirstPersonViewModel,
  createGlbEnemyController,
  createGlbHeroController,
  loadWarriorGlbModels,
  type GlbEnemyController,
  type GlbHeroController,
  type LoadedWarriorAssets,
} from './chronoSlayer/glbWarriors';
import {
  createChronoArenaTexture,
  createEnemyRigFactory,
  createHeroKnightRig,
  type EnemyArchetype,
  type EnemyRig,
} from './chronoSlayer/models';

type SlayerPhase = 'TITLE_MENU' | 'PLAYING' | 'UPGRADE_PICK' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';
type CameraViewMode = '3RD' | '1ST';

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

interface FallbackBar {
  group: THREE.Group;
  fill: THREE.Mesh;
  dispose: () => void;
}

interface EnemyEntity {
  id: number;
  kind: EnemyArchetype;
  root: THREE.Group;
  glb: GlbEnemyController | null;
  fallbackRig: EnemyRig | null;
  fallbackBar: FallbackBar | null;
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
  attackState: 'idle' | 'swinging';
  attackAnimTimer: number;
  attackAnimDuration: number;
  attackImpactDone: boolean;
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
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();

function createFallbackBillboardBar(kind: EnemyArchetype): FallbackBar {
  const group = new THREE.Group();
  const barWidth = kind === 'boss' ? 2.4 : 1.15;
  const barHeight = kind === 'boss' ? 0.18 : 0.11;
  const heightY = kind === 'boss' ? 4.4 : kind === 'juggernaut' ? 2.6 : 2.15;
  group.position.set(0, heightY, 0);

  const bgGeo = new THREE.PlaneGeometry(barWidth + 0.06, barHeight + 0.05);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x07070f,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(bgGeo, bgMat));

  const fillGeo = new THREE.PlaneGeometry(barWidth, barHeight);
  fillGeo.translate(barWidth / 2, 0, 0);
  const fillMat = new THREE.MeshBasicMaterial({
    color: kind === 'boss' ? 0xff1e42 : kind === 'mage' ? 0xe879f9 : 0xff3355,
    side: THREE.DoubleSide,
  });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.position.set(-barWidth / 2, 0, 0.008);
  group.add(fill);

  return {
    group,
    fill,
    dispose: () => {
      bgGeo.dispose();
      bgMat.dispose();
      fillGeo.dispose();
      fillMat.dispose();
    },
  };
}

export const ChronoSlayer3D: React.FC<GameComponentProps> = ({
  gameId,
  gameTitle,
  bestScore,
  isMuted,
  equippedSkin = 'cyber-cyan',
  unlockedPerks = [],
  onToggleMute,
  onSessionComplete,
  onExit,
}) => {
  const domainCheck = checkDomainAuthorization();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<ChronoAudioEngine | null>(null);

  const skinConfig = getArmorySkinConfig(equippedSkin);
  const hasVitalCore = unlockedPerks.includes('vital-core');
  const hasChronoBattery = unlockedPerks.includes('chrono-battery');
  const hasBladeTempering = unlockedPerks.includes('blade-tempering');
  const initialMaxHp = hasVitalCore ? 185 : 150;
  const initialNova = hasChronoBattery ? 75 : 35;

  const armoryRef = useRef({
    skinAccentHex: skinConfig.accentHex,
    skinArmorHex: skinConfig.armorHex,
    skinAccentCss: skinConfig.accentCss,
    initialMaxHp,
    initialNova,
    damageBonusMult: hasBladeTempering ? 1.2 : 1.0,
  });
  armoryRef.current = {
    skinAccentHex: skinConfig.accentHex,
    skinArmorHex: skinConfig.armorHex,
    skinAccentCss: skinConfig.accentCss,
    initialMaxHp,
    initialNova,
    damageBonusMult: hasBladeTempering ? 1.2 : 1.0,
  };

  const [phase, setPhase] = useState<SlayerPhase>('TITLE_MENU');
  const phaseRef = useRef<SlayerPhase>('TITLE_MENU');

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('3RD');
  const cameraModeRef = useRef<CameraViewMode>('3RD');

  const [modelLoading, setModelLoading] = useState<{
    active: boolean;
    percent: number;
    label: string;
  }>({
    active: true,
    percent: 5,
    label: 'Loading 3D Warrior Models...',
  });

  const [hudState, setHudState] = useState({
    hp: initialMaxHp,
    maxHp: initialMaxHp,
    novaEnergy: initialNova,
    wave: 1,
    waveState: 'INCOMING' as 'INCOMING' | 'ACTIVE' | 'CLEARED_SLOWMO',
    waveCountdown: 2.0,
    enemiesRemaining: 0,
    waveTotalEnemies: 0,
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

  // Input + Look + Gameplay mutable state refs
  const inputRef = useRef({
    keys: new Set<string>(),
    joyX: 0,
    joyY: 0,
    joyPointerId: null as number | null,
    joyOriginX: 0,
    joyOriginY: 0,
    lookPointerId: null as number | null,
    lookLastX: 0,
    lookLastY: 0,
    lookMovedDist: 0,
    cameraYaw: 0,
    cameraPitch: 0.14,
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
    dashDirZ: -1,
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
    waveState: 'INCOMING' as 'INCOMING' | 'ACTIVE' | 'CLEARED_SLOWMO',
    waveCountdown: 2.0,
    waveClearTimer: 0,
    waveTotalEnemies: 0,
    lastKillX: 0,
    lastKillZ: 0,
    upgrades: new Map<UpgradeId, number>(),
    nextEntityId: 1,
    nextFloatId: 1,
    reportedSession: false,
    endlessMode: false,
  });

  // Scene callbacks set once during WebGL initialization
  const engineActionsRef = useRef<{
    startNewRun: () => void;
    beginWaveIncoming: (waveNum: number) => void;
    triggerAttack: () => void;
    triggerDash: () => void;
    triggerNova: () => void;
    applyUpgradeVisuals: (id: UpgradeId) => void;
  } | null>(null);

  const setSyncedPhase = useCallback((next: SlayerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const toggleCameraView = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraViewMode = prev === '3RD' ? '1ST' : '3RD';
      cameraModeRef.current = next;
      return next;
    });
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
    renderer.toneMappingExposure = 1.18;
    // Cap pixelRatio <= 1.15 on mobile (1.35 desktop) for locked 60fps with zero stutter
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isMobileBrowser ? 1.15 : 1.35)
    );
    renderer.setSize(width, height);
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
    scene.background = new THREE.Color(0x07060f);
    scene.fog = new THREE.FogExp2(0x090616, 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Camera added to scene so First-Person Cyber-Arm ViewModel renders as a child of camera
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 140);
    camera.position.set(0.7, 2.1, 4.2);
    camera.lookAt(0, 1.5, -8);
    scene.add(camera);

    // First-Person POV Cyber-Arm + Energy Katana ViewModel
    const fpViewModel = createFirstPersonViewModel(
      armoryRef.current.skinAccentHex,
      armoryRef.current.skinArmorHex
    );
    camera.add(fpViewModel.root);

    // Dramatic 3-Point Studio + Combat Arena Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0x16092b, 1.05);
    scene.add(hemiLight);

    // Warm Key/Rim Light
    const warmRimLight = new THREE.DirectionalLight(0xffdfb8, 2.25);
    warmRimLight.position.set(11, 18, 13);
    warmRimLight.castShadow = enableShadows;
    if (enableShadows) {
      warmRimLight.shadow.mapSize.set(1024, 1024);
      warmRimLight.shadow.camera.near = 2;
      warmRimLight.shadow.camera.far = 55;
      warmRimLight.shadow.camera.left = -22;
      warmRimLight.shadow.camera.right = 22;
      warmRimLight.shadow.camera.top = 22;
      warmRimLight.shadow.camera.bottom = -22;
      warmRimLight.shadow.bias = -0.0005;
      warmRimLight.shadow.normalBias = 0.02;
    }
    scene.add(warmRimLight);

    // Cool Cyan Fill Light
    const cyanFillLight = new THREE.DirectionalLight(0x00f0ff, 1.55);
    cyanFillLight.position.set(15, 7, -11);
    scene.add(cyanFillLight);

    // Crimson Back Rim Light
    const crimsonBackLight = new THREE.DirectionalLight(0xff1e42, 1.9);
    crimsonBackLight.position.set(-15, 10, -14);
    scene.add(crimsonBackLight);

    // Extended dark horizon void floor + Reflective Dark Obsidian Rune Arena disc
    const outerVoidGeo = new THREE.CircleGeometry(95, 36);
    outerVoidGeo.rotateX(-Math.PI / 2);
    const outerVoidMat = new THREE.MeshStandardMaterial({
      color: 0x05050b,
      roughness: 0.94,
      metalness: 0.15,
    });
    const outerVoidFloor = new THREE.Mesh(outerVoidGeo, outerVoidMat);
    outerVoidFloor.position.y = -0.03;
    scene.add(outerVoidFloor);

    const arenaTextures = createChronoArenaTexture(renderer.capabilities.getMaxAnisotropy());
    const arenaFloorGeo = new THREE.CylinderGeometry(
      ARENA_RADIUS + 0.5,
      ARENA_RADIUS + 1.3,
      0.38,
      48
    );
    const arenaFloorMat = new THREE.MeshStandardMaterial({
      map: arenaTextures.map,
      roughnessMap: arenaTextures.roughnessMap,
      roughness: 0.3,
      metalness: 0.78,
      envMapIntensity: 1.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
    arenaFloor.position.y = -0.19;
    arenaFloor.receiveShadow = enableShadows;
    scene.add(arenaFloor);

    // Dual glowing arcane boundary rings
    const rimRingGeo = new THREE.TorusGeometry(ARENA_RADIUS + 0.16, 0.1, 8, 64);
    rimRingGeo.rotateX(Math.PI / 2);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.8,
    });
    const rimRing = new THREE.Mesh(rimRingGeo, rimRingMat);
    rimRing.position.y = 0.04;
    scene.add(rimRing);

    const innerRimGeo = new THREE.TorusGeometry(ARENA_RADIUS - 0.12, 0.045, 6, 64);
    innerRimGeo.rotateX(Math.PI / 2);
    const innerRimMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 1.5,
    });
    const innerRim = new THREE.Mesh(innerRimGeo, innerRimMat);
    innerRim.position.y = 0.03;
    scene.add(innerRim);

    // 12 Cracked Obsidian Perimeter Pillars
    const pillarBaseGeo = new THREE.CylinderGeometry(1.05, 1.24, 0.55, 8);
    const pillarShaftGeo = new THREE.CylinderGeometry(0.66, 0.84, 5.2, 8);
    const pillarCrownGeo = new THREE.CylinderGeometry(0.55, 0.72, 1.15, 7);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x140e24,
      metalness: 0.72,
      roughness: 0.36,
    });
    const bandGeo = new THREE.TorusGeometry(0.76, 0.065, 6, 16);
    bandGeo.rotateX(Math.PI / 2);
    const fissureGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5);
    const cyanBandMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.1,
    });
    const crimsonBandMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 2.1,
    });

    const floatingShards: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const dist = ARENA_RADIUS + 1.85;
      const px = Math.cos(ang) * dist;
      const pz = Math.sin(ang) * dist;
      const isBroken = i % 2 === 1;
      const glowMat = i % 2 === 0 ? cyanBandMat : crimsonBandMat;

      const base = new THREE.Mesh(pillarBaseGeo, pillarMat);
      base.position.set(px, 0.25, pz);
      scene.add(base);

      const shaft = new THREE.Mesh(pillarShaftGeo, pillarMat);
      shaft.scale.y = isBroken ? 0.72 : 1.0;
      shaft.position.set(px, isBroken ? 2.15 : 2.9, pz);
      shaft.rotation.z = isBroken ? ((i % 4 === 1 ? 1 : -1) * 0.04) : 0;
      shaft.lookAt(0, shaft.position.y, 0);
      shaft.castShadow = enableShadows;
      scene.add(shaft);

      const crown = new THREE.Mesh(pillarCrownGeo, pillarMat);
      const crownY = isBroken ? 4.85 : 5.95;
      crown.position.set(px, crownY, pz);
      crown.rotation.set(isBroken ? 0.28 : 0.06, ang, isBroken ? -0.22 : 0.04);
      scene.add(crown);
      if (isBroken) {
        floatingShards.push({ mesh: crown, baseY: crownY, phase: i * 0.9 });
      }

      const band = new THREE.Mesh(bandGeo, glowMat);
      band.position.set(px, isBroken ? 3.55 : 4.5, pz);
      scene.add(band);

      const fissure = new THREE.Mesh(fissureGeo, glowMat);
      fissure.position.set(
        px - Math.cos(ang) * 0.7,
        isBroken ? 2.3 : 2.9,
        pz - Math.sin(ang) * 0.7
      );
      fissure.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.16;
      scene.add(fissure);
    }

    // Instanced Floating Embers & Arcane Sparks
    const moteCount = 64;
    const moteGeo = new THREE.OctahedronGeometry(0.095, 0);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const moteInstanced = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    moteInstanced.frustumCulled = false;
    const moteData: { angle: number; radius: number; y: number; speed: number; phase: number }[] =
      [];
    for (let i = 0; i < moteCount; i++) {
      moteData.push({
        angle: Math.random() * Math.PI * 2,
        radius: 3 + Math.random() * (ARENA_RADIUS + 4),
        y: 0.4 + Math.random() * 8,
        speed: 0.55 + Math.random() * 1.15,
        phase: Math.random() * Math.PI * 2,
      });
      _tmpColor.setHex(i % 3 === 0 ? 0xff4500 : i % 3 === 1 ? 0x00f0ff : 0xff1e42);
      moteInstanced.setColorAt(i, _tmpColor);
    }
    if (moteInstanced.instanceColor) moteInstanced.instanceColor.needsUpdate = true;
    scene.add(moteInstanced);

    // === Hero Controller (Rigged GLTF Soldier.glb + Fallback Sculpted Knight) ===
    const heroAnchor = new THREE.Group();
    heroAnchor.rotation.y = Math.PI; // Facing -Z into the arena at start
    scene.add(heroAnchor);

    const contactShadowGeo = new THREE.CircleGeometry(0.82, 20);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const heroShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    heroShadow.position.y = 0.02;
    heroAnchor.add(heroShadow);

    const fallbackHeroRig = createHeroKnightRig();
    if (!enableShadows) {
      fallbackHeroRig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) obj.castShadow = false;
      });
    }
    heroAnchor.add(fallbackHeroRig.root);

    let glbAssets: LoadedWarriorAssets = { soldier: null, xbot: null };
    let glbHero: GlbHeroController | null = null;
    let disposed = false;

    void loadWarriorGlbModels((percent, label) => {
      if (disposed) return;
      setModelLoading({ active: percent < 100, percent, label });
    }).then((loaded) => {
      if (disposed) return;
      glbAssets = loaded;
      const upgradedHero = createGlbHeroController(
        loaded,
        enableShadows,
        armoryRef.current.skinAccentHex,
        armoryRef.current.skinArmorHex
      );
      if (upgradedHero) {
        glbHero = upgradedHero;
        fallbackHeroRig.root.visible = false;
        heroAnchor.add(upgradedHero.root);
        applyUpgradeVisuals();
      }
      setModelLoading({ active: false, percent: 100, label: '3D Warriors Ready' });
    });

    // Active slash trail arc mesh (reused)
    const slashArcGeo = new THREE.RingGeometry(1.4, 3.5, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);
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

    // Pooled Crimson Enemy Slash Arcs (shows enemy melee strike sweep cleanly)
    const ENEMY_SLASH_POOL_SIZE = 4;
    const enemySlashPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = [];
    for (let i = 0; i < ENEMY_SLASH_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(slashArcGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      enemySlashPool.push({ mesh, mat, life: 0 });
    }
    const spawnEnemySlashArc = (
      x: number,
      z: number,
      rotY: number,
      scaleMult = 0.85,
      colorHex = 0xff1e42
    ) => {
      for (let i = 0; i < ENEMY_SLASH_POOL_SIZE; i++) {
        const s = enemySlashPool[i];
        if (s.life > 0) continue;
        s.life = 0.22;
        s.mat.color.setHex(colorHex);
        s.mat.opacity = 0.9;
        s.mesh.position.set(x, 1.2, z);
        s.mesh.rotation.y = rotY;
        s.mesh.scale.setScalar(scaleMult);
        s.mesh.visible = true;
        break;
      }
    };

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
    const particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
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

    const ghostTorsoGeo = new THREE.CapsuleGeometry(0.28, 0.85, 4, 8);
    const ghostHeadGeo = new THREE.SphereGeometry(0.2, 8, 8);
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

    // Fallback Enemy Factory (for offline/blocked environments)
    const fallbackEnemyFactory = createEnemyRigFactory();
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
        gh.x = heroAnchor.position.x;
        gh.z = heroAnchor.position.z;
        gh.mesh.position.copy(heroAnchor.position);
        gh.mesh.rotation.copy(heroAnchor.rotation);
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

    function applyUpgradeVisuals(upgradeId?: UpgradeId) {
      const g = gameRef.current;
      const hasFlame = (g.upgrades.get('crimson-flame') ?? 0) > 0;
      const baseHex = armoryRef.current.skinAccentHex;
      const edgeColor = hasFlame ? 0xff4500 : baseHex;
      const tipColor = hasFlame ? 0xff6b2c : baseHex;
      const intensity = hasFlame ? 3.0 : 2.3;

      // Update GLB Hero Weapon + Aura
      if (glbHero) {
        glbHero.accentMat.color.setHex(baseHex);
        glbHero.accentMat.emissive.setHex(baseHex);
        glbHero.bladeEdgeMat.color.setHex(edgeColor);
        glbHero.bladeEdgeMat.emissive.setHex(edgeColor);
        glbHero.bladeEdgeMat.emissiveIntensity = intensity;
        glbHero.bladeTipMat.emissive.setHex(tipColor);
        glbHero.bladeTipMat.emissiveIntensity = intensity;
        glbHero.flameAura.color.setHex(edgeColor);
        glbHero.flameAura.intensity = hasFlame ? 3.0 : 2.2;
      }

      // Update Fallback Hero Weapon + Aura
      fallbackHeroRig.cyanEdgeMat.color.setHex(edgeColor);
      fallbackHeroRig.cyanEdgeMat.emissive.setHex(edgeColor);
      fallbackHeroRig.cyanEdgeMat.emissiveIntensity = intensity;
      fallbackHeroRig.bladeTipMat.emissive.setHex(tipColor);
      fallbackHeroRig.flameAura.color.setHex(edgeColor);

      // Update First-Person Viewmodel Katana
      fpViewModel.bladeEdgeMat.color.setHex(edgeColor);
      fpViewModel.bladeEdgeMat.emissive.setHex(edgeColor);
      fpViewModel.bladeEdgeMat.emissiveIntensity = intensity;
      fpViewModel.bladeTipMat.emissive.setHex(tipColor);
      fpViewModel.swordLight.color.setHex(edgeColor);

      if (upgradeId === 'vampiric-lifesteal' || upgradeId === 'chrono-overcharge') {
        healAuraMesh.visible = true;
        healAuraMesh.position.set(heroAnchor.position.x, 0.14, heroAnchor.position.z);
        healAuraMesh.scale.setScalar(1);
        healAuraMat.opacity = 0.9;
        healAuraTimer = 0.35;
      }
    }

    const disposeEnemy = (enemy: EnemyEntity) => {
      scene.remove(enemy.root);
      enemy.glb?.dispose();
      enemy.fallbackBar?.dispose();
    };

    const clearDynamicEntities = () => {
      enemies.forEach(disposeEnemy);
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

    const createEnemy = (kind: EnemyArchetype, x: number, z: number): EnemyEntity => {
      const g = gameRef.current;
      const glbCtrl = createGlbEnemyController(kind, glbAssets, enableShadows);

      let root: THREE.Group;
      let fallbackRig: EnemyRig | null = null;
      let fallbackBar: FallbackBar | null = null;

      if (glbCtrl) {
        root = glbCtrl.root;
      } else {
        fallbackRig = fallbackEnemyFactory.spawn(kind, enableShadows);
        fallbackBar = createFallbackBillboardBar(kind);
        fallbackRig.root.add(fallbackBar.group);
        root = fallbackRig.root;
      }

      root.position.set(x, 0, z);
      scene.add(root);

      const maxHp =
        kind === 'boss'
          ? 980 + Math.max(0, g.wave - 3) * 260
          : kind === 'juggernaut'
          ? 150 + g.wave * 34
          : kind === 'mage'
          ? 70 + g.wave * 16
          : 65 + g.wave * 18;

      const speed =
        kind === 'boss'
          ? 3.05
          : kind === 'juggernaut'
          ? 2.65 + Math.min(1.0, g.wave * 0.14)
          : kind === 'mage'
          ? 2.5 + Math.min(1.0, g.wave * 0.12)
          : 4.7 + Math.min(2.0, g.wave * 0.25);

      const radius =
        kind === 'boss' ? 1.55 : kind === 'juggernaut' ? 0.92 : 0.68;

      return {
        id: g.nextEntityId++,
        kind,
        root,
        glb: glbCtrl,
        fallbackRig,
        fallbackBar,
        hp: maxHp,
        maxHp,
        speed,
        radius,
        attackCooldown: kind === 'boss' ? 1.8 : 0.7 + Math.random() * 0.6,
        hitFlash: 0,
        burnTimer: 0,
        burnTickTimer: 0,
        slamState: 'idle',
        slamTimer: 0,
        slamTargetX: 0,
        slamTargetZ: 0,
        attackState: 'idle',
        attackAnimTimer: 0,
        attackAnimDuration: 0.42,
        attackImpactDone: false,
      };
    };

    const spawnWaveEntities = (waveNum: number) => {
      const g = gameRef.current;
      g.wave = waveNum;

      const isBossWave = waveNum % 3 === 0;
      const stalkerCount = isBossWave ? 2 : 2 + waveNum;
      const juggCount = isBossWave ? 1 : Math.min(3, Math.max(1, Math.floor((waveNum + 1) / 2)));
      const mageCount = waveNum >= 2 ? (isBossWave ? 1 : Math.min(3, waveNum - 1)) : 0;

      const placeAtPerimeter = (idx: number, total: number, minDist = 11, maxDist = 15.5) => {
        const ang = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.4;
        const r = minDist + Math.random() * (maxDist - minDist);
        return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
      };

      const totalRegular = stalkerCount + juggCount + mageCount;
      for (let i = 0; i < stalkerCount; i++) {
        const pos = placeAtPerimeter(i, totalRegular);
        enemies.push(createEnemy('stalker', pos.x, pos.z));
        spawnBurstParticles(pos.x, 1.0, pos.z, 0xff1e42, 6);
      }

      for (let i = 0; i < juggCount; i++) {
        const pos = placeAtPerimeter(stalkerCount + i, totalRegular, 11.8, 15.8);
        enemies.push(createEnemy('juggernaut', pos.x, pos.z));
        spawnBurstParticles(pos.x, 1.2, pos.z, 0xff4500, 6);
      }

      for (let i = 0; i < mageCount; i++) {
        const pos = placeAtPerimeter(stalkerCount + juggCount + i, totalRegular, 12.5, 16.2);
        enemies.push(createEnemy('mage', pos.x, pos.z));
        spawnBurstParticles(pos.x, 1.2, pos.z, 0xc026d3, 6);
      }

      if (isBossWave) {
        enemies.push(createEnemy('boss', 0, -12));
        spawnBurstParticles(0, 2.0, -12, 0xff1e42, 18);
        g.bannerText = `CHRONO BOSS · WAVE ${waveNum}`;
        g.bannerTimer = 2.4;
      } else {
        g.bannerText = '';
        g.bannerTimer = 0;
      }

      g.waveTotalEnemies = enemies.length;
    };

    const beginWaveIncoming = (waveNum: number) => {
      const g = gameRef.current;
      g.wave = waveNum;
      g.waveState = 'INCOMING';
      g.waveCountdown = 2.0;
      g.waveClearTimer = 0;
      g.waveTotalEnemies = 0;

      for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
        projectilePool[i].active = false;
        projectilePool[i].mesh.visible = false;
      }

      const isBossWave = waveNum % 3 === 0;
      g.bannerText = isBossWave
        ? `WAVE ${waveNum} — CHRONO BOSS INCOMING!`
        : `WAVE ${waveNum} — INCOMING!`;
      g.bannerTimer = 2.0;
      audio.playWaveIncoming(isBossWave);
    };

    const triggerLifestealHeal = (healAmount: number) => {
      const g = gameRef.current;
      g.hp = Math.min(g.maxHp, g.hp + healAmount);
      healAuraMesh.visible = true;
      healAuraMesh.position.set(heroAnchor.position.x, 0.14, heroAnchor.position.z);
      healAuraMesh.scale.setScalar(0.8);
      healAuraMat.opacity = 0.92;
      healAuraTimer = 0.34;
      spawnBurstParticles(heroAnchor.position.x, 1.1, heroAnchor.position.z, 0x10b981, 6);
      pushFloatingNumber(
        heroAnchor.position.x,
        2.4,
        heroAnchor.position.z,
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

      const dx = enemy.root.position.x - heroAnchor.position.x;
      const dz = enemy.root.position.z - heroAnchor.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const kb =
        enemy.kind === 'boss'
          ? knockbackStrength * 0.2
          : enemy.kind === 'juggernaut'
          ? knockbackStrength * 0.45
          : knockbackStrength;
      enemy.root.position.x += (dx / dist) * kb;
      enemy.root.position.z += (dz / dist) * kb;

      pushFloatingNumber(
        enemy.root.position.x,
        enemy.kind === 'boss' ? 4.2 : 2.1,
        enemy.root.position.z,
        `-${dmg}`,
        hitColor
      );

      spawnBurstParticles(
        enemy.root.position.x,
        enemy.kind === 'boss' ? 2.2 : 1.2,
        enemy.root.position.z,
        flameStacks > 0 ? 0xff4500 : enemy.kind === 'boss' ? 0xff1e42 : 0x00f0ff,
        7
      );

      const vampStacks = g.upgrades.get('vampiric-lifesteal') ?? 0;
      if (allowVampiric && vampStacks > 0) {
        triggerLifestealHeal(15 * vampStacks);
      }

      if (enemy.hp <= 0) {
        g.kills += 1;
        g.lastKillX = enemy.root.position.x;
        g.lastKillZ = enemy.root.position.z;
        g.score +=
          (enemy.kind === 'boss'
            ? 1400
            : enemy.kind === 'juggernaut'
            ? 210
            : enemy.kind === 'mage'
            ? 160
            : 130) * Math.min(4, 1 + Math.floor(g.combo / 5));
        const overchargeStacks = g.upgrades.get('chrono-overcharge') ?? 0;
        const novaGain = (enemy.kind === 'boss' ? 50 : 14) * (1 + overchargeStacks * 0.5);
        g.novaEnergy = Math.min(100, g.novaEnergy + novaGain);
        if (vampStacks > 0) {
          triggerLifestealHeal(28);
        }
        spawnBurstParticles(
          enemy.root.position.x,
          1.3,
          enemy.root.position.z,
          0xff1e42,
          enemy.kind === 'boss' ? 26 : 12
        );
        disposeEnemy(enemy);
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

      // Face camera look direction when slashing so Over-the-Shoulder & 1st-Person strikes always aim where player looks
      heroAnchor.rotation.y = inputRef.current.cameraYaw + Math.PI;

      audio.playSwordSwing(g.comboStep);

      const flameStacks = g.upgrades.get('crimson-flame') ?? 0;
      slashArcMesh.visible = true;
      slashArcMesh.position.set(heroAnchor.position.x, 1.25, heroAnchor.position.z);
      slashArcMesh.rotation.y = heroAnchor.rotation.y + (g.comboStep === 2 ? 0.35 : -0.2);
      const scaleMult = (g.comboStep === 3 ? 1.26 : 1.0) * (speedStacks > 0 ? 1.18 : 1.0);
      slashArcMesh.scale.setScalar(scaleMult);
      if (flameStacks > 0) {
        slashArcMat.color.setHex(g.comboStep === 3 ? 0xff1e42 : 0xff4500);
      } else {
        slashArcMat.color.setHex(
          g.comboStep === 2
            ? 0xff1e42
            : g.comboStep === 3
            ? 0xc084fc
            : armoryRef.current.skinAccentHex
        );
      }
      slashArcMat.opacity = 0.9;

      const fx = Math.sin(heroAnchor.rotation.y);
      const fz = Math.cos(heroAnchor.rotation.y);
      heroAnchor.position.x += fx * (g.comboStep === 3 ? 0.85 : 0.45);
      heroAnchor.position.z += fz * (g.comboStep === 3 ? 0.85 : 0.45);

      const baseDmg = g.comboStep === 3 ? 74 : g.comboStep === 2 ? 46 : 38;
      const flameMult = 1 + flameStacks * 0.4;
      const dmg = baseDmg * flameMult * armoryRef.current.damageBonusMult;
      const reach = (g.comboStep === 3 ? 4.5 : 3.75) * (speedStacks > 0 ? 1.18 : 1.0);
      const minDot = g.comboStep === 3 ? -0.45 : 0.1;

      let landedAny = false;
      const primaryHitEnemies: EnemyEntity[] = [];

      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const dx = enemy.root.position.x - heroAnchor.position.x;
        const dz = enemy.root.position.z - heroAnchor.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= reach + enemy.radius) {
          const dot = dist > 0.001 ? (dx / dist) * fx + (dz / dist) * fz : 1;
          if (dot >= minDot || dist < 1.65) {
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

        const lightningStacks = g.upgrades.get('chain-lightning') ?? 0;
        if (lightningStacks > 0 && primaryHitEnemies.length > 0) {
          const source = primaryHitEnemies[0];
          let arcs = 0;
          for (const target of enemies) {
            if (target.hp <= 0 || target.id === source.id) continue;
            const d = Math.hypot(
              target.root.position.x - source.root.position.x,
              target.root.position.z - source.root.position.z
            );
            if (d <= 10.5 && arcs < 3) {
              arcs++;
              spawnLightningArc(
                source.root.position.x,
                source.root.position.z,
                target.root.position.x,
                target.root.position.z
              );
              damageEnemy(target, 38 * lightningStacks, 0.25, '#00F0FF', false);
            }
          }
          if (arcs > 0) audio.playLightning();
        }
      }

      enemies = enemies.filter((e) => e.hp > 0);
    };

    const getCameraRelativeInputVector = () => {
      const inp = inputRef.current;
      let rawX = inp.joyX;
      let rawY = inp.joyY;

      if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) rawX -= 1;
      if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) rawX += 1;
      if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) rawY -= 1;
      if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) rawY += 1;

      const len = Math.hypot(rawX, rawY);
      if (len < 0.01) return { x: 0, z: 0 };
      if (len > 1) {
        rawX /= len;
        rawY /= len;
      }

      // Transform input (rawX = right, -rawY = forward) into world XZ via cameraYaw
      const yaw = inp.cameraYaw;
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const forwardAmt = -rawY;

      return {
        x: rightX * rawX + fwdX * forwardAmt,
        z: rightZ * rawX + fwdZ * forwardAmt,
      };
    };

    const executeDash = () => {
      const g = gameRef.current;
      if (phaseRef.current !== 'PLAYING') return;
      if (g.dashCharges <= 0 || g.dashActiveTimer > 0) return;

      g.dashCharges -= 1;
      g.dashActiveTimer = 0.22;
      g.invulnTimer = 0.34;

      const moveVec = getCameraRelativeInputVector();
      if (Math.hypot(moveVec.x, moveVec.z) > 0.1) {
        g.dashDirX = moveVec.x;
        g.dashDirZ = moveVec.z;
      } else {
        g.dashDirX = -Math.sin(inputRef.current.cameraYaw);
        g.dashDirZ = -Math.cos(inputRef.current.cameraYaw);
      }

      heroAnchor.rotation.y = Math.atan2(g.dashDirX, g.dashDirZ);
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
      novaSphere.position.set(heroAnchor.position.x, 1.0, heroAnchor.position.z);
      novaSphere.scale.setScalar(1);
      novaSphereMat.opacity = 0.95;
      novaAnimTimer = 0.55;

      const novaRadius = 11.2;
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        const d = Math.hypot(
          enemy.root.position.x - heroAnchor.position.x,
          enemy.root.position.z - heroAnchor.position.z
        );
        if (d <= novaRadius) {
          damageEnemy(enemy, 185, 2.6, '#FF1E42', true);
          g.combo += 1;
          g.maxCombo = Math.max(g.maxCombo, g.combo);
        }
      }
      g.comboResetTimer = 3.5;
      enemies = enemies.filter((e) => e.hp > 0);
      spawnBurstParticles(heroAnchor.position.x, 1.2, heroAnchor.position.z, 0x00f0ff, 22);
      pushFloatingNumber(
        heroAnchor.position.x,
        3.1,
        heroAnchor.position.z,
        'COSMIC NOVA!',
        '#00F0FF'
      );
    };

    const startNewRun = () => {
      const g = gameRef.current;
      clearDynamicEntities();
      floatingQueue.length = 0;
      setFloatingNumbers([]);
      setAcquiredUpgrades([]);
      setSessionRewards(null);

      g.hp = armoryRef.current.initialMaxHp;
      g.maxHp = armoryRef.current.initialMaxHp;
      g.novaEnergy = armoryRef.current.initialNova;
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
      g.upgrades.clear();
      g.reportedSession = false;
      g.endlessMode = false;

      heroAnchor.position.set(0, 0, 4.5);
      heroAnchor.rotation.set(0, Math.PI, 0);
      inputRef.current.cameraYaw = 0;
      inputRef.current.cameraPitch = 0.14;
      applyUpgradeVisuals();
      beginWaveIncoming(1);
      setSyncedPhase('PLAYING');
    };

    engineActionsRef.current = {
      startNewRun,
      beginWaveIncoming,
      triggerAttack: executeSwordAttack,
      triggerDash: executeDash,
      triggerNova: executeCosmicNova,
      applyUpgradeVisuals,
    };

    // Pre-warm shaders once on non-software WebGL
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      const w = Math.max(320, mount.clientWidth || 960);
      const h = Math.max(180, mount.clientHeight || 540);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isMobileBrowser ? 1.15 : 1.35)
      );
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let hudSyncAccum = 0;
    let ghostSpawnTimer = 0;
    let hadFloatingLastSync = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : 1;
        if (sync && state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 4);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 24);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    const tick = () => {
      if (disposed) return;
      const rawDt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const g = gameRef.current;

      // Ambient Arena Animations (Embers + Floating Broken Pillar Crowns)
      for (let i = 0; i < floatingShards.length; i++) {
        const fs = floatingShards[i];
        fs.mesh.position.y = fs.baseY + Math.sin(elapsed * 1.8 + fs.phase) * 0.22;
        fs.mesh.rotation.y += rawDt * 0.45;
      }

      for (let i = 0; i < moteCount; i++) {
        const m = moteData[i];
        m.y += m.speed * rawDt;
        if (m.y > 9.5) m.y = 0.3;
        const a = m.angle + elapsed * 0.16;
        _dummy.position.set(
          Math.cos(a) * m.radius,
          m.y + Math.sin(elapsed * 2 + m.phase) * 0.25,
          Math.sin(a) * m.radius
        );
        _dummy.rotation.set(elapsed + m.phase, elapsed * 0.7, 0);
        _dummy.scale.setScalar(0.85 + Math.sin(elapsed * 3 + m.phase) * 0.3);
        _dummy.updateMatrix();
        moteInstanced.setMatrixAt(i, _dummy.matrix);
      }
      moteInstanced.instanceMatrix.needsUpdate = true;

      const isFirstPerson = cameraModeRef.current === '1ST' && phaseRef.current === 'PLAYING';
      heroAnchor.visible = !isFirstPerson;
      fpViewModel.root.visible = isFirstPerson;

      if (phaseRef.current === 'PLAYING') {
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

        if (g.hitStopTimer > 0) {
          g.hitStopTimer = Math.max(0, g.hitStopTimer - rawDt);
        }

        const timeScale = g.waveState === 'CLEARED_SLOWMO' ? 0.22 : 1.0;
        const dt = (g.hitStopTimer > 0 ? rawDt * 0.14 : rawDt) * timeScale;

        // Wave Incoming Countdown
        if (g.waveState === 'INCOMING') {
          g.waveCountdown = Math.max(0, g.waveCountdown - dt);
          if (g.waveCountdown <= 0) {
            g.waveState = 'ACTIVE';
            spawnWaveEntities(g.wave);
          }
        }

        if (g.dashCharges < g.maxDashCharges) {
          g.dashRechargeTimer += dt;
          if (g.dashRechargeTimer >= g.dashCooldownDuration) {
            g.dashRechargeTimer = 0;
            g.dashCharges += 1;
          }
        }

        if (g.invulnTimer > 0) g.invulnTimer = Math.max(0, g.invulnTimer - dt);
        if (g.attackCooldownTimer > 0)
          g.attackCooldownTimer = Math.max(0, g.attackCooldownTimer - dt);
        if (g.comboChainWindow > 0) g.comboChainWindow = Math.max(0, g.comboChainWindow - dt);
        if (g.bannerTimer > 0 && g.waveState === 'ACTIVE') {
          g.bannerTimer = Math.max(0, g.bannerTimer - dt);
          if (g.bannerTimer === 0) g.bannerText = '';
        }
        if (g.combo > 1) {
          g.comboResetTimer -= dt;
          if (g.comboResetTimer <= 0) g.combo = 1;
        }

        // Player Movement, Dash & Skeletal Animation State
        let isMoving = false;
        if (g.dashActiveTimer > 0) {
          isMoving = true;
          g.dashActiveTimer = Math.max(0, g.dashActiveTimer - dt);
          heroAnchor.position.x += g.dashDirX * 22 * dt;
          heroAnchor.position.z += g.dashDirZ * 22 * dt;
          fallbackHeroRig.capeMesh.rotation.x = 0.72;
          fallbackHeroRig.scarfMesh.rotation.x = 0.85;
          ghostSpawnTimer += dt;
          if (ghostSpawnTimer >= 0.065) {
            ghostSpawnTimer = 0;
            const tripleDashStacks = g.upgrades.get('triple-dash') ?? 0;
            spawnDashGhost(tripleDashStacks > 0);
          }
          glbHero?.setAnimState('run');
        } else {
          const mv = getCameraRelativeInputVector();
          const mag = Math.hypot(mv.x, mv.z);
          if (mag > 0.08) {
            isMoving = true;
            const moveSpeed = 7.8;
            heroAnchor.position.x += mv.x * moveSpeed * dt;
            heroAnchor.position.z += mv.z * moveSpeed * dt;
            const targetRot = Math.atan2(mv.x, mv.z);
            let diff = targetRot - heroAnchor.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            heroAnchor.rotation.y += diff * Math.min(1, dt * 14);

            glbHero?.setAnimState(mag > 0.45 ? 'run' : 'walk');

            // Fallback procedural animation if offline
            if (!glbHero) {
              const walkCycle = Math.sin(elapsed * 14);
              fallbackHeroRig.leftLegPivot.rotation.x = walkCycle * 0.58;
              fallbackHeroRig.rightLegPivot.rotation.x = -walkCycle * 0.58;
              fallbackHeroRig.leftArmPivot.rotation.x = -walkCycle * 0.42;
              fallbackHeroRig.bodyGroup.position.y = Math.abs(Math.cos(elapsed * 14)) * 0.045;
              fallbackHeroRig.capeMesh.rotation.x = 0.48 + Math.sin(elapsed * 11) * 0.14;
              fallbackHeroRig.scarfMesh.rotation.x = 0.62 + Math.cos(elapsed * 13) * 0.18;
            }
          } else {
            glbHero?.setAnimState('idle');

            if (!glbHero) {
              fallbackHeroRig.leftLegPivot.rotation.x = THREE.MathUtils.damp(
                fallbackHeroRig.leftLegPivot.rotation.x,
                0,
                12,
                dt
              );
              fallbackHeroRig.rightLegPivot.rotation.x = THREE.MathUtils.damp(
                fallbackHeroRig.rightLegPivot.rotation.x,
                0,
                12,
                dt
              );
              fallbackHeroRig.leftArmPivot.rotation.x = THREE.MathUtils.damp(
                fallbackHeroRig.leftArmPivot.rotation.x,
                0,
                12,
                dt
              );
              fallbackHeroRig.bodyGroup.position.y = Math.sin(elapsed * 2.6) * 0.025;
              fallbackHeroRig.capeMesh.rotation.x = 0.24 + Math.sin(elapsed * 3) * 0.06;
              fallbackHeroRig.scarfMesh.rotation.x = 0.34 + Math.cos(elapsed * 3.6) * 0.08;
            }
          }
        }

        // Clamp hero inside circular Rune Arena
        const heroDist = Math.hypot(heroAnchor.position.x, heroAnchor.position.z);
        if (heroDist > ARENA_RADIUS - 0.7) {
          const clampScale = (ARENA_RADIUS - 0.7) / heroDist;
          heroAnchor.position.x *= clampScale;
          heroAnchor.position.z *= clampScale;
        }

        // 3-Hit Sword Swing Animation (Both 3rd-Person Bone Swing & 1st-Person Cyber-Arm Slash!)
        let attackProgress = 0;
        const isAttacking = g.attackAnimTimer > 0;
        if (isAttacking) {
          g.attackAnimTimer = Math.max(0, g.attackAnimTimer - dt);
          attackProgress = 1 - g.attackAnimTimer / g.attackAnimDuration;

          if (!glbHero) {
            if (g.comboStep === 1) {
              fallbackHeroRig.weaponPivot.rotation.y = THREE.MathUtils.lerp(-1.45, 1.55, attackProgress);
              fallbackHeroRig.weaponPivot.rotation.x = 0.42;
            } else if (g.comboStep === 2) {
              fallbackHeroRig.weaponPivot.rotation.y = THREE.MathUtils.lerp(1.55, -1.55, attackProgress);
              fallbackHeroRig.weaponPivot.rotation.x = 0.12;
            } else {
              fallbackHeroRig.weaponPivot.rotation.y = attackProgress * Math.PI * 2;
              fallbackHeroRig.weaponPivot.rotation.x = Math.sin(attackProgress * Math.PI) * 1.15;
            }
          }

          // First-Person ViewModel Dynamic Slash Choreography
          if (g.comboStep === 1) {
            fpViewModel.armPivot.position.set(
              THREE.MathUtils.lerp(0.45, -0.32, attackProgress),
              THREE.MathUtils.lerp(-0.22, -0.44, attackProgress),
              -0.56 - Math.sin(attackProgress * Math.PI) * 0.14
            );
            fpViewModel.swordPivot.rotation.set(
              THREE.MathUtils.lerp(-0.2, -1.25, attackProgress),
              THREE.MathUtils.lerp(0.15, 1.45, attackProgress),
              THREE.MathUtils.lerp(-0.2, 1.35, attackProgress)
            );
          } else if (g.comboStep === 2) {
            fpViewModel.armPivot.position.set(
              THREE.MathUtils.lerp(-0.3, 0.42, attackProgress),
              THREE.MathUtils.lerp(-0.34, -0.24, attackProgress),
              -0.56 - Math.sin(attackProgress * Math.PI) * 0.16
            );
            fpViewModel.swordPivot.rotation.set(
              THREE.MathUtils.lerp(-0.9, -0.25, attackProgress),
              THREE.MathUtils.lerp(1.3, -0.9, attackProgress),
              THREE.MathUtils.lerp(1.3, -0.85, attackProgress)
            );
          } else {
            fpViewModel.armPivot.position.set(
              0.28 - Math.sin(attackProgress * Math.PI) * 0.25,
              -0.28 + Math.sin(attackProgress * Math.PI) * 0.14,
              -0.52 - Math.sin(attackProgress * Math.PI) * 0.26
            );
            fpViewModel.swordPivot.rotation.set(
              -0.8 - Math.sin(attackProgress * Math.PI) * 0.85,
              attackProgress * Math.PI * 2.2,
              0.85
            );
          }

          slashArcMat.opacity = Math.max(0, (1 - attackProgress) * 0.92);
          if (g.attackAnimTimer === 0) {
            slashArcMesh.visible = false;
            if (g.attackBuffered && g.attackCooldownTimer === 0) {
              executeSwordAttack();
            }
          }
        } else {
          if (!glbHero) {
            fallbackHeroRig.weaponPivot.rotation.y = THREE.MathUtils.damp(
              fallbackHeroRig.weaponPivot.rotation.y,
              0,
              12,
              dt
            );
            fallbackHeroRig.weaponPivot.rotation.x = THREE.MathUtils.damp(
              fallbackHeroRig.weaponPivot.rotation.x,
              0,
              12,
              dt
            );
          }

          // First-Person ViewModel Idle Breathing / Sprint Bob
          const bobX = isMoving ? Math.cos(elapsed * 10) * 0.025 : Math.cos(elapsed * 2) * 0.006;
          const bobY = isMoving
            ? Math.abs(Math.sin(elapsed * 10)) * 0.028
            : Math.sin(elapsed * 2.4) * 0.008;
          fpViewModel.armPivot.position.x = THREE.MathUtils.damp(
            fpViewModel.armPivot.position.x,
            0.36 + bobX,
            12,
            rawDt
          );
          fpViewModel.armPivot.position.y = THREE.MathUtils.damp(
            fpViewModel.armPivot.position.y,
            -0.34 + bobY,
            12,
            rawDt
          );
          fpViewModel.armPivot.position.z = THREE.MathUtils.damp(
            fpViewModel.armPivot.position.z,
            -0.58,
            12,
            rawDt
          );
          fpViewModel.swordPivot.rotation.x = THREE.MathUtils.damp(
            fpViewModel.swordPivot.rotation.x,
            -0.34,
            12,
            rawDt
          );
          fpViewModel.swordPivot.rotation.y = THREE.MathUtils.damp(
            fpViewModel.swordPivot.rotation.y,
            0.24,
            12,
            rawDt
          );
          fpViewModel.swordPivot.rotation.z = THREE.MathUtils.damp(
            fpViewModel.swordPivot.rotation.z,
            0.36,
            12,
            rawDt
          );

          if (g.attackBuffered && g.attackCooldownTimer === 0) {
            executeSwordAttack();
          }
        }

        glbHero?.update(dt, isAttacking, g.comboStep, attackProgress);

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
          healAuraMesh.position.set(heroAnchor.position.x, 0.14, heroAnchor.position.z);
          healAuraMesh.scale.setScalar(0.8 + hp * 1.6);
          healAuraMat.opacity = (1 - hp) * 0.9;
          if (healAuraTimer === 0) healAuraMesh.visible = false;
        }

        // Enemy AI + Visible Attack Windup & Swing Animation + Skeletal Animation Update
        const flameStacks = g.upgrades.get('crimson-flame') ?? 0;
        let anyEnemyDied = false;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) {
            anyEnemyDied = true;
            continue;
          }

          if (enemy.burnTimer > 0) {
            enemy.burnTimer -= dt;
            enemy.burnTickTimer += dt;
            if (enemy.burnTickTimer >= 0.5) {
              enemy.burnTickTimer = 0;
              const burnDmg = 18 * Math.max(1, flameStacks);
              enemy.hp = Math.max(0, enemy.hp - burnDmg);
              spawnBurstParticles(
                enemy.root.position.x,
                1.2,
                enemy.root.position.z,
                0xff4500,
                4
              );
              pushFloatingNumber(
                enemy.root.position.x,
                2.0,
                enemy.root.position.z,
                `-${burnDmg} BURN`,
                '#FF6B35'
              );
              if (enemy.hp <= 0) {
                anyEnemyDied = true;
                g.kills += 1;
                g.lastKillX = enemy.root.position.x;
                g.lastKillZ = enemy.root.position.z;
                g.score += 130;
                disposeEnemy(enemy);
                if (enemy.kind === 'boss') bossTelegraphMesh.visible = false;
                continue;
              }
            }
          }

          if (enemy.hitFlash > 0) {
            enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
            const bounce = 1 + (enemy.hitFlash / 0.14) * 0.12;
            enemy.root.scale.setScalar(bounce);
          } else {
            enemy.root.scale.setScalar(1);
          }

          const dx = heroAnchor.position.x - enemy.root.position.x;
          const dz = heroAnchor.position.z - enemy.root.position.z;
          const dist = Math.hypot(dx, dz) || 1;
          enemy.root.rotation.y = Math.atan2(dx, dz);

          let enemyMoving = false;
          let enemyAttackProgress = 0;

          // Advance active melee / cast swing timer
          if (enemy.attackState === 'swinging') {
            enemy.attackAnimTimer = Math.max(0, enemy.attackAnimTimer - dt);
            enemyAttackProgress = 1 - enemy.attackAnimTimer / Math.max(0.01, enemy.attackAnimDuration);
            if (enemy.attackAnimTimer === 0) {
              enemy.attackState = 'idle';
            }
          }

          if (enemy.kind === 'stalker') {
            if (enemy.attackState === 'idle' && dist > 1.75) {
              enemyMoving = true;
              enemy.root.position.x += (dx / dist) * enemy.speed * dt;
              enemy.root.position.z += (dz / dist) * enemy.speed * dt;
              if (enemy.fallbackRig) {
                const stride = Math.sin(elapsed * 17 + enemy.id);
                if (enemy.fallbackRig.leftLegPivot) enemy.fallbackRig.leftLegPivot.rotation.x = stride * 0.65;
                if (enemy.fallbackRig.rightLegPivot) enemy.fallbackRig.rightLegPivot.rotation.x = -stride * 0.65;
              }
            }
            enemy.attackCooldown -= dt;
            if (enemy.attackState === 'idle' && dist <= 2.35 && enemy.attackCooldown <= 0) {
              enemy.attackState = 'swinging';
              enemy.attackAnimDuration = 0.42;
              enemy.attackAnimTimer = 0.42;
              enemy.attackImpactDone = false;
              enemy.attackCooldown = 1.05;
              spawnBurstParticles(enemy.root.position.x, 1.5, enemy.root.position.z, 0xff1e42, 3);
            }
            if (
              enemy.attackState === 'swinging' &&
              enemyAttackProgress >= 0.5 &&
              !enemy.attackImpactDone
            ) {
              enemy.attackImpactDone = true;
              audio.playSwordSwing(1);
              spawnEnemySlashArc(
                enemy.root.position.x,
                enemy.root.position.z,
                enemy.root.rotation.y,
                0.8,
                0xff1e42
              );
              if (dist <= 2.75 && g.invulnTimer <= 0) {
                g.hp = Math.max(0, g.hp - 11);
                g.invulnTimer = 0.42;
                g.cameraShake = 0.26;
                audio.playPlayerHurt();
                pushFloatingNumber(
                  heroAnchor.position.x,
                  2.2,
                  heroAnchor.position.z,
                  '-11',
                  '#FF1E42'
                );
              }
            }
            if (enemy.fallbackRig) {
              if (enemy.attackState === 'swinging') {
                const swingRot =
                  enemyAttackProgress < 0.38
                    ? THREE.MathUtils.lerp(0, -1.35, enemyAttackProgress / 0.38)
                    : THREE.MathUtils.lerp(-1.35, 1.35, (enemyAttackProgress - 0.38) / 0.62);
                enemy.fallbackRig.weaponPivot.rotation.x = swingRot;
                if (enemy.fallbackRig.offhandPivot) {
                  enemy.fallbackRig.offhandPivot.rotation.x = -swingRot * 0.85;
                }
              } else {
                enemy.fallbackRig.weaponPivot.rotation.x = THREE.MathUtils.damp(
                  enemy.fallbackRig.weaponPivot.rotation.x,
                  0,
                  10,
                  dt
                );
              }
            }
            enemy.glb?.setAnimState(enemyMoving ? 'run' : 'idle');
          } else if (enemy.kind === 'juggernaut') {
            if (enemy.attackState === 'idle' && dist > 2.15) {
              enemyMoving = true;
              enemy.root.position.x += (dx / dist) * enemy.speed * dt;
              enemy.root.position.z += (dz / dist) * enemy.speed * dt;
              if (enemy.fallbackRig) {
                const stride = Math.sin(elapsed * 8 + enemy.id);
                if (enemy.fallbackRig.leftLegPivot) enemy.fallbackRig.leftLegPivot.rotation.x = stride * 0.42;
                if (enemy.fallbackRig.rightLegPivot) enemy.fallbackRig.rightLegPivot.rotation.x = -stride * 0.42;
              }
            }
            enemy.attackCooldown -= dt;
            if (enemy.attackState === 'idle' && dist <= 2.75 && enemy.attackCooldown <= 0) {
              enemy.attackState = 'swinging';
              enemy.attackAnimDuration = 0.56;
              enemy.attackAnimTimer = 0.56;
              enemy.attackImpactDone = false;
              enemy.attackCooldown = 1.75;
              spawnBurstParticles(enemy.root.position.x, 1.8, enemy.root.position.z, 0xff4500, 4);
            }
            if (
              enemy.attackState === 'swinging' &&
              enemyAttackProgress >= 0.54 &&
              !enemy.attackImpactDone
            ) {
              enemy.attackImpactDone = true;
              audio.playSwordSwing(3);
              spawnEnemySlashArc(
                enemy.root.position.x,
                enemy.root.position.z,
                enemy.root.rotation.y,
                1.05,
                0xff4500
              );
              if (dist <= 3.15 && g.invulnTimer <= 0) {
                g.hp = Math.max(0, g.hp - 18);
                g.invulnTimer = 0.52;
                g.cameraShake = 0.4;
                audio.playPlayerHurt();
                pushFloatingNumber(
                  heroAnchor.position.x,
                  2.3,
                  heroAnchor.position.z,
                  '-18 HEAVY',
                  '#FF4500'
                );
              }
            }
            if (enemy.fallbackRig) {
              if (enemy.attackState === 'swinging') {
                const swingRot =
                  enemyAttackProgress < 0.4
                    ? THREE.MathUtils.lerp(0, -1.5, enemyAttackProgress / 0.4)
                    : THREE.MathUtils.lerp(-1.5, 1.45, (enemyAttackProgress - 0.4) / 0.6);
                enemy.fallbackRig.weaponPivot.rotation.x = swingRot;
              } else {
                enemy.fallbackRig.weaponPivot.rotation.x = THREE.MathUtils.damp(
                  enemy.fallbackRig.weaponPivot.rotation.x,
                  0,
                  7,
                  dt
                );
              }
            }
            enemy.glb?.setAnimState(enemyMoving ? 'walk' : 'idle');
          } else if (enemy.kind === 'mage') {
            if (enemy.attackState === 'idle') {
              if (dist > 10.5) {
                enemyMoving = true;
                enemy.root.position.x += (dx / dist) * enemy.speed * dt;
                enemy.root.position.z += (dz / dist) * enemy.speed * dt;
              } else if (dist < 6.0) {
                enemyMoving = true;
                enemy.root.position.x -= (dx / dist) * enemy.speed * 0.7 * dt;
                enemy.root.position.z -= (dz / dist) * enemy.speed * 0.7 * dt;
              }
            }
            enemy.attackCooldown -= dt;
            if (enemy.attackState === 'idle' && enemy.attackCooldown <= 0) {
              enemy.attackState = 'swinging';
              enemy.attackAnimDuration = 0.46;
              enemy.attackAnimTimer = 0.46;
              enemy.attackImpactDone = false;
              enemy.attackCooldown = 2.4;
            }
            if (
              enemy.attackState === 'swinging' &&
              enemyAttackProgress >= 0.48 &&
              !enemy.attackImpactDone
            ) {
              enemy.attackImpactDone = true;
              spawnMageProjectile(
                enemy.root.position.x,
                enemy.root.position.z,
                (dx / dist) * 8.6,
                (dz / dist) * 8.6
              );
            }
            enemy.glb?.setAnimState(enemyMoving ? 'walk' : 'idle');
          } else if (enemy.kind === 'boss') {
            if (enemy.slamState === 'idle') {
              if (enemy.attackState === 'idle' && dist > 2.85) {
                enemyMoving = true;
                enemy.root.position.x += (dx / dist) * enemy.speed * dt;
                enemy.root.position.z += (dz / dist) * enemy.speed * dt;
                if (enemy.fallbackRig) {
                  const stride = Math.sin(elapsed * 7.5);
                  if (enemy.fallbackRig.leftLegPivot) enemy.fallbackRig.leftLegPivot.rotation.x = stride * 0.45;
                  if (enemy.fallbackRig.rightLegPivot) enemy.fallbackRig.rightLegPivot.rotation.x = -stride * 0.45;
                }
              }
              enemy.attackCooldown -= dt;
              if (enemy.attackState === 'idle' && enemy.attackCooldown <= 0) {
                if (dist <= 3.7) {
                  enemy.attackState = 'swinging';
                  enemy.attackAnimDuration = 0.54;
                  enemy.attackAnimTimer = 0.54;
                  enemy.attackImpactDone = false;
                  enemy.attackCooldown = 1.9;
                  spawnBurstParticles(enemy.root.position.x, 2.4, enemy.root.position.z, 0xff1e42, 6);
                } else if (dist < 8.5) {
                  enemy.slamState = 'telegraph';
                  enemy.slamTimer = 1.25;
                  enemy.slamTargetX = heroAnchor.position.x;
                  enemy.slamTargetZ = heroAnchor.position.z;
                  bossTelegraphMesh.position.set(enemy.slamTargetX, 0.05, enemy.slamTargetZ);
                  bossTelegraphMesh.scale.setScalar(0.4);
                  bossTelegraphMesh.visible = true;
                } else {
                  enemy.attackCooldown = 1.1;
                }
              }
              if (
                enemy.attackState === 'swinging' &&
                enemyAttackProgress >= 0.52 &&
                !enemy.attackImpactDone
              ) {
                enemy.attackImpactDone = true;
                audio.playSwordSwing(3);
                spawnEnemySlashArc(
                  enemy.root.position.x,
                  enemy.root.position.z,
                  enemy.root.rotation.y,
                  1.45,
                  0xff1e42
                );
                if (dist <= 4.15 && g.invulnTimer <= 0) {
                  g.hp = Math.max(0, g.hp - 22);
                  g.invulnTimer = 0.55;
                  g.cameraShake = 0.48;
                  audio.playPlayerHurt();
                  pushFloatingNumber(
                    heroAnchor.position.x,
                    2.4,
                    heroAnchor.position.z,
                    '-22 CLEAVE!',
                    '#FF1E42'
                  );
                }
              }
              enemy.glb?.setAnimState(enemyMoving ? 'walk' : 'idle');
            } else {
              enemy.slamTimer -= dt;
              enemy.root.position.y = Math.sin((1.25 - enemy.slamTimer) * 2.5) * 0.9;
              const s = 0.4 + (1 - Math.max(0, enemy.slamTimer) / 1.25) * 0.65;
              bossTelegraphMesh.scale.setScalar(s);

              if (enemy.slamTimer <= 0) {
                enemy.slamState = 'idle';
                enemy.slamTimer = 0;
                enemy.attackCooldown = 2.5;
                enemy.root.position.y = 0;
                bossTelegraphMesh.visible = false;
                audio.playBossSlam();
                g.cameraShake = 0.65;
                spawnBurstParticles(enemy.slamTargetX, 0.4, enemy.slamTargetZ, 0xff1e42, 20);

                const hitDist = Math.hypot(
                  heroAnchor.position.x - enemy.slamTargetX,
                  heroAnchor.position.z - enemy.slamTargetZ
                );
                if (hitDist <= 4.7 && g.invulnTimer <= 0) {
                  g.hp = Math.max(0, g.hp - 28);
                  g.invulnTimer = 0.65;
                  audio.playPlayerHurt();
                  pushFloatingNumber(
                    heroAnchor.position.x,
                    2.4,
                    heroAnchor.position.z,
                    '-28 SLAM!',
                    '#FF1E42'
                  );
                }
              }
            }
          }

          // Clamp enemies inside arena
          const eDist = Math.hypot(enemy.root.position.x, enemy.root.position.z);
          if (eDist > ARENA_RADIUS - 0.8) {
            const s = (ARENA_RADIUS - 0.8) / eDist;
            enemy.root.position.x *= s;
            enemy.root.position.z *= s;
          }

          enemy.glb?.update(
            dt,
            elapsed,
            enemy.attackState === 'swinging',
            enemyAttackProgress,
            enemy.kind
          );
          if (enemy.fallbackRig) {
            if (enemy.fallbackRig.ringMesh) enemy.fallbackRig.ringMesh.rotation.z += dt * 2.1;
            if (enemy.fallbackRig.shoulderCrystals) {
              enemy.fallbackRig.shoulderCrystals.position.y = 3.72 + Math.sin(elapsed * 3.4) * 0.14;
              enemy.fallbackRig.shoulderCrystals.rotation.y += dt * 1.4;
            }
          }
        }
        if (anyEnemyDied) {
          enemies = enemies.filter((e) => e.hp > 0);
        }

        // Update Pooled Enemy Slash Arcs
        for (let i = 0; i < ENEMY_SLASH_POOL_SIZE; i++) {
          const s = enemySlashPool[i];
          if (s.life <= 0) continue;
          s.life = Math.max(0, s.life - dt);
          s.mat.opacity = (s.life / 0.22) * 0.9;
          s.mesh.rotation.y += dt * 7;
          if (s.life === 0) s.mesh.visible = false;
        }

        // Update Pooled Void Projectiles
        for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
          const p = projectilePool[i];
          if (!p.active) continue;
          p.life -= dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.mesh.position.set(p.x, 1.35, p.z);

          const distToHero = Math.hypot(
            p.x - heroAnchor.position.x,
            p.z - heroAnchor.position.z
          );
          if (distToHero < 0.9) {
            if (g.invulnTimer <= 0) {
              g.hp = Math.max(0, g.hp - p.damage);
              g.invulnTimer = 0.45;
              g.cameraShake = 0.24;
              audio.playPlayerHurt();
              pushFloatingNumber(
                heroAnchor.position.x,
                2.2,
                heroAnchor.position.z,
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

        // Check Player Defeat or Wave Clear Slow-Motion Kill-Cam
        if (g.hp <= 0) {
          finishMatch(false);
        } else if (g.waveState === 'ACTIVE' && enemies.length === 0) {
          g.waveState = 'CLEARED_SLOWMO';
          g.waveClearTimer = 1.45;
          g.bannerText = `WAVE ${g.wave} CLEARED!`;
          g.bannerTimer = 1.45;
          audio.playWaveClear();
        } else if (g.waveState === 'CLEARED_SLOWMO') {
          g.waveClearTimer -= rawDt;
          if (g.waveClearTimer <= 0) {
            if (g.wave === 3 && !g.endlessMode) {
              finishMatch(true);
            } else {
              audio.playVictoryChime();
              const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
              setUpgradeChoices(shuffled);
              setSyncedPhase('UPGRADE_PICK');
            }
          }
        }
      } else {
        // Title / Upgrade / Pause subtle idle animation
        glbHero?.setAnimState('idle');
        glbHero?.update(rawDt, false, 1, 0);
        if (!glbHero) {
          fallbackHeroRig.capeMesh.rotation.x = 0.24 + Math.sin(elapsed * 2.5) * 0.06;
          fallbackHeroRig.scarfMesh.rotation.x = 0.34 + Math.cos(elapsed * 2.8) * 0.08;
        }
      }

      // Update Pooled Instanced Burst Particles
      const particleDt =
        phaseRef.current === 'PLAYING' && g.waveState === 'CLEARED_SLOWMO' ? rawDt * 0.25 : rawDt;
      let particlesDirty = false;
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        particlesDirty = true;
        p.life -= particleDt;
        if (p.life > 0) {
          p.vy -= 14 * particleDt;
          p.x += p.vx * particleDt;
          p.y = Math.max(0.08, p.y + p.vy * particleDt);
          p.z += p.vz * particleDt;
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
                enemy.root.position.x - gh.x,
                enemy.root.position.z - gh.z
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

      // === CAMERA SYSTEM: Over-the-Shoulder 3RD-Person & First-Person POV (Zero Top-Down!) ===
      if (g.cameraShake > 0) {
        g.cameraShake = Math.max(0, g.cameraShake - rawDt * 2.4);
      }
      const shakeX = (Math.random() - 0.5) * g.cameraShake * 0.45;
      const shakeY = (Math.random() - 0.5) * g.cameraShake * 0.45;

      const yaw = inputRef.current.cameraYaw;
      const pitch = inputRef.current.cameraPitch;
      const camFwdX = -Math.sin(yaw);
      const camFwdZ = -Math.cos(yaw);
      const camRightX = Math.cos(yaw);
      const camRightZ = -Math.sin(yaw);

      if (phaseRef.current === 'TITLE_MENU') {
        // Dramatic low-angle showcase behind hero looking across arena
        const idleYaw = Math.sin(elapsed * 0.28) * 0.25;
        const rX = Math.cos(idleYaw);
        const rZ = -Math.sin(idleYaw);
        const fX = -Math.sin(idleYaw);
        const fZ = -Math.cos(idleYaw);
        _camTargetPos.set(
          heroAnchor.position.x + rX * 0.7 - fX * 4.2,
          2.1,
          heroAnchor.position.z + rZ * 0.7 - fZ * 4.2
        );
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-6 * rawDt));
        _camLookTarget.set(
          heroAnchor.position.x + fX * 7,
          1.55,
          heroAnchor.position.z + fZ * 7
        );
        camera.lookAt(_camLookTarget);
      } else if (phaseRef.current === 'PLAYING' && g.waveState === 'CLEARED_SLOWMO') {
        // Kill-cam dramatic over-the-shoulder zoom toward final defeated enemy
        const focusX = THREE.MathUtils.lerp(heroAnchor.position.x, g.lastKillX, 0.4);
        const focusZ = THREE.MathUtils.lerp(heroAnchor.position.z, g.lastKillZ, 0.4);
        _camTargetPos.set(
          focusX + camRightX * 1.1 - camFwdX * 3.8 + shakeX,
          2.2 + shakeY,
          focusZ + camRightZ * 1.1 - camFwdZ * 3.8
        );
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-7 * rawDt));
        _camLookTarget.set(focusX, 1.35, focusZ);
        camera.lookAt(_camLookTarget);
      } else if (isFirstPerson) {
        // True First-Person POV at warrior eye level (y = 1.68)
        camera.position.set(
          heroAnchor.position.x + shakeX * 0.4,
          1.68 + shakeY * 0.4,
          heroAnchor.position.z
        );
        const cosP = Math.cos(pitch);
        _camLookTarget.set(
          camera.position.x + camFwdX * cosP * 10,
          camera.position.y - Math.sin(pitch) * 10,
          camera.position.z + camFwdZ * cosP * 10
        );
        camera.lookAt(_camLookTarget);
      } else {
        // Close Over-the-Shoulder Third-Person Action Camera: offset (0.7, 2.1, 4.2) rotated by look yaw/pitch
        const verticalOffset = 2.1 + Math.sin(pitch) * 1.35;
        const backDist = 4.2 * Math.cos(pitch * 0.45);
        _camTargetPos.set(
          heroAnchor.position.x + camRightX * 0.7 - camFwdX * backDist + shakeX,
          Math.max(1.15, verticalOffset) + shakeY,
          heroAnchor.position.z + camRightZ * 0.7 - camFwdZ * backDist
        );
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-14 * rawDt));

        // Eye-level forward target across the arena
        _camLookTarget.set(
          heroAnchor.position.x + camRightX * 0.35 + camFwdX * 11,
          Math.max(0.6, 1.55 - Math.sin(pitch) * 4.5),
          heroAnchor.position.z + camRightZ * 0.35 + camFwdZ * 11
        );
        camera.lookAt(_camLookTarget);
      }

      // Billboard all enemy head health bars toward active camera
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.glb) {
          e.glb.updateHealthBar(e.hp, e.maxHp, camera.quaternion);
        } else if (e.fallbackBar) {
          const ratio = Math.max(0.001, Math.min(1, e.hp / Math.max(1, e.maxHp)));
          e.fallbackBar.fill.scale.x = ratio;
          e.fallbackBar.group.quaternion.copy(camera.quaternion);
        }
      }

      renderer.render(scene, camera);

      // Sync React HUD + Projected Floating Damage Numbers (~14Hz, zero empty re-renders)
      hudSyncAccum += rawDt;
      if (hudSyncAccum >= 0.072) {
        hudSyncAccum = 0;

        if (phaseRef.current === 'PLAYING') {
          const boss = enemies.find((e) => e.kind === 'boss');
          setHudState({
            hp: Math.ceil(g.hp),
            maxHp: g.maxHp,
            novaEnergy: Math.floor(g.novaEnergy),
            wave: g.wave,
            waveState: g.waveState,
            waveCountdown: g.waveCountdown,
            enemiesRemaining: enemies.length,
            waveTotalEnemies: g.waveTotalEnemies,
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
            bossName: boss ? `CHRONO BOSS · WAVE ${g.wave} OVERLORD` : '',
            bannerText: g.bannerText,
          });
        }

        if (floatingQueue.length > 0 || hadFloatingLastSync) {
          const mountW = mount.clientWidth || 960;
          const mountH = mount.clientHeight || 540;
          const nextFloats: FloatingDmg[] = [];
          for (let i = floatingQueue.length - 1; i >= 0; i--) {
            const item = floatingQueue[i];
            item.ttl -= 0.072;
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
          hadFloatingLastSync = nextFloats.length > 0;
          setFloatingNumbers(nextFloats);
        }
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
      glbHero?.dispose();
      fpViewModel.dispose();
      fallbackEnemyFactory.dispose();

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

      arenaTextures.map.dispose();
      arenaTextures.roughnessMap.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [domainCheck.authorized, finishMatch, isMuted, setSyncedPhase]);

  // Keyboard bindings (WASD + Q/E or Arrow/Drag Look + Space/J Attack + Shift/K Dash + F/L Cosmic Nova + V View + P Pause)
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
      } else if (e.code === 'KeyV') {
        if (phaseRef.current === 'PLAYING') {
          toggleCameraView();
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
  }, [onToggleMute, setSyncedPhase, toggleCameraView]);

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
    engineActionsRef.current?.beginWaveIncoming(g.wave + 1);
    setSyncedPhase('PLAYING');
  };

  const handleContinueEndless = () => {
    const g = gameRef.current;
    g.endlessMode = true;
    g.reportedSession = false;
    g.hp = Math.min(g.maxHp, g.hp + 60);
    setSessionRewards(null);
    engineActionsRef.current?.beginWaveIncoming(g.wave + 1);
    setSyncedPhase('PLAYING');
  };

  // Virtual Joystick Pointer Handlers (Enlarged 164px outer ring, multi-touch safe)
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
    const maxR = 62;
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

  // Right-Screen / Arena Touch-Drag Camera Look Handlers (Horizontal & Vertical)
  const handleCanvasLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'PLAYING') return;
    if (inputRef.current.lookPointerId !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    inputRef.current.lookPointerId = e.pointerId;
    inputRef.current.lookLastX = e.clientX;
    inputRef.current.lookLastY = e.clientY;
    inputRef.current.lookMovedDist = 0;
  };

  const handleCanvasLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inputRef.current.lookPointerId !== e.pointerId) return;
    const screenDx = e.clientX - inputRef.current.lookLastX;
    const screenDy = e.clientY - inputRef.current.lookLastY;
    inputRef.current.lookLastX = e.clientX;
    inputRef.current.lookLastY = e.clientY;

    const mount = canvasMountRef.current;
    const mountRect = mount?.getBoundingClientRect();
    const isCssRotated = Boolean(
      mount &&
        mountRect &&
        mountRect.width < mountRect.height &&
        mount.clientWidth > mount.clientHeight
    );

    const dx = isCssRotated ? screenDy : screenDx;
    const dy = isCssRotated ? -screenDx : screenDy;

    inputRef.current.lookMovedDist += Math.hypot(dx, dy);
    inputRef.current.cameraYaw -= dx * 0.0065;
    const minPitch = cameraModeRef.current === '1ST' ? -0.45 : -0.22;
    const maxPitch = cameraModeRef.current === '1ST' ? 0.52 : 0.48;
    inputRef.current.cameraPitch = Math.max(
      minPitch,
      Math.min(maxPitch, inputRef.current.cameraPitch + dy * 0.0045)
    );
  };

  const handleCanvasLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inputRef.current.lookPointerId !== e.pointerId) return;
    const wasShortTap = inputRef.current.lookMovedDist < 10;
    inputRef.current.lookPointerId = null;
    if (wasShortTap && phaseRef.current === 'PLAYING') {
      inputRef.current.attackRequested = true;
    }
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
      {/* Isolated WebGL Canvas Mount with Touch-Drag Look & Tap Slash */}
      <div
        ref={canvasMountRef}
        onPointerDown={handleCanvasLookDown}
        onPointerMove={handleCanvasLookMove}
        onPointerUp={handleCanvasLookUp}
        onPointerCancel={handleCanvasLookUp}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* Loading 3D Warrior Models Progress Overlay */}
      {modelLoading.active && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-40 rounded-xl bg-[#07070F]/92 border border-[#00F0FF]/55 px-5 py-3 shadow-2xl min-w-[260px] text-center">
          <div className="font-display text-xs font-bold tracking-wider text-[#00F0FF] uppercase">
            {modelLoading.label}
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-[#120B24] overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#00F0FF] to-[#FF1E42] transition-all duration-200"
              style={{ width: `${modelLoading.percent}%` }}
            />
          </div>
          <div className="mt-1 font-mono-nums text-[11px] font-bold text-slate-300">
            {modelLoading.percent}%
          </div>
        </div>
      )}

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

      {/* First-Person Crosshair Dot */}
      {phase === 'PLAYING' && cameraMode === '1ST' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full border-2 border-[#00F0FF] bg-[#FF1E42]/70" />
        </div>
      )}

      {/* Top Combat HUD (No backdrop-blur over WebGL per Three.js performance guidelines) */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-20 p-2.5 sm:p-4 flex items-start justify-between gap-2.5">
        {/* Left: HP, Cosmic Nova Energy & Active Relics */}
        <div className="w-40 sm:w-60 rounded-xl bg-[#07070F]/88 border border-white/15 p-2.5 sm:p-3">
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

        {/* Center: Persistent Wave & Enemies Remaining HUD + Dedicated Chrono Boss Health Bar */}
        <div className="flex-1 max-w-md flex flex-col items-center gap-2">
          <div className="rounded-xl bg-[#07070F]/88 border border-white/15 px-3 sm:px-4 py-1.5 flex items-center gap-2.5 sm:gap-4 shadow-lg">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Wave
              </span>
              <span className="font-display text-sm sm:text-base font-black text-[#00F0FF]">
                {hudState.wave}
              </span>
            </div>

            <div className="h-4 w-px bg-white/15" />

            <div className="flex items-center gap-1.5 font-mono-nums">
              <Skull className="w-3.5 h-3.5 text-[#FF1E42]" />
              <span className="text-[11px] sm:text-xs font-bold text-white">
                {hudState.enemiesRemaining}
                <span className="text-slate-400">
                  /{Math.max(hudState.waveTotalEnemies, hudState.enemiesRemaining)}
                </span>
              </span>
            </div>

            {hudState.combo > 1 && (
              <>
                <div className="h-4 w-px bg-white/15" />
                <div className="font-mono-nums text-[11px] sm:text-xs font-black text-amber-300">
                  {hudState.combo}x
                </div>
              </>
            )}
          </div>

          {hudState.bossMaxHp > 0 && (
            <div className="w-full rounded-xl bg-[#07070F]/92 border border-[#FF1E42]/70 px-3.5 py-2 shadow-[0_0_24px_rgba(255,30,66,0.28)]">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-display font-bold text-[#FF1E42]">
                <span className="tracking-wider">{hudState.bossName}</span>
                <span className="font-mono-nums text-white">
                  {hudState.bossHp}/{hudState.bossMaxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-[#120B24] overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#FF1E42] via-[#dc2626] to-[#f97316] transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hudState.bossHp / hudState.bossMaxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {hudState.bannerText && hudState.waveState === 'ACTIVE' && (
            <div className="rounded-lg bg-[#120B24]/95 border border-[#00F0FF]/55 px-4 py-1 font-display text-xs sm:text-sm font-extrabold tracking-wider text-white">
              {hudState.bannerText}
            </div>
          )}
        </div>

        {/* Right: VIEW 3RD / 1ST Toggle, Score, Mute & Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCameraView}
            aria-label="Toggle 3rd Person or 1st Person Camera"
            className={`min-h-[46px] px-3.5 sm:px-4 py-2 rounded-xl border-2 font-display text-xs sm:text-sm font-black tracking-wide inline-flex items-center gap-1.5 cursor-pointer transition ${
              cameraMode === '1ST'
                ? 'bg-[#FF1E42] border-white/70 text-white shadow-lg shadow-[#FF1E42]/35'
                : 'bg-[#07070F]/92 border-[#00F0FF] text-[#00F0FF] shadow-lg shadow-[#00F0FF]/25'
            }`}
          >
            <Eye className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">VIEW: {cameraMode}</span>
          </button>

          <div className="hidden sm:block rounded-xl bg-[#07070F]/88 border border-white/15 px-3 py-1.5 text-right">
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
            className="min-w-[46px] min-h-[46px] flex items-center justify-center rounded-xl bg-[#07070F]/88 border border-white/15 text-slate-200 hover:border-[#00F0FF] cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {phase === 'PLAYING' && (
            <button
              type="button"
              onClick={() => setSyncedPhase('PAUSED')}
              aria-label="Pause Chrono Slayer 3D"
              className="min-w-[46px] min-h-[46px] flex items-center justify-center rounded-xl bg-[#07070F]/88 border border-white/15 text-slate-200 hover:border-[#FF1E42] cursor-pointer"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Center-Screen Wave Incoming & Wave Cleared Announcements */}
      {phase === 'PLAYING' && hudState.waveState === 'INCOMING' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div
            className={`rounded-2xl px-7 py-5 border-2 text-center shadow-2xl ${
              hudState.wave % 3 === 0
                ? 'bg-[#1a0714]/92 border-[#FF1E42] shadow-[0_0_40px_rgba(255,30,66,0.45)]'
                : 'bg-[#090d1f]/92 border-[#00F0FF] shadow-[0_0_40px_rgba(0,240,255,0.35)]'
            }`}
          >
            <div
              className={`font-display text-xs sm:text-sm font-bold tracking-[0.25em] uppercase ${
                hudState.wave % 3 === 0 ? 'text-[#FF1E42]' : 'text-[#00F0FF]'
              }`}
            >
              {hudState.wave % 3 === 0 ? 'Chrono Overlord Approaching' : 'Arena Breach Detected'}
            </div>
            <div className="mt-1 font-display text-2xl sm:text-4xl font-black tracking-wider text-white">
              WAVE {hudState.wave} — INCOMING!
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#07070F] border border-white/15 px-4 py-1.5 font-mono-nums text-lg sm:text-2xl font-black text-white">
              <span className="text-xs uppercase tracking-widest text-slate-400">Spawning in</span>
              <span className={hudState.wave % 3 === 0 ? 'text-[#FF1E42]' : 'text-[#00F0FF]'}>
                {Math.max(1, Math.ceil(hudState.waveCountdown))}
              </span>
            </div>
          </div>
        </div>
      )}

      {phase === 'PLAYING' && hudState.waveState === 'CLEARED_SLOWMO' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-[#0a1428]/92 border-2 border-[#00F0FF] px-8 py-5 text-center shadow-[0_0_45px_rgba(0,240,255,0.45)]">
            <div className="font-display text-xs sm:text-sm font-bold tracking-[0.28em] uppercase text-emerald-400">
              All Hostiles Eliminated
            </div>
            <div className="mt-1 font-display text-2xl sm:text-4xl font-black tracking-wider text-white">
              WAVE {hudState.wave} CLEARED!
            </div>
            <div className="mt-2 text-xs font-semibold text-[#00F0FF]">
              {hudState.wave === 3 ? 'Chrono Boss Vanquished!' : 'Preparing Roguelike Relic Draft...'}
            </div>
          </div>
        </div>
      )}

      {/* Subtle Copyright Corner Watermark */}
      <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-400/80 whitespace-nowrap">
        © 2026 Shadow Knight Game Zone. All Rights Reserved.
      </div>

      {/* Extra-Large Mobile Touch Controls (172px Joystick, 116-132px SLASH, 88-98px DASH & POWER) */}
      {phase === 'PLAYING' && (
        <>
          {/* Bottom-Left: Extra-Large 172px Virtual Joystick */}
          <div
            onPointerDown={handleJoystickDown}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickUp}
            onPointerCancel={handleJoystickUp}
            aria-label="360 Movement Joystick"
            className="absolute bottom-1.5 left-1.5 z-20 w-52 h-52 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          >
            <div className="relative w-[172px] h-[172px] rounded-full bg-[#120B24]/75 border-2 border-[#00F0FF]/65 shadow-[0_0_24px_rgba(0,240,255,0.28)] flex items-center justify-center pointer-events-none">
              <div className="w-[76px] h-[76px] rounded-full border border-white/25" />
              <div
                style={{
                  transform: `translate3d(${joyVisual.dx}px, ${joyVisual.dy}px, 0)`,
                }}
                className="absolute w-[68px] h-[68px] rounded-full bg-gradient-to-br from-[#00F0FF] via-[#38bdf8] to-[#2563eb] border-2 border-white shadow-[0_0_20px_rgba(0,240,255,0.9)] will-change-transform"
              />
            </div>
          </div>

          {/* PC Controls Hint */}
          <div className="pointer-events-none hidden md:block absolute bottom-7 left-1/2 -translate-x-1/2 z-10 text-[11px] text-slate-300 bg-[#07070F]/85 px-3.5 py-1.5 rounded-lg border border-white/12 whitespace-nowrap">
            Drag to Look · WASD Move · Space/Click Slash · Shift Dash · Q Power · V View (3rd/1st)
          </div>

          {/* Bottom-Right: Extra-Large SLASH (116-132px), DASH (88-98px), POWER (88-98px) */}
          <div className="absolute bottom-3.5 right-3.5 z-20 flex items-end gap-3.5 sm:gap-4 touch-none">
            {/* ULT / POWER Button */}
            <button
              type="button"
              disabled={hudState.novaEnergy < 100}
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerNova();
              }}
              className={`w-[88px] h-[88px] sm:w-[98px] sm:h-[98px] rounded-full border-[3px] flex flex-col items-center justify-center text-xs font-display font-black transition-transform active:scale-90 ${
                hudState.novaEnergy >= 100
                  ? 'bg-gradient-to-br from-[#a855f7] to-[#FF1E42] border-[#00F0FF] text-white shadow-xl shadow-[#FF1E42]/45 scale-105 cursor-pointer'
                  : 'bg-[#120B24]/90 border-white/25 text-slate-300 opacity-90 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-7 h-7" />
              <span className="mt-1 leading-none">
                {hudState.novaEnergy >= 100 ? 'POWER!' : `${hudState.novaEnergy}%`}
              </span>
            </button>

            {/* DASH Button */}
            <button
              type="button"
              disabled={hudState.dashCharges <= 0}
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerDash();
              }}
              className={`relative w-[88px] h-[88px] sm:w-[98px] sm:h-[98px] rounded-full border-[3px] flex flex-col items-center justify-center text-xs font-display font-black transition-transform active:scale-90 ${
                hudState.dashCharges > 0
                  ? 'bg-[#120B24]/95 border-[#00F0FF] text-[#00F0FF] shadow-lg shadow-[#00F0FF]/30 cursor-pointer'
                  : 'bg-[#120B24]/75 border-white/15 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Wind className="w-7 h-7" />
              <span className="mt-1 leading-none">DASH {hudState.dashCharges}</span>
            </button>

            {/* Primary SLASH Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                engineActionsRef.current?.triggerAttack();
              }}
              className="w-[116px] h-[116px] sm:w-[132px] sm:h-[132px] rounded-full bg-gradient-to-br from-[#FF1E42] to-[#be123c] border-[4px] border-white/90 text-white shadow-2xl shadow-[#FF1E42]/55 flex flex-col items-center justify-center font-display text-base font-black active:scale-90 transition-transform cursor-pointer"
            >
              <Sword className="w-10 h-10" />
              <span className="mt-1 leading-none tracking-wider">SLASH</span>
            </button>
          </div>
        </>
      )}

      {/* Title Menu Overlay */}
      {phase === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/75 p-4">
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
                3D Over-the-Shoulder &amp; 1st-Person Action
              </div>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                CHRONO SLAYER <span className="text-[#FF1E42]">3D</span>
              </h2>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Battle with rigged 3D cyber-warriors in 3rd-Person or 1st-Person POV. Chain
                3-hit katana combos, draft Roguelike relics, and vanquish the Chrono Boss every 3rd
                wave.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => engineActionsRef.current?.startNewRun()}
                  className="min-h-[52px] inline-flex items-center gap-2.5 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] py-4 px-7 font-display text-base font-extrabold text-white shadow-xl shadow-[#FF1E42]/35 transition cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>PLAY NOW</span>
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
                  className={`group rounded-xl p-5 border-2 transition flex flex-col justify-between gap-3 cursor-pointer ${
                    card.accent === 'crimson'
                      ? 'bg-[#1a0b1e] border-[#FF1E42]/55 hover:border-[#FF1E42] hover:bg-[#270e29]'
                      : 'bg-[#0b1328] border-[#00F0FF]/55 hover:border-[#00F0FF] hover:bg-[#0f1d3a]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {card.accent === 'crimson' ? (
                        <Flame className="w-5 h-5 text-[#FF1E42] shrink-0" />
                      ) : (
                        <Zap className="w-5 h-5 text-[#00F0FF] shrink-0" />
                      )}
                      <span className="font-display text-sm sm:text-base font-bold text-white">
                        {card.title}
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-extrabold ${
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
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setSyncedPhase('PLAYING')}
                className="min-h-[50px] rounded-xl bg-[#00F0FF] text-[#07070F] py-3.5 px-6 font-display text-base font-extrabold cursor-pointer"
              >
                Resume Battle
              </button>
              <button
                type="button"
                onClick={() => engineActionsRef.current?.startNewRun()}
                className="min-h-[48px] rounded-xl bg-white/10 border border-white/15 py-3 px-6 text-white text-sm font-bold cursor-pointer"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[46px] rounded-xl text-sm font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {(phase === 'GAME_OVER' || phase === 'VICTORY') && sessionRewards && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07070F]/90 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-[#120B24] border border-white/15 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#00F0FF]">
                  {sessionRewards.victory
                    ? 'Wave 3 Chrono Boss Defeated!'
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

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => engineActionsRef.current?.startNewRun()}
                className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF1E42] hover:bg-[#ff3355] text-white px-5 py-3.5 font-display text-sm font-extrabold cursor-pointer transition"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                Play Again
              </button>

              <a
                href={buildWhatsAppChallengeUrl(gameTitle, sessionRewards.score)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white px-5 py-3.5 text-sm font-extrabold transition"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                Challenge Friend
              </a>

              <button
                type="button"
                onClick={onExit}
                className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#07070F] hover:bg-white/10 border border-white/25 text-white px-5 py-3.5 text-sm font-extrabold cursor-pointer transition"
              >
                <Home className="w-4 h-4 shrink-0 text-[#00F0FF]" />
                Back to Home
              </button>
            </div>

            {sessionRewards.victory && (
              <button
                type="button"
                onClick={handleContinueEndless}
                className="mt-3 w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-[#07070F] px-6 py-3.5 font-display text-sm font-extrabold cursor-pointer transition"
              >
                <Zap className="w-4 h-4" />
                Continue Endless (Wave 4+)
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
