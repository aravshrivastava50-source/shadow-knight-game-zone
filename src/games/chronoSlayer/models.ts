import * as THREE from 'three';

export interface KnightRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  weaponPivot: THREE.Group;
  capeMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  flameAura: THREE.PointLight;
  cyanEdgeMat: THREE.MeshStandardMaterial;
  bladeTipMat: THREE.MeshStandardMaterial;
}

export interface EnemyRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  weaponPivot: THREE.Group;
  ringMesh?: THREE.Mesh;
  coreMesh: THREE.Mesh;
}

/**
 * Generates a high-resolution procedural Chrono Rune Arena floor texture
 * with Roman numeral clock ring, glowing crimson/cyan/purple runic channels, and hex tiles.
 */
export function createChronoArenaTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Obsidian void stone base
  const baseGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.52);
  baseGrad.addColorStop(0, '#1B1038');
  baseGrad.addColorStop(0.45, '#100A22');
  baseGrad.addColorStop(0.82, '#090714');
  baseGrad.addColorStop(1, '#06060D');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle hex grid lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1.5;
  const step = 48;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Concentric glowing Chrono rings
  const rings = [
    { r: 465, color: '#FF1E42', width: 4, alpha: 0.75 },
    { r: 440, color: '#9333EA', width: 2, alpha: 0.55 },
    { r: 350, color: '#00F0FF', width: 3.5, alpha: 0.8 },
    { r: 245, color: '#FF1E42', width: 2.5, alpha: 0.6 },
    { r: 130, color: '#00F0FF', width: 3, alpha: 0.75 },
  ];

  for (const ring of rings) {
    ctx.save();
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.width;
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Radial rune spokes
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.32)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 135, cy + Math.sin(angle) * 135);
    ctx.lineTo(cx + Math.cos(angle) * 435, cy + Math.sin(angle) * 435);
    ctx.stroke();
  }
  ctx.restore();

  // Roman numeral Chrono Dial markers around the outer ring
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.save();
  ctx.font = '700 28px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(angle) * 395;
    const ry = cy + Math.sin(angle) * 395;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(angle + Math.PI / 2);
    const isCrimson = i % 2 === 0;
    ctx.fillStyle = isCrimson ? '#FF1E42' : '#00F0FF';
    ctx.shadowColor = isCrimson ? '#FF1E42' : '#00F0FF';
    ctx.shadowBlur = 12;
    ctx.fillText(numerals[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Central diamond Chrono sigil
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -82);
  ctx.lineTo(82, 0);
  ctx.lineTo(0, 82);
  ctx.lineTo(-82, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy || 1);
  return texture;
}

/**
 * Builds the composite 10-part 3D Shadow Knight hero wielding the dual-energy Crimson & Cyan Chrono Greatsword.
 * Grounded with bottom-center pivot at y = 0.
 */
