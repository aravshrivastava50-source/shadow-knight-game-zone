import * as THREE from 'three';

export interface KnightRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  weaponPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  capeMesh: THREE.Mesh;
  scarfMesh: THREE.Mesh;
  flameAura: THREE.PointLight;
  cyanEdgeMat: THREE.MeshStandardMaterial;
  bladeTipMat: THREE.MeshStandardMaterial;
}

export type EnemyArchetype = 'stalker' | 'juggernaut' | 'mage' | 'boss';

export interface EnemyRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  weaponPivot: THREE.Group;
  offhandPivot?: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  ringMesh?: THREE.Mesh;
  shoulderCrystals?: THREE.Group;
  coreMesh: THREE.Mesh;
}

/**
 * Generates a high-resolution procedural Dark Obsidian & Stone Tile Arena floor texture
 * with beveled obsidian stone tiles, micro-fractures, arcane rune circles, and Roman clock dial.
 */
export function createChronoArenaTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Deep obsidian base gradient
  const baseGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.52);
  baseGrad.addColorStop(0, '#18112e');
  baseGrad.addColorStop(0.45, '#0e0a1d');
  baseGrad.addColorStop(0.84, '#080712');
  baseGrad.addColorStop(1, '#040409');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Roughness base (dark = glossy obsidian, lighter = matte grout/cracks)
  rCtx.fillStyle = '#383838';
  rCtx.fillRect(0, 0, size, size);

  // Radial & concentric obsidian stone tile seams
  ctx.save();
  ctx.strokeStyle = 'rgba(130, 145, 195, 0.14)';
  ctx.lineWidth = 2;
  rCtx.strokeStyle = '#c8c8c8';
  rCtx.lineWidth = 3;

  const tileRings = [105, 175, 245, 315, 385, 455];
  for (const r of tileRings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    rCtx.beginPath();
    rCtx.arc(cx, cy, r, 0, Math.PI * 2);
    rCtx.stroke();
  }

  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const inner = i % 2 === 0 ? 105 : 175;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * 485, cy + Math.sin(ang) * 485);
    ctx.stroke();

    rCtx.beginPath();
    rCtx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    rCtx.lineTo(cx + Math.cos(ang) * 485, cy + Math.sin(ang) * 485);
    rCtx.stroke();
  }
  ctx.restore();

  // Subtle fractured stone cracks across obsidian slabs
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1.25;
  for (let c = 0; c < 18; c++) {
    const baseAng = (c / 18) * Math.PI * 2 + 0.15;
    let px = cx + Math.cos(baseAng) * (150 + (c % 3) * 75);
    let py = cy + Math.sin(baseAng) * (150 + (c % 3) * 75);
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let seg = 0; seg < 4; seg++) {
      const jitterAng = baseAng + ((seg % 2 === 0 ? 1 : -1) * 0.45);
      px += Math.cos(jitterAng) * 28;
      py += Math.sin(jitterAng) * 28;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Glowing Arcane Rune Circles
  const arcaneRings = [
    { r: 472, color: '#FF1E42', width: 4.5, alpha: 0.85, dash: [] as number[] },
    { r: 446, color: '#A855F7', width: 2.2, alpha: 0.65, dash: [18, 10] },
    { r: 356, color: '#00F0FF', width: 3.5, alpha: 0.85, dash: [] as number[] },
    { r: 336, color: '#00F0FF', width: 1.5, alpha: 0.45, dash: [8, 12] },
    { r: 245, color: '#FF1E42', width: 2.5, alpha: 0.7, dash: [24, 8] },
    { r: 128, color: '#00F0FF', width: 3.2, alpha: 0.85, dash: [] as number[] },
  ];

  for (const ring of arcaneRings) {
    ctx.save();
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = ring.alpha;
    ctx.lineWidth = ring.width;
    ctx.setLineDash(ring.dash);
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Roman Numeral Arcane Clock Dial around outer rune track
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.save();
  ctx.font = '700 26px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(angle) * 400;
    const ry = cy + Math.sin(angle) * 400;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(angle + Math.PI / 2);
    const isCrimson = i % 2 === 0;
    ctx.fillStyle = isCrimson ? '#FF1E42' : '#00F0FF';
    ctx.shadowColor = isCrimson ? '#FF1E42' : '#00F0FF';
    ctx.shadowBlur = 14;
    ctx.fillText(numerals[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Central arcane Chrono Compass Rose
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#00F0FF';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.72;
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 10;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-58, -58, 116, 116);
  }
  ctx.restore();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAnisotropy || 1);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = Math.min(4, maxAnisotropy || 1);

  return { map, roughnessMap };
}

/**
 * Builds a sleek, anatomically proportioned 3D Shadow Knight warrior
 * using CapsuleGeometry, SphereGeometry, CylinderGeometry, and LatheGeometry (zero blocky boxes!).
 * Grounded with bottom-center pivot at y = 0.
 */
export function createHeroKnightRig(): KnightRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Matte dark stealth undersuit
  const stealthSuitMat = new THREE.MeshStandardMaterial({
    color: 0x11121c,
    metalness: 0.28,
    roughness: 0.74,
  });

  // Brushed dark gunmetal armor plates
  const armorPlateMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f4a,
    metalness: 0.88,
    roughness: 0.24,
  });

  // Polished titanium trim
  const trimSteelMat = new THREE.MeshStandardMaterial({
    color: 0x8d99bd,
    metalness: 0.94,
    roughness: 0.16,
  });

  const visorGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.4,
    roughness: 0.15,
    metalness: 0.3,
  });

  const cyanEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.3,
    roughness: 0.15,
    metalness: 0.3,
  });

  const crimsonGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.3,
    roughness: 0.15,
    metalness: 0.3,
  });

  // === Sculpted Articulated Legs (Hip Pivot at y = 0.88) ===
  const thighGeo = new THREE.CapsuleGeometry(0.11, 0.28, 4, 10);
  const kneeGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const greaveProfile = [
    new THREE.Vector2(0.06, 0.0),
    new THREE.Vector2(0.095, 0.06),
    new THREE.Vector2(0.115, 0.26),
    new THREE.Vector2(0.105, 0.42),
    new THREE.Vector2(0.075, 0.44),
  ];
  const greaveGeo = new THREE.LatheGeometry(greaveProfile, 10);
  const bootGeo = new THREE.CapsuleGeometry(0.085, 0.16, 4, 8);

  const buildLeg = (xOffset: number): THREE.Group => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(xOffset, 0.88, 0);

    const thigh = new THREE.Mesh(thighGeo, stealthSuitMat);
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const knee = new THREE.Mesh(kneeGeo, trimSteelMat);
    knee.position.set(0, -0.42, 0.03);
    hipPivot.add(knee);

    const greave = new THREE.Mesh(greaveGeo, armorPlateMat);
    greave.position.set(0, -0.84, 0);
    greave.castShadow = true;
    hipPivot.add(greave);

    const boot = new THREE.Mesh(bootGeo, armorPlateMat);
    boot.position.set(0, -0.82, 0.07);
    boot.rotation.x = Math.PI * 0.46;
    hipPivot.add(boot);

    bodyGroup.add(hipPivot);
    return hipPivot;
  };

  const leftLegPivot = buildLeg(-0.18);
  const rightLegPivot = buildLeg(0.18);

  // === Sculpted Waist + V-Tapered Armored Torso (LatheGeometry) ===
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.22, 12), stealthSuitMat);
  pelvis.position.set(0, 0.94, 0);
  bodyGroup.add(pelvis);

  const beltRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.032, 8, 16), trimSteelMat);
  beltRing.rotation.x = Math.PI / 2;
  beltRing.position.set(0, 1.03, 0);
  bodyGroup.add(beltRing);

  const torsoProfile = [
    new THREE.Vector2(0.19, 0.0),
    new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.32, 0.38),
    new THREE.Vector2(0.35, 0.56),
    new THREE.Vector2(0.26, 0.68),
    new THREE.Vector2(0.14, 0.72),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 14);
  const torso = new THREE.Mesh(torsoGeo, armorPlateMat);
  torso.position.set(0, 1.0, 0);
  torso.scale.set(1.12, 1.0, 0.74);
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Chest Chrono Reactor Core + Bezel
  const coreBezel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 16), trimSteelMat);
  coreBezel.position.set(0, 1.42, 0.25);
  bodyGroup.add(coreBezel);

  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 1), crimsonGlowMat);
  chestCore.position.set(0, 1.42, 0.25);
  bodyGroup.add(chestCore);

  // Neck & Collar
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 10), stealthSuitMat);
  neck.position.set(0, 1.72, 0);
  bodyGroup.add(neck);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 14), armorPlateMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.68, 0);
  bodyGroup.add(collar);

  // === Layered Dome Shoulder Pauldrons ===
  const pauldronShellGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pauldronRimGeo = new THREE.TorusGeometry(0.21, 0.022, 6, 14);

  const addPauldron = (side: -1 | 1) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(side * 0.44, 1.61, 0);
    pGroup.rotation.z = -side * 0.42;

    const shell = new THREE.Mesh(pauldronShellGeo, armorPlateMat);
    shell.castShadow = true;
    pGroup.add(shell);

    const rim = new THREE.Mesh(pauldronRimGeo, trimSteelMat);
    rim.rotation.x = Math.PI / 2;
    pGroup.add(rim);

    const accentStrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8),
      side === -1 ? cyanEdgeMat : crimsonGlowMat
    );
    accentStrip.position.set(0, 0.16, 0);
    accentStrip.rotation.z = Math.PI / 2;
    pGroup.add(accentStrip);

    bodyGroup.add(pGroup);
  };
  addPauldron(-1);
  addPauldron(1);

  // === Articulated Left Arm Pivot (Shoulder at y = 1.56) ===
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.46, 1.56, 0);
  bodyGroup.add(leftArmPivot);

  const upperArmGeo = new THREE.CapsuleGeometry(0.082, 0.22, 4, 8);
  const vambraceGeo = new THREE.CylinderGeometry(0.092, 0.072, 0.28, 10);
  const gauntletHandGeo = new THREE.SphereGeometry(0.082, 8, 8);

  const leftUpperArm = new THREE.Mesh(upperArmGeo, stealthSuitMat);
  leftUpperArm.position.set(0, -0.16, 0);
  leftArmPivot.add(leftUpperArm);

  const leftForearm = new THREE.Mesh(vambraceGeo, armorPlateMat);
  leftForearm.position.set(0, -0.4, 0.06);
  leftForearm.rotation.x = -0.35;
  leftForearm.castShadow = true;
  leftArmPivot.add(leftForearm);

  const leftHand = new THREE.Mesh(gauntletHandGeo, trimSteelMat);
  leftHand.position.set(0, -0.54, 0.12);
  leftArmPivot.add(leftHand);

  // === Sculpted Armored Knight Helmet & Swept Visor ===
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.94, 0);
  bodyGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), armorPlateMat);
  cranium.scale.set(0.92, 1.06, 1.08);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const jawGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.12, 0.2, 8), trimSteelMat);
  jawGuard.position.set(0, -0.11, 0.03);
  jawGuard.scale.set(0.92, 1, 1.08);
  headGroup.add(jawGuard);

  // Curved glowing cyan V-visor slit
  const visorArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.024, 6, 14, Math.PI * 0.58),
    visorGlowMat
  );
  visorArc.rotation.x = Math.PI / 2;
  visorArc.rotation.z = Math.PI * 0.21;
  visorArc.position.set(0, 0.01, 0.04);
  headGroup.add(visorArc);

  // Slept-back helmet crest & horns
  const crestFin = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.36, 6), trimSteelMat);
  crestFin.position.set(0, 0.19, -0.04);
  crestFin.rotation.x = -0.78;
  headGroup.add(crestFin);

  const hornGeo = new THREE.ConeGeometry(0.045, 0.3, 6);
  const leftHorn = new THREE.Mesh(hornGeo, armorPlateMat);
  leftHorn.position.set(-0.15, 0.2, -0.03);
  leftHorn.rotation.z = 0.42;
  leftHorn.rotation.x = -0.35;
  headGroup.add(leftHorn);

  const rightHorn = new THREE.Mesh(hornGeo, armorPlateMat);
  rightHorn.position.set(0.15, 0.2, -0.03);
  rightHorn.rotation.z = -0.42;
  rightHorn.rotation.x = -0.35;
  headGroup.add(rightHorn);

  // === Flowing Shadow Cape + Crimson/Cyan Scarf Ribbon ===
  const capeGeo = new THREE.PlaneGeometry(0.76, 1.38, 4, 6);
  const capeMesh = new THREE.Mesh(
    capeGeo,
    new THREE.MeshStandardMaterial({
      color: 0x1a0b28,
      emissive: 0x2e084d,
      emissiveIntensity: 0.45,
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
  );
  capeMesh.position.set(0, 1.04, -0.26);
  capeMesh.rotation.x = 0.24;
  bodyGroup.add(capeMesh);

  const scarfGeo = new THREE.PlaneGeometry(0.22, 1.18, 2, 6);
  const scarfMesh = new THREE.Mesh(
    scarfGeo,
    new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0x99112b,
      emissiveIntensity: 0.75,
      roughness: 0.5,
      side: THREE.DoubleSide,
    })
  );
  scarfMesh.position.set(-0.22, 1.28, -0.22);
  scarfMesh.rotation.x = 0.35;
  scarfMesh.rotation.z = 0.16;
  bodyGroup.add(scarfMesh);

  // === Weapon Pivot (Right Arm + Sleek Dual-Energy Chrono Katana / Greatsword) ===
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.46, 1.56, 0.04);
  bodyGroup.add(weaponPivot);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, stealthSuitMat);
  rightUpperArm.position.set(0, -0.15, 0.04);
  rightUpperArm.rotation.x = -0.25;
  weaponPivot.add(rightUpperArm);

  const rightForearm = new THREE.Mesh(vambraceGeo, armorPlateMat);
  rightForearm.position.set(0, -0.34, 0.2);
  rightForearm.rotation.x = -0.85;
  weaponPivot.add(rightForearm);

  const rightHand = new THREE.Mesh(gauntletHandGeo, trimSteelMat);
  rightHand.position.set(0, -0.44, 0.34);
  weaponPivot.add(rightHand);

  // Energy Katana / Greatsword assembly
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0, -0.42, 0.4);
  swordGroup.rotation.x = Math.PI * 0.42;
  weaponPivot.add(swordGroup);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.48, 10), stealthSuitMat);
  swordGroup.add(hilt);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), crimsonGlowMat);
  pommel.position.set(0, -0.26, 0);
  swordGroup.add(pommel);

  const guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 14), trimSteelMat);
  guardRing.rotation.x = Math.PI / 2;
  guardRing.position.set(0, 0.24, 0);
  swordGroup.add(guardRing);

  const guardCore = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), armorPlateMat);
  guardCore.position.set(0, 0.24, 0);
  swordGroup.add(guardCore);

  // Sleek tapered blade spine + dual energy edges (Cylinder/Cone sculpted, zero boxes)
  const bladeSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.72, 6), trimSteelMat);
  bladeSpine.scale.set(0.65, 1, 0.35);
  bladeSpine.position.set(0, 1.12, 0);
  swordGroup.add(bladeSpine);

  const crimsonEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 1.74, 6), crimsonGlowMat);
  crimsonEdge.scale.set(0.85, 1, 0.28);
  crimsonEdge.position.set(0.042, 1.13, 0);
  swordGroup.add(crimsonEdge);

  const cyanEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 1.74, 6), cyanEdgeMat);
  cyanEdge.scale.set(0.85, 1, 0.28);
  cyanEdge.position.set(-0.042, 1.13, 0);
  swordGroup.add(cyanEdge);

  const bladeTipMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.0,
    metalness: 0.45,
    roughness: 0.14,
  });
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.4, 6), bladeTipMat);
  bladeTip.scale.set(1.15, 1, 0.32);
  bladeTip.position.set(0, 2.18, 0);
  swordGroup.add(bladeTip);

  const flameAura = new THREE.PointLight(0x00f0ff, 2.1, 6.5);
  flameAura.position.set(0, 1.45, 0.65);
  bodyGroup.add(flameAura);

  return {
    root,
    bodyGroup,
    weaponPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    capeMesh,
    scarfMesh,
    flameAura,
    cyanEdgeMat,
    bladeTipMat,
  };
}