export function createHeroKnightRig(): KnightRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const darkArmorMat = new THREE.MeshStandardMaterial({
    color: 0x1d1b2e,
    metalness: 0.85,
    roughness: 0.28,
  });

  const trimSteelMat = new THREE.MeshStandardMaterial({
    color: 0x6c7293,
    metalness: 0.92,
    roughness: 0.18,
  });

  const visorGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.3,
  });

  const cyanEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.3,
  });

  const crimsonGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.3,
    roughness: 0.2,
    metalness: 0.3,
  });

  // Legs (bottom pivot at y = 0)
  const legGeo = new THREE.BoxGeometry(0.28, 0.78, 0.3);
  const leftLeg = new THREE.Mesh(legGeo, darkArmorMat);
  leftLeg.position.set(-0.22, 0.39, 0);
  leftLeg.castShadow = true;
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkArmorMat);
  rightLeg.position.set(0.22, 0.39, 0);
  rightLeg.castShadow = true;
  bodyGroup.add(rightLeg);

  // Armored Torso Chestplate
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.92, 0.5), darkArmorMat);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Chest Chrono Core
  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), crimsonGlowMat);
  chestCore.position.set(0, 1.32, 0.25);
  bodyGroup.add(chestCore);

  // Asymmetric Pauldrons (Shoulder Armor)
  const pauldronGeo = new THREE.ConeGeometry(0.32, 0.45, 5);
  const leftPauldron = new THREE.Mesh(pauldronGeo, trimSteelMat);
  leftPauldron.position.set(-0.56, 1.66, 0);
  leftPauldron.rotation.z = 0.65;
  leftPauldron.castShadow = true;
  bodyGroup.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(pauldronGeo, trimSteelMat);
  rightPauldron.position.set(0.56, 1.66, 0);
  rightPauldron.rotation.z = -0.65;
  rightPauldron.castShadow = true;
  bodyGroup.add(rightPauldron);

  // Left Arm
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), darkArmorMat);
  leftArm.position.set(-0.58, 1.24, 0.08);
  leftArm.castShadow = true;
  bodyGroup.add(leftArm);

  // Horned Knight Helmet & Glowing Visor
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.48), trimSteelMat);
  helm.position.set(0, 1.96, 0);
  helm.castShadow = true;
  bodyGroup.add(helm);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.08), visorGlowMat);
  visor.position.set(0, 1.96, 0.23);
  bodyGroup.add(visor);

  const hornGeo = new THREE.ConeGeometry(0.08, 0.34, 4);
  const leftHorn = new THREE.Mesh(hornGeo, darkArmorMat);
  leftHorn.position.set(-0.22, 2.24, -0.02);
  leftHorn.rotation.z = 0.32;
  bodyGroup.add(leftHorn);

  const rightHorn = new THREE.Mesh(hornGeo, darkArmorMat);
  rightHorn.position.set(0.22, 2.24, -0.02);
  rightHorn.rotation.z = -0.32;
  bodyGroup.add(rightHorn);

  // Flowing Energy Cape
  const capeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 1.38, 2, 4),
    new THREE.MeshStandardMaterial({
      color: 0x220c2c,
      emissive: 0x3b0764,
      emissiveIntensity: 0.45,
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
  );
  capeMesh.position.set(0, 1.06, -0.34);
  capeMesh.rotation.x = 0.22;
  bodyGroup.add(capeMesh);

  // Weapon Pivot (Right Hand + Dual-Energy Crimson & Cyan Chrono Greatsword)
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.58, 1.34, 0.14);
  bodyGroup.add(weaponPivot);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.24), darkArmorMat);
  rightArm.position.set(0, -0.18, 0.12);
  rightArm.rotation.x = -0.5;
  weaponPivot.add(rightArm);

  const swordGroup = new THREE.Group();
  swordGroup.position.set(0, -0.25, 0.48);
  swordGroup.rotation.x = Math.PI * 0.38;
  weaponPivot.add(swordGroup);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.48, 8), trimSteelMat);
  swordGroup.add(hilt);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.14), trimSteelMat);
  guard.position.set(0, 0.24, 0);
  swordGroup.add(guard);

  // Twin-edged Crimson + Cyan energy greatsword blade
  const crimsonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.75, 0.06), crimsonGlowMat);
  crimsonEdge.position.set(0.055, 1.14, 0);
  swordGroup.add(crimsonEdge);

  const cyanEdge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.75, 0.06), cyanEdgeMat);
  cyanEdge.position.set(-0.055, 1.14, 0);
  swordGroup.add(cyanEdge);

  const bladeTipMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.8,
    metalness: 0.4,
    roughness: 0.15,
  });
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 4), bladeTipMat);
  bladeTip.position.set(0, 2.18, 0);
  bladeTip.rotation.y = Math.PI / 4;
  swordGroup.add(bladeTip);

  const flameAura = new THREE.PointLight(0x00f0ff, 2.0, 6);
  flameAura.position.set(0, 1.4, 0.6);
  bodyGroup.add(flameAura);

  return {
    root,
    bodyGroup,
    weaponPivot,
    capeMesh,
    leftLeg,
    rightLeg,
    leftArm,
    flameAura,
    cyanEdgeMat,
    bladeTipMat,
  };
}