/**
 * Session-scoped factory that reuses sculpted Lathe/Capsule/Sphere/Cylinder geometries & materials
 * across all spawned enemies:
 * - Cyber Stalker (Fast hunched assassin with dual crimson blades + glowing red visor eyes)
 * - Iron Juggernaut (Tank broad-shouldered armored knight with spiked warhammer + energy shield)
 * - Void Acolyte (Ranged floating mage with hooded cowl & glowing void halo)
 * - Chrono Boss (Every 3rd Wave towering dark overlord with floating shoulder crystals + massive plasma greatsword)
 */
export function createEnemyRigFactory() {
  // === Shared Materials ===
  const stalkerSuitMat = new THREE.MeshStandardMaterial({
    color: 0x100d1b,
    metalness: 0.45,
    roughness: 0.58,
  });
  const stalkerPlateMat = new THREE.MeshStandardMaterial({
    color: 0x261736,
    metalness: 0.85,
    roughness: 0.25,
  });
  const crimsonEnergyMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.5,
    roughness: 0.15,
    metalness: 0.3,
  });

  const juggArmorMat = new THREE.MeshStandardMaterial({
    color: 0x283047,
    metalness: 0.9,
    roughness: 0.24,
  });
  const juggTrimMat = new THREE.MeshStandardMaterial({
    color: 0x7986a8,
    metalness: 0.94,
    roughness: 0.18,
  });
  const shieldEnergyMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.72,
    roughness: 0.1,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const hammerGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff4500,
    emissive: 0xff1e42,
    emissiveIntensity: 2.6,
    roughness: 0.2,
  });

  const mageRobeMat = new THREE.MeshStandardMaterial({
    color: 0x230b3b,
    metalness: 0.38,
    roughness: 0.62,
  });
  const mageOrbMat = new THREE.MeshStandardMaterial({
    color: 0xd946ef,
    emissive: 0xc026d3,
    emissiveIntensity: 2.5,
  });
  const mageRingMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.7,
  });

  const bossArmorMat = new THREE.MeshStandardMaterial({
    color: 0x160a24,
    metalness: 0.92,
    roughness: 0.2,
  });
  const bossTrimMat = new THREE.MeshStandardMaterial({
    color: 0x5f4e7c,
    metalness: 0.95,
    roughness: 0.16,
  });
  const bossCoreMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.9,
    roughness: 0.12,
  });
  const bossCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xd946ef,
    emissiveIntensity: 2.4,
    roughness: 0.12,
    metalness: 0.4,
  });

  // === Shared Geometries (Zero BoxGeometry!) ===
  // Cyber Stalker geometries
  const stalkerLegGeo = new THREE.CapsuleGeometry(0.085, 0.42, 4, 8);
  const stalkerTorsoGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.14, 0.0),
      new THREE.Vector2(0.17, 0.16),
      new THREE.Vector2(0.27, 0.44),
      new THREE.Vector2(0.22, 0.62),
      new THREE.Vector2(0.1, 0.66),
    ],
    12
  );
  const stalkerHeadGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const stalkerCowlGeo = new THREE.ConeGeometry(0.2, 0.42, 8);
  const stalkerEyeGeo = new THREE.SphereGeometry(0.042, 8, 6);
  const stalkerArmGeo = new THREE.CapsuleGeometry(0.065, 0.32, 4, 8);
  const stalkerBladeGeo = new THREE.ConeGeometry(0.055, 1.05, 5);

  // Iron Juggernaut geometries
  const juggLegGeo = new THREE.CapsuleGeometry(0.14, 0.46, 4, 10);
  const juggTorsoGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.28, 0.0),
      new THREE.Vector2(0.32, 0.2),
      new THREE.Vector2(0.46, 0.58),
      new THREE.Vector2(0.42, 0.84),
      new THREE.Vector2(0.22, 0.92),
    ],
    12
  );
  const juggPauldronGeo = new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const juggHelmGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.36, 10);
  const juggHelmDomeGeo = new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const juggVisorGeo = new THREE.TorusGeometry(0.21, 0.025, 6, 12, Math.PI * 0.55);
  const juggArmGeo = new THREE.CapsuleGeometry(0.11, 0.38, 4, 8);
  const juggHaftGeo = new THREE.CylinderGeometry(0.04, 0.045, 1.5, 8);
  const juggHammerHeadGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.62, 10);
  const juggSpikeGeo = new THREE.ConeGeometry(0.06, 0.22, 5);
  const juggShieldGeo = new THREE.CylinderGeometry(0.56, 0.48, 0.07, 6);
  const juggShieldRimGeo = new THREE.TorusGeometry(0.52, 0.035, 6, 6);

  // Void Mage geometries
  const mageRobeGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.48, 0.0),
      new THREE.Vector2(0.36, 0.45),
      new THREE.Vector2(0.24, 0.95),
      new THREE.Vector2(0.28, 1.25),
      new THREE.Vector2(0.14, 1.42),
    ],
    12
  );
  const mageHoodGeo = new THREE.SphereGeometry(0.23, 12, 10);
  const mageOrbGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const mageRingGeo = new THREE.TorusGeometry(0.58, 0.04, 6, 18);
  const mageStaffHaftGeo = new THREE.CylinderGeometry(0.03, 0.035, 1.55, 8);
  const mageStaffTipGeo = new THREE.OctahedronGeometry(0.15, 0);

  // Chrono Boss geometries (Towering Overlord)
  const bossLegGeo = new THREE.CapsuleGeometry(0.26, 0.85, 4, 10);
  const bossTorsoGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.55, 0.0),
      new THREE.Vector2(0.62, 0.45),
      new THREE.Vector2(0.95, 1.25),
      new THREE.Vector2(0.88, 1.7),
      new THREE.Vector2(0.4, 1.85),
    ],
    14
  );
  const bossPauldronGeo = new THREE.SphereGeometry(0.56, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const bossCrystalGeo = new THREE.OctahedronGeometry(0.3, 0);
  const bossCoreGeo = new THREE.OctahedronGeometry(0.34, 1);
  const bossHelmGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.55, 10);
  const bossHornGeo = new THREE.ConeGeometry(0.12, 0.85, 6);
  const bossRingGeo = new THREE.TorusGeometry(1.75, 0.075, 8, 28);
  const bossArmGeo = new THREE.CapsuleGeometry(0.2, 0.72, 4, 8);
  const bossSwordHiltGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.85, 8);
  const bossSwordGuardGeo = new THREE.TorusGeometry(0.32, 0.05, 6, 12);
  const bossSwordBladeGeo = new THREE.ConeGeometry(0.22, 3.2, 6);

  const spawn = (kind: EnemyArchetype, castShadows: boolean): EnemyRig => {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    if (kind === 'stalker') {
      // Agile hunched cyber-assassin
      const leftLegPivot = new THREE.Group();
      leftLegPivot.position.set(-0.16, 0.68, 0);
      const lLeg = new THREE.Mesh(stalkerLegGeo, stalkerSuitMat);
      lLeg.position.y = -0.32;
      lLeg.castShadow = castShadows;
      leftLegPivot.add(lLeg);
      bodyGroup.add(leftLegPivot);

      const rightLegPivot = new THREE.Group();
      rightLegPivot.position.set(0.16, 0.68, 0);
      const rLeg = new THREE.Mesh(stalkerLegGeo, stalkerSuitMat);
      rLeg.position.y = -0.32;
      rLeg.castShadow = castShadows;
      rightLegPivot.add(rLeg);
      bodyGroup.add(rightLegPivot);

      const torso = new THREE.Mesh(stalkerTorsoGeo, stalkerPlateMat);
      torso.position.set(0, 0.66, 0.04);
      torso.rotation.x = 0.28; // Hunched agile predator stance
      torso.scale.set(1.05, 1.0, 0.78);
      torso.castShadow = castShadows;
      bodyGroup.add(torso);

      const head = new THREE.Mesh(stalkerHeadGeo, stalkerSuitMat);
      head.position.set(0, 1.4, 0.22);
      head.scale.set(0.9, 1.0, 1.15);
      bodyGroup.add(head);

      const cowl = new THREE.Mesh(stalkerCowlGeo, stalkerPlateMat);
      cowl.position.set(0, 1.5, 0.06);
      cowl.rotation.x = -0.85;
      bodyGroup.add(cowl);

      // Dual glowing crimson visor eyes
      const coreMesh = new THREE.Mesh(stalkerEyeGeo, crimsonEnergyMat);
      coreMesh.position.set(-0.065, 1.4, 0.39);
      coreMesh.scale.set(1.5, 0.6, 0.8);
      bodyGroup.add(coreMesh);

      const rightEye = new THREE.Mesh(stalkerEyeGeo, crimsonEnergyMat);
      rightEye.position.set(0.065, 1.4, 0.39);
      rightEye.scale.set(1.5, 0.6, 0.8);
      bodyGroup.add(rightEye);

      // Right Crimson Assassin Blade
      const weaponPivot = new THREE.Group();
      weaponPivot.position.set(0.32, 1.18, 0.16);
      bodyGroup.add(weaponPivot);

      const rArm = new THREE.Mesh(stalkerArmGeo, stalkerSuitMat);
      rArm.position.set(0, -0.18, 0.1);
      rArm.rotation.x = -0.55;
      weaponPivot.add(rArm);

      const rBlade = new THREE.Mesh(stalkerBladeGeo, crimsonEnergyMat);
      rBlade.scale.set(1, 1, 0.3);
      rBlade.position.set(0, -0.2, 0.65);
      rBlade.rotation.x = Math.PI * 0.45;
      weaponPivot.add(rBlade);

      // Left Crimson Assassin Blade
      const offhandPivot = new THREE.Group();
      offhandPivot.position.set(-0.32, 1.18, 0.16);
      bodyGroup.add(offhandPivot);

      const lArm = new THREE.Mesh(stalkerArmGeo, stalkerSuitMat);
      lArm.position.set(0, -0.18, 0.1);
      lArm.rotation.x = -0.55;
      offhandPivot.add(lArm);

      const lBlade = new THREE.Mesh(stalkerBladeGeo, crimsonEnergyMat);
      lBlade.scale.set(1, 1, 0.3);
      lBlade.position.set(0, -0.2, 0.65);
      lBlade.rotation.x = Math.PI * 0.45;
      offhandPivot.add(lBlade);

      return {
        root,
        bodyGroup,
        weaponPivot,
        offhandPivot,
        leftLegPivot,
        rightLegPivot,
        coreMesh,
      };
    }

    if (kind === 'juggernaut') {
      // Tall, broad-shouldered Iron Juggernaut Tank with spiked warhammer + energy shield
      const leftLegPivot = new THREE.Group();
      leftLegPivot.position.set(-0.24, 0.86, 0);
      const lLeg = new THREE.Mesh(juggLegGeo, juggArmorMat);
      lLeg.position.y = -0.4;
      lLeg.castShadow = castShadows;
      leftLegPivot.add(lLeg);
      bodyGroup.add(leftLegPivot);

      const rightLegPivot = new THREE.Group();
      rightLegPivot.position.set(0.24, 0.86, 0);
      const rLeg = new THREE.Mesh(juggLegGeo, juggArmorMat);
      rLeg.position.y = -0.4;
      rLeg.castShadow = castShadows;
      rightLegPivot.add(rLeg);
      bodyGroup.add(rightLegPivot);

      const torso = new THREE.Mesh(juggTorsoGeo, juggArmorMat);
      torso.position.y = 0.84;
      torso.scale.set(1.16, 1.0, 0.82);
      torso.castShadow = castShadows;
      bodyGroup.add(torso);

      const lPauldron = new THREE.Mesh(juggPauldronGeo, juggTrimMat);
      lPauldron.position.set(-0.62, 1.66, 0);
      lPauldron.rotation.z = 0.45;
      bodyGroup.add(lPauldron);

      const rPauldron = new THREE.Mesh(juggPauldronGeo, juggTrimMat);
      rPauldron.position.set(0.62, 1.66, 0);
      rPauldron.rotation.z = -0.45;
      bodyGroup.add(rPauldron);

      const helm = new THREE.Mesh(juggHelmGeo, juggArmorMat);
      helm.position.set(0, 1.96, 0);
      bodyGroup.add(helm);

      const helmDome = new THREE.Mesh(juggHelmDomeGeo, juggTrimMat);
      helmDome.position.set(0, 2.13, 0);
      bodyGroup.add(helmDome);

      const coreMesh = new THREE.Mesh(juggVisorGeo, hammerGlowMat);
      coreMesh.rotation.x = Math.PI / 2;
      coreMesh.rotation.z = Math.PI * 0.22;
      coreMesh.position.set(0, 1.98, 0.05);
      bodyGroup.add(coreMesh);

      // Right Arm + Glowing Spiked Warhammer
      const weaponPivot = new THREE.Group();
      weaponPivot.position.set(0.66, 1.56, 0.08);
      bodyGroup.add(weaponPivot);

      const rArm = new THREE.Mesh(juggArmGeo, juggArmorMat);
      rArm.position.set(0, -0.24, 0.12);
      rArm.rotation.x = -0.45;
      weaponPivot.add(rArm);

      const hammerGroup = new THREE.Group();
      hammerGroup.position.set(0, -0.45, 0.36);
      hammerGroup.rotation.x = Math.PI * 0.38;
      weaponPivot.add(hammerGroup);

      const haft = new THREE.Mesh(juggHaftGeo, juggTrimMat);
      haft.position.y = 0.45;
      hammerGroup.add(haft);

      const hammerHead = new THREE.Mesh(juggHammerHeadGeo, juggArmorMat);
      hammerHead.rotation.z = Math.PI / 2;
      hammerHead.position.y = 1.15;
      hammerGroup.add(hammerHead);

      // Glowing radial spikes on warhammer faces
      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        const spike = new THREE.Mesh(juggSpikeGeo, hammerGlowMat);
        spike.position.set(0.36, 1.15 + Math.cos(ang) * 0.14, Math.sin(ang) * 0.14);
        spike.rotation.z = -Math.PI / 2;
        hammerGroup.add(spike);

        const spikeL = new THREE.Mesh(juggSpikeGeo, hammerGlowMat);
        spikeL.position.set(-0.36, 1.15 + Math.cos(ang) * 0.14, Math.sin(ang) * 0.14);
        spikeL.rotation.z = Math.PI / 2;
        hammerGroup.add(spikeL);
      }

      // Left Arm + Hexagonal Energy Shield
      const offhandPivot = new THREE.Group();
      offhandPivot.position.set(-0.66, 1.5, 0.16);
      bodyGroup.add(offhandPivot);

      const lArm = new THREE.Mesh(juggArmGeo, juggArmorMat);
      lArm.position.set(0, -0.22, 0.14);
      lArm.rotation.x = -0.6;
      offhandPivot.add(lArm);

      const shieldDisc = new THREE.Mesh(juggShieldGeo, shieldEnergyMat);
      shieldDisc.rotation.x = Math.PI / 2;
      shieldDisc.position.set(-0.1, -0.2, 0.42);
      offhandPivot.add(shieldDisc);

      const shieldRim = new THREE.Mesh(juggShieldRimGeo, mageRingMat);
      shieldRim.position.set(-0.1, -0.2, 0.44);
      offhandPivot.add(shieldRim);

      return {
        root,
        bodyGroup,
        weaponPivot,
        offhandPivot,
        leftLegPivot,
        rightLegPivot,
        coreMesh,
      };
    }

    if (kind === 'mage') {
      // Sculpted Void Acolyte Mage (Lathe robe + hooded cowl + floating halo)
      const robe = new THREE.Mesh(mageRobeGeo, mageRobeMat);
      robe.position.y = 0.28;
      robe.castShadow = castShadows;
      bodyGroup.add(robe);

      const hood = new THREE.Mesh(mageHoodGeo, mageRobeMat);
      hood.position.set(0, 1.82, -0.02);
      hood.scale.set(0.95, 1.08, 1.12);
      bodyGroup.add(hood);

      const coreMesh = new THREE.Mesh(mageOrbGeo, mageOrbMat);
      coreMesh.position.set(0, 1.8, 0.16);
      bodyGroup.add(coreMesh);

      const ringMesh = new THREE.Mesh(mageRingGeo, mageRingMat);
      ringMesh.position.y = 1.28;
      ringMesh.rotation.x = Math.PI / 2.25;
      bodyGroup.add(ringMesh);

      const weaponPivot = new THREE.Group();
      weaponPivot.position.set(0.46, 1.26, 0.18);
      bodyGroup.add(weaponPivot);

      const staffHaft = new THREE.Mesh(mageStaffHaftGeo, stalkerPlateMat);
      staffHaft.position.set(0, 0.15, 0.2);
      staffHaft.rotation.x = 0.35;
      weaponPivot.add(staffHaft);

      const staffTip = new THREE.Mesh(mageStaffTipGeo, mageOrbMat);
      staffTip.position.set(0, 0.88, 0.45);
      weaponPivot.add(staffTip);

      return { root, bodyGroup, weaponPivot, ringMesh, coreMesh };
    }

    // === CHRONO BOSS (Every 3rd Wave Towering Dark Overlord) ===
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.46, 1.48, 0);
    const bLegL = new THREE.Mesh(bossLegGeo, bossArmorMat);
    bLegL.position.y = -0.68;
    bLegL.castShadow = castShadows;
    leftLegPivot.add(bLegL);
    bodyGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.46, 1.48, 0);
    const bLegR = new THREE.Mesh(bossLegGeo, bossArmorMat);
    bLegR.position.y = -0.68;
    bLegR.castShadow = castShadows;
    rightLegPivot.add(bLegR);
    bodyGroup.add(rightLegPivot);

    const torso = new THREE.Mesh(bossTorsoGeo, bossArmorMat);
    torso.position.y = 1.42;
    torso.scale.set(1.18, 1.0, 0.78);
    torso.castShadow = castShadows;
    bodyGroup.add(torso);

    const coreMesh = new THREE.Mesh(bossCoreGeo, bossCoreMat);
    coreMesh.position.set(0, 2.58, 0.66);
    bodyGroup.add(coreMesh);

    const lPauldron = new THREE.Mesh(bossPauldronGeo, bossTrimMat);
    lPauldron.position.set(-1.12, 3.05, 0);
    lPauldron.rotation.z = 0.48;
    bodyGroup.add(lPauldron);

    const rPauldron = new THREE.Mesh(bossPauldronGeo, bossTrimMat);
    rPauldron.position.set(1.12, 3.05, 0);
    rPauldron.rotation.z = -0.48;
    bodyGroup.add(rPauldron);

    // Floating Shoulder Crystals
    const shoulderCrystals = new THREE.Group();
    shoulderCrystals.position.set(0, 3.72, 0);
    bodyGroup.add(shoulderCrystals);

    const leftCrystal = new THREE.Mesh(bossCrystalGeo, bossCrystalMat);
    leftCrystal.position.set(-1.25, 0, 0);
    shoulderCrystals.add(leftCrystal);

    const rightCrystal = new THREE.Mesh(bossCrystalGeo, bossCrystalMat);
    rightCrystal.position.set(1.25, 0, 0);
    shoulderCrystals.add(rightCrystal);

    // Sculpted Overlord Horned Crown & Visor
    const helm = new THREE.Mesh(bossHelmGeo, bossArmorMat);
    helm.position.set(0, 3.65, 0);
    bodyGroup.add(helm);

    const helmVisor = new THREE.Mesh(juggVisorGeo, bossCoreMat);
    helmVisor.scale.setScalar(1.55);
    helmVisor.rotation.x = Math.PI / 2;
    helmVisor.rotation.z = Math.PI * 0.22;
    helmVisor.position.set(0, 3.66, 0.08);
    bodyGroup.add(helmVisor);

    const lHorn = new THREE.Mesh(bossHornGeo, bossCoreMat);
    lHorn.position.set(-0.34, 4.18, -0.05);
    lHorn.rotation.z = 0.38;
    bodyGroup.add(lHorn);

    const rHorn = new THREE.Mesh(bossHornGeo, bossCoreMat);
    rHorn.position.set(0.34, 4.18, -0.05);
    rHorn.rotation.z = -0.38;
    bodyGroup.add(rHorn);

    // Back Chrono Halo
    const ringMesh = new THREE.Mesh(bossRingGeo, bossCoreMat);
    ringMesh.position.set(0, 2.9, -0.65);
    bodyGroup.add(ringMesh);

    // Left Armored Gauntlet
    const offhandPivot = new THREE.Group();
    offhandPivot.position.set(-1.18, 2.86, 0.1);
    bodyGroup.add(offhandPivot);

    const leftArm = new THREE.Mesh(bossArmGeo, bossArmorMat);
    leftArm.position.set(0, -0.45, 0.22);
    leftArm.rotation.x = -0.5;
    offhandPivot.add(leftArm);

    // Right Arm + Massive Plasma Greatsword
    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(1.18, 2.86, 0.15);
    bodyGroup.add(weaponPivot);

    const rightArm = new THREE.Mesh(bossArmGeo, bossArmorMat);
    rightArm.position.set(0, -0.42, 0.25);
    rightArm.rotation.x = -0.55;
    weaponPivot.add(rightArm);

    const bossSword = new THREE.Group();
    bossSword.position.set(0, -0.78, 0.58);
    bossSword.rotation.x = Math.PI * 0.36;
    weaponPivot.add(bossSword);

    const bHilt = new THREE.Mesh(bossSwordHiltGeo, bossTrimMat);
    bossSword.add(bHilt);

    const bGuard = new THREE.Mesh(bossSwordGuardGeo, bossCrystalMat);
    bGuard.rotation.x = Math.PI / 2;
    bGuard.position.y = 0.42;
    bossSword.add(bGuard);

    const bBlade = new THREE.Mesh(bossSwordBladeGeo, bossCoreMat);
    bBlade.scale.set(1.3, 1, 0.34);
    bBlade.position.y = 2.02;
    bossSword.add(bBlade);

    return {
      root,
      bodyGroup,
      weaponPivot,
      offhandPivot,
      leftLegPivot,
      rightLegPivot,
      ringMesh,
      shoulderCrystals,
      coreMesh,
    };
  };

  const dispose = () => {
    [
      stalkerSuitMat,
      stalkerPlateMat,
      crimsonEnergyMat,
      juggArmorMat,
      juggTrimMat,
      shieldEnergyMat,
      hammerGlowMat,
      mageRobeMat,
      mageOrbMat,
      mageRingMat,
      bossArmorMat,
      bossTrimMat,
      bossCoreMat,
      bossCrystalMat,
    ].forEach((m) => m.dispose());

    [
      stalkerLegGeo,
      stalkerTorsoGeo,
      stalkerHeadGeo,
      stalkerCowlGeo,
      stalkerEyeGeo,
      stalkerArmGeo,
      stalkerBladeGeo,
      juggLegGeo,
      juggTorsoGeo,
      juggPauldronGeo,
      juggHelmGeo,
      juggHelmDomeGeo,
      juggVisorGeo,
      juggArmGeo,
      juggHaftGeo,
      juggHammerHeadGeo,
      juggSpikeGeo,
      juggShieldGeo,
      juggShieldRimGeo,
      mageRobeGeo,
      mageHoodGeo,
      mageOrbGeo,
      mageRingGeo,
      mageStaffHaftGeo,
      mageStaffTipGeo,
      bossLegGeo,
      bossTorsoGeo,
      bossPauldronGeo,
      bossCrystalGeo,
      bossCoreGeo,
      bossHelmGeo,
      bossHornGeo,
      bossRingGeo,
      bossArmGeo,
      bossSwordHiltGeo,
      bossSwordGuardGeo,
      bossSwordBladeGeo,
    ].forEach((g) => g.dispose());
  };

  return { spawn, dispose };
}