/**
 * Session-scoped factory that reuses geometries & materials across all spawned enemies
 * so wave spawns create zero duplicate GPU buffers or shader compiles.
 */
export function createEnemyRigFactory() {
  // Shared materials
  const knightArmorMat = new THREE.MeshStandardMaterial({
    color: 0x161224,
    metalness: 0.78,
    roughness: 0.35,
  });
  const knightEyeMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.2,
  });
  const mageRobeMat = new THREE.MeshStandardMaterial({
    color: 0x2a0f45,
    metalness: 0.35,
    roughness: 0.65,
  });
  const mageOrbMat = new THREE.MeshStandardMaterial({
    color: 0xc026d3,
    emissive: 0xc026d3,
    emissiveIntensity: 2.4,
  });
  const mageRingMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.6,
  });
  const titanMetalMat = new THREE.MeshStandardMaterial({
    color: 0x160a24,
    metalness: 0.9,
    roughness: 0.24,
  });
  const bossCoreMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.8,
    roughness: 0.15,
  });

  // Shared geometries
  const knightLegsGeo = new THREE.BoxGeometry(0.56, 0.7, 0.32);
  const knightTorsoGeo = new THREE.BoxGeometry(0.76, 0.82, 0.46);
  const knightHelmGeo = new THREE.ConeGeometry(0.32, 0.56, 5);
  const knightEyeGeo = new THREE.BoxGeometry(0.34, 0.1, 0.08);
  const knightBladeGeo = new THREE.BoxGeometry(0.1, 1.15, 0.08);

  const mageRobeGeo = new THREE.ConeGeometry(0.46, 1.45, 7);
  const mageCrownGeo = new THREE.OctahedronGeometry(0.24, 0);
  const mageOrbGeo = new THREE.SphereGeometry(0.18, 10, 10);
  const mageRingGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 18);
  const mageStaffGeo = new THREE.OctahedronGeometry(0.14, 0);

  const bossLegsGeo = new THREE.BoxGeometry(1.5, 1.4, 0.9);
  const bossTorsoGeo = new THREE.BoxGeometry(2.1, 1.9, 1.2);
  const bossCoreGeo = new THREE.OctahedronGeometry(0.45, 0);
  const bossHeadGeo = new THREE.BoxGeometry(0.9, 0.9, 0.88);
  const bossSpikesGeo = new THREE.ConeGeometry(0.7, 0.9, 4);
  const bossRingGeo = new THREE.TorusGeometry(1.7, 0.08, 8, 24);
  const bossGauntletGeo = new THREE.BoxGeometry(0.68, 1.45, 0.68);

  const spawn = (kind: 'knight' | 'mage' | 'boss', castShadows: boolean): EnemyRig => {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    if (kind === 'knight') {
      const legs = new THREE.Mesh(knightLegsGeo, knightArmorMat);
      legs.position.y = 0.35;
      legs.castShadow = castShadows;
      bodyGroup.add(legs);

      const torso = new THREE.Mesh(knightTorsoGeo, knightArmorMat);
      torso.position.y = 1.12;
      torso.castShadow = castShadows;
      bodyGroup.add(torso);

      const helm = new THREE.Mesh(knightHelmGeo, knightArmorMat);
      helm.position.y = 1.8;
      bodyGroup.add(helm);

      const coreMesh = new THREE.Mesh(knightEyeGeo, knightEyeMat);
      coreMesh.position.set(0, 1.66, 0.22);
      bodyGroup.add(coreMesh);

      const weaponPivot = new THREE.Group();
      weaponPivot.position.set(0.48, 1.15, 0.15);
      bodyGroup.add(weaponPivot);

      const blade = new THREE.Mesh(knightBladeGeo, knightEyeMat);
      blade.position.set(0, 0.45, 0.35);
      blade.rotation.x = 0.7;
      weaponPivot.add(blade);

      return { root, bodyGroup, weaponPivot, coreMesh };
    }

    if (kind === 'mage') {
      const robe = new THREE.Mesh(mageRobeGeo, mageRobeMat);
      robe.position.y = 0.85;
      robe.castShadow = castShadows;
      bodyGroup.add(robe);

      const crown = new THREE.Mesh(mageCrownGeo, mageRobeMat);
      crown.position.y = 1.85;
      bodyGroup.add(crown);

      const coreMesh = new THREE.Mesh(mageOrbGeo, mageOrbMat);
      coreMesh.position.set(0, 1.85, 0.14);
      bodyGroup.add(coreMesh);

      const ringMesh = new THREE.Mesh(mageRingGeo, mageRingMat);
      ringMesh.position.y = 1.25;
      ringMesh.rotation.x = Math.PI / 2.3;
      bodyGroup.add(ringMesh);

      const weaponPivot = new THREE.Group();
      weaponPivot.position.set(0.46, 1.25, 0.2);
      bodyGroup.add(weaponPivot);

      const staffTip = new THREE.Mesh(mageStaffGeo, mageOrbMat);
      staffTip.position.set(0, 0.45, 0.25);
      weaponPivot.add(staffTip);

      return { root, bodyGroup, weaponPivot, ringMesh, coreMesh };
    }

    // Towering Wave 5 Void Titan Boss (composite 8-part colossus)
    const legs = new THREE.Mesh(bossLegsGeo, titanMetalMat);
    legs.position.y = 0.7;
    legs.castShadow = castShadows;
    bodyGroup.add(legs);

    const torso = new THREE.Mesh(bossTorsoGeo, titanMetalMat);
    torso.position.y = 2.35;
    torso.castShadow = castShadows;
    bodyGroup.add(torso);

    const coreMesh = new THREE.Mesh(bossCoreGeo, bossCoreMat);
    coreMesh.position.set(0, 2.4, 0.62);
    bodyGroup.add(coreMesh);

    const head = new THREE.Mesh(bossHeadGeo, titanMetalMat);
    head.position.y = 3.75;
    bodyGroup.add(head);

    const crownSpikes = new THREE.Mesh(bossSpikesGeo, bossCoreMat);
    crownSpikes.position.y = 4.45;
    bodyGroup.add(crownSpikes);

    const ringMesh = new THREE.Mesh(bossRingGeo, bossCoreMat);
    ringMesh.position.set(0, 2.6, -0.45);
    bodyGroup.add(ringMesh);

    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(1.35, 2.5, 0.2);
    bodyGroup.add(weaponPivot);

    const gauntlet = new THREE.Mesh(bossGauntletGeo, titanMetalMat);
    gauntlet.position.set(0, -0.4, 0.45);
    weaponPivot.add(gauntlet);

    const leftGauntlet = new THREE.Mesh(bossGauntletGeo, titanMetalMat);
    leftGauntlet.position.set(-1.35, 2.1, 0.55);
    bodyGroup.add(leftGauntlet);

    return { root, bodyGroup, weaponPivot, ringMesh, coreMesh };
  };

  const dispose = () => {
    [
      knightArmorMat,
      knightEyeMat,
      mageRobeMat,
      mageOrbMat,
      mageRingMat,
      titanMetalMat,
      bossCoreMat,
    ].forEach((m) => m.dispose());

    [
      knightLegsGeo,
      knightTorsoGeo,
      knightHelmGeo,
      knightEyeGeo,
      knightBladeGeo,
      mageRobeGeo,
      mageCrownGeo,
      mageOrbGeo,
      mageRingGeo,
      mageStaffGeo,
      bossLegsGeo,
      bossTorsoGeo,
      bossCoreGeo,
      bossHeadGeo,
      bossSpikesGeo,
      bossRingGeo,
      bossGauntletGeo,
    ].forEach((g) => g.dispose());
  };

  return { spawn, dispose };
}
