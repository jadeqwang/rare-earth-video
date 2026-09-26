// Edit decision list. Times are song seconds (see docs/CONCEPT.md for the arc).
// Plate ids refer to renderer/assets/plates/<id> (made by pipeline/process_plate.py).
// Cue kinds are defined in scenes/common.js (stack | single | block | voice | sub | term | termWords | label | text).
//
// buildEDL(tim) returns the shot list; montages are cut on the song's actual beats.

const W = (w, t0) => ({ w, t0 });

// --- reusable plate presets -------------------------------------------------
const STAGE = (song, extra = {}) => ({ plate: 'P01', mat: 'light', palette: 'light2011', neon: '#FFD6F0', song, stamp: true,
  light: { scan: 0.6, split: 1.5, cell: 7, hueKeep: 0.55 }, ...extra });
const STAGE4 = (extra = {}) => ({ plate: 'P02', mat: 'light', palette: 'light2011', neon: '#FFD6F0', song: 80.0, slip: 0.17, stamp: true,
  light: { scan: 0.6, split: 1.5, cell: 7, hueKeep: 0.55 }, ...extra });
const ROOF4 = (extra = {}) => ({ plate: 'P03', mat: 'ink', palette: 'inkRoof', song: 80.0, mouth: { scale: 0.55 }, ...extra });
const ALIENL = { palette: 'lightAlien', neon: '#FFB39A', light: { cell: 7, hueKeep: 0.5 } };

export function buildEDL(tim) {
  const beats = tim.beats;
  const beatsIn = (a, b) => beats.filter((x) => x >= a - 1e-3 && x < b - 1e-3);
  const E = [];
  const add = (id, t0, t1, scene, p = {}) => E.push({ id, t0, t1, scene, p });

  // ================= INTRO =================
  add('S01', 0.0, 3.82, 'paleDot');
  add('S02', 3.82, 4.122, 'ledDot', { cues: [{ k: 'single', words: [W('Do', 3.82)], x: 0.5, y: 0.66, px: 420, maxW: 0.5 }] });

  // ================= V1 =================
  add('S03', 4.122, 5.80, 'plate', STAGE(3.4, {
    cam: { z0: 1.0, z1: 1.08, x0: 0.5, x1: 0.53, y0: 0.5, y1: 0.52 },
    cues: [{ k: 'single', line: ['V1', 0], from: 1, to: 4, pos: [[0.27, 0.58], [0.27, 0.62], [0.27, 0.66]], maxW: 0.48, px: 400, flash: '#FF2D95' }] }));
  add('S04', 5.80, 7.74, 'plate', { plate: 'A01', mat: 'ink', palette: 'inkRoom', pt0: 0.2,
    cam: { z0: 1.0, z1: 1.06, x0: 0.52, x1: 0.55 },
    cues: [{ k: 'stack', line: ['V1', 1], from: 0, to: 4, x: 0.07, y: 0.12, maxW: 0.36, px: 190, fill: '#FFF1D6' }] });
  add('S05', 7.74, 9.82, 'plate', { plate: 'A02', mat: 'ink', palette: 'inkRoomCool', pt0: 0.6, sparkle: 1,
    cam: { z0: 1.0, z1: 1.07, x0: 0.5, x1: 0.47, y0: 0.5, y1: 0.54 },
    cues: [{ k: 'voice', line: ['V1', 1], from: 4, to: 8, x: 0.07, y: 0.42, px: 150, maxW: 0.62 }] });
  add('S06', 9.82, 11.66, 'plate', STAGE(3.4, { light: { scan: 0.6, split: 1.5, cell: 6, hueKeep: 0.55 },
    cam: { z0: 1.55, z1: 1.7, x0: 0.56, y0: 0.66, y1: 0.67 },
    cues: [{ k: 'stack', line: ['V1', 2], x: 0.06, y: 0.1, maxW: 0.34, px: 230, flash: '#3DFFB2' }] }));
  add('S07', 11.66, 13.69, 'plate', { plate: 'A03', mat: 'ink', palette: 'inkRoomCool', pt0: 0.3,
    cam: { z0: 1.0, z1: 1.1, x0: 0.55, x1: 0.58, y0: 0.52, y1: 0.54 },
    cues: [{ k: 'termWords', line: ['V1', 3], x: 0.063, y: 0.5, px: 46, prompt: '> ', suffix: '?' }] });
  add('S08', 13.69, 15.761, 'globe', { lon: -100, tilt: -22, radius: 270, cx: 0.5, cy: 0.56, spin: 0.08, mw: 0.25,
    cues: [
      { k: 'single', words: [W('Rare', 13.96)], x: 0.5, y: 0.86, px: 300, maxW: 0.6, until: 14.28 },
      { k: 'text', text: 'RARE EARTH', t0: 14.29, x: 0.5, y: 0.87, px: 250, maxW: 0.92, slam: true, stretch: 112 },
      { k: 'text', text: 'RNA  ·  ROBOT NINJA APOCALYPSE  ·  2011', t0: 14.6, x: 0.5, y: 0.94, px: 20, fam: 'mono', wght: 600, fill: '#9CC8FF', tracking: 4 },
    ] });
  add('S09', 15.761, 17.699, 'globe', { lon: -100, tilt: -22, cx: 0.5, cy: 0.5, spin: 0.08, mw: 0.6,
    radius: (c) => 270 * c.S * Math.pow(0.004, Math.min(1, c.lt / 1.5) ** 1.4),
    rings: { period: 0.95, n: 4, spread: 60 },
    cues: [{ k: 'voice', line: ['V1', 4], from: 3, to: 7, x: 0.5, y: 0.8, px: 96, align: 'center', maxW: 0.9 }] });
  add('S10', 17.699, 19.52, 'triptych', {
    panels: [
      { plate: 'A08', mat: 'light', palette: 'light2011', neon: '#C8FFE8', song: 42.6 - 24.9, light: { scan: 0.6, split: 1.2 }, cam: { z0: 1.0, x0: 0.38 + 0.333 } },
      { plate: 'P01', mat: 'light', palette: 'light2011', neon: '#FFD6F0', song: 3.4 + 4.0, light: { scan: 0.6, split: 1.2 }, cam: { z0: 1.25, x0: 0.56, y0: 0.62 } },
      { plate: 'A09', mat: 'light', palette: 'light2011', neon: '#E4D6FF', song: 46.5 - 28.8, light: { scan: 0.6, split: 1.2 }, cam: { z0: 1.0, x0: 0.63 - 0.333 } },
    ],
    names: [{ name: 'CHARLIE', role: 'GUITAR', col: '#3DFFB2' }, { name: 'JADE', role: 'VOX', col: '#FF2D95' }, { name: 'RICKY', role: 'GUITAR', col: '#B08CFF' }],
    cardT: [17.70, 18.18, 18.66], stamp: true });

  // ================= V2 =================
  add('S11', 19.52, 21.56, 'plate', { plate: 'P04', mat: 'ink', palette: 'inkRoof', song: 19.2, mouth: { scale: 0.55 }, sparkle: 1,
    cam: { z0: 1.0, z1: 1.05, x0: 0.5, x1: 0.52 },
    cues: [{ k: 'block', line: ['V2', 0], from: 0, to: 5, x: 0.06, y: 0.2, px: 96, maxW: 0.5, fill: '#FFF0D8' }] });
  add('S12', 21.56, 23.20, 'plate', { plate: 'P04', mat: 'ink', palette: 'inkRoof', pt0: 3.4, sparkle: 1.2, mouth: { scale: 0.55 },
    cam: { z0: 1.3, z1: 1.45, x0: 0.47, x1: 0.46, y0: 0.6, y1: 0.62 }, pinch: { x: 0.425, y: 0.655, t0: 22.35, scale: 1.3 },
    cues: [{ k: 'block', line: ['V2', 0], from: 5, to: 8, x: 0.05, y: 0.2, px: 150, maxW: 0.9, fill: '#9CC8FF' }] });
  add('S13', 23.20, 25.397, 'plate', { plate: 'E01', mat: 'ink', palette: 'inkDesert', ink: { allSoft: 0.55 }, analyse: { radius: 3 }, pt0: 0.4, sparkle: 1.2,
    cam: { z0: 1.0, z1: 1.05 },
    cues: [
      { k: 'block', line: ['V2', 1], from: 0, to: 5, x: 0.06, y: 0.16, px: 110, maxW: 0.6 },
      { k: 'label', text: 'ALLEN TELESCOPE ARRAY · HAT CREEK, CALIFORNIA', x: 0.06, y: 0.93, t0: 23.3, px: 18 },
    ] });
  add('S14', 25.397, 27.03, 'wow', { circleT: 26.24,
    cues: [{ k: 'block', line: ['V2', 1], from: 3, to: 7, x: 0.5, y: 0.93, px: 70, align: 'center', maxW: 0.9, fill: '#FFFFFF', band: 0.92 }] });
  add('S15', 27.03, 30.97, 'pulsar', {
    cues: [
      { k: 'single', line: ['V2', 2], from: 1, to: 3, x: 0.5, y: 0.17, px: 150, maxW: 0.7 },
      { k: 'voice', line: ['V2', 2], from: 3, to: 6, x: 0.5, y: 0.97, px: 64, align: 'center' },
    ] });
  add('S16', 30.97, 34.981, 'transit', { t0: 30.97,
    cues: [{ k: 'block', line: ['V2', 3], from: 0, to: 7, x: 0.5, y: 0.13, px: 84, align: 'center', maxW: 0.9 }] });
  add('S17', 34.981, 38.23, 'transit', { t0: 30.97, merge: true,
    cues: [{ k: 'voice', line: ['V2', 3], from: 6, to: 10, x: 0.5, y: 0.14, px: 120, align: 'center', maxW: 0.9 }] });
  add('S18', 38.23, 40.71, 'galaxy', { z0: 3.0, z1: 0.7, dots: true,
    cues: [{ k: 'stack', line: ['V2', 4], x: 0.07, y: 0.02, maxW: 0.34, px: 160, lead: 0.88 }] });

  // ================= BREAK: the broadcast leaves =================
  add('S19', 40.71, 42.632, 'plate', { plate: 'E01', mat: 'ink', palette: 'inkDesert', ink: { allSoft: 0.55 }, analyse: { radius: 3 }, pt0: 2.6, sparkle: 1.2, beam: true,
    cues: [{ k: 'term', text: 'transmit --signal "rare earth" --origin earth --year 2011', t0: 40.8, x: 0.05, y: 0.1, px: 26, prompt: '$ ', cps: 70 }] });
  add('S20', 42.632, 46.457, 'flyby');
  add('S21', 46.457, 50.277, 'warp', { ly0: 0.0, ly1: 4.0 });
  add('S22', 50.277, 57.916, 'bubble', { y0: 4.0, y1: 16.3, ease: false });

  // ================= V3 =================
  add('S23', 57.916, 59.55, 'plate', { plate: 'E03', mat: 'ink', palette: 'inkLaunch', pt0: 0.3,
    cam: { z0: 1.0, z1: 1.08, y0: 0.5, y1: 0.56 },
    cues: [{ k: 'stack', line: ['V3', 0], from: 0, to: 4, x: 0.05, y: 0.1, maxW: 0.42, px: 200 }] });
  add('S24', 59.55, 60.99, 'brutal', { countdown: 3.0,
    cues: [{ k: 'single', line: ['V3', 0], from: 3, to: 5, x: 0.5, y: 0.6, px: 300, maxW: 0.92, fill: '#F2EFE8', flash: '#FF2A1F' }] });
  add('S25', 60.99, 63.31, 'brutal', { strobe: true, bands: ['WEAPONS', 'WARS', 'WEAPONS', 'WARS', 'ALERT', 'BREAKING'],
    cues: [{ k: 'single', line: ['V3', 1], from: 0, to: 2, x: 0.5, y: 0.62, px: 420, maxW: 0.94, fill: '#FF2A1F', flash: '#FFFFFF' }] });
  add('S26', 63.31, 64.48, 'plate', { plate: 'A05', mat: 'ink', palette: 'inkPhone', pt0: 0.8,
    cam: { z0: 1.05, z1: 1.12, x0: 0.44 },
    cues: [{ k: 'stack', line: ['V3', 1], from: 2, to: 5, x: 0.56, y: 0.14, maxW: 0.38, px: 170 }] });
  add('S27', 64.48, 65.38, 'hole');
  add('S28', 65.38, 67.42, 'plate', { plate: 'E02', mat: 'ink', palette: 'inkDay', pt0: 0.0, sparkle: 0.6,
    cam: { z0: 1.0, z1: 1.05 },
    cues: [{ k: 'stack', line: ['V3', 2], from: 0, to: 3, x: 0.05, y: 0.05, maxW: 0.45, px: 190, fill: '#FFFFFF' }] });
  add('S29', 67.42, 69.18, 'plate', { plate: 'E02', mat: 'ink', palette: 'inkDay', pt0: 2.0, sparkle: 0.6,
    cam: { z0: 1.05, z1: 1.1 },
    cues: [{ k: 'voice', line: ['V3', 2], from: 3, to: 6, x: 0.5, y: 0.3, px: 170, align: 'center', maxW: 0.9, fill: '#16244A' }] });
  add('S30', 69.18, 73.59, 'crowdfund', {
    cues: [{ k: 'block', line: ['V3', 3], x: 0.5, y: 0.955, px: 66, align: 'center', maxW: 0.96, fill: '#FFFFFF', band: 0.95, bandH: 1.4 }] });
  add('S31', 73.59, 76.34, 'plate', { plate: 'A04', mat: 'ink', palette: 'inkRoom', pt0: 0.5,
    cam: { z0: 1.0, z1: 1.08, x0: 0.55, x1: 0.57 },
    cues: [{ k: 'voice', line: ['V3', 4], x: 0.06, y: 0.45, px: 110, maxW: 0.5 }] });
  add('S32', 76.34, 80.40, 'jwst', { cx: 0.68,
    cues: [
      { k: 'block', line: ['V3', 5], from: 0, to: 4, x: 0.05, y: 0.3, px: 110, maxW: 0.4 },
      { k: 'voice', line: ['V3', 5], from: 4, to: 5, x: 0.05, y: 0.62, px: 220, maxW: 0.45, fill: '#E8C77A' },
    ] });

  // ================= V4: split-screen duet, then one frame =================
  const seamGlow = (c) => 0.5;
  add('S33', 80.40, 86.17, 'split', { left: STAGE4(), right: ROOF4(), seam: seamGlow, stamp: true,
    cues: [
      { k: 'single', line: ['V4', 0], x: 0.5, y: 0.88, px: 300, maxW: 0.9, until: 82.30, flash: '#9CC8FF' },
      { k: 'block', line: ['V4', 1], x: 0.5, y: 0.9, px: 76, align: 'center', maxW: 0.94 },
    ] });
  add('S34', 86.17, 88.07, 'split', { left: STAGE4(), right: ROOF4(), seam: seamGlow, stamp: true,
    cues: [{ k: 'block', line: ['V4', 2], x: 0.5, y: 0.9, px: 96, align: 'center', maxW: 0.9 }] });
  add('S35', 88.07, 89.99, 'split', { left: STAGE4(), right: ROOF4(), seam: seamGlow, glow: 4, stamp: true,
    cues: [
      { k: 'block', line: ['V4', 3], x: 0.5, y: 0.9, px: 96, align: 'center', maxW: 0.9 },
      { k: 'term', text: 'git merge legacy/2011', t0: 88.3, x: 0.5, y: 0.08, px: 26, prompt: '$ ', cps: 40, fill: '#E8F0FF' },
    ] });
  add('S36', 89.99, 94.0, 'split', {
    left: { plate: 'A06', mat: 'light', palette: 'light2011', neon: '#FFD6F0', pt0: 0.0, light: { scan: 0.5, split: 1.2, cell: 6 } },
    right: { plate: 'A06', mat: 'ink', palette: 'inkRoof', pt0: 0.0 },
    seam: seamGlow, glow: 1.0, feather: 0.01,
    cues: [
      { k: 'block', line: ['V4', 4], from: 0, to: 5, x: 0.5, y: 0.12, px: 84, align: 'center', maxW: 0.9 },
      { k: 'voice', line: ['V4', 4], from: 5, to: 7, x: 0.5, y: 0.93, px: 110, align: 'center' },
    ] });
  add('S37', 94.0, 95.893, 'galaxy', { z0: 1.4, z1: 0.9, dots: false,
    cues: [{ k: 'label', text: '15.8 LIGHT-YEARS  ·  SIGNAL ARRIVES 2027', x: 0.5, y: 0.9, t0: 94.2, px: 20, align: 'center' }] });

  // ================= BRIDGE: the other world =================
  add('S38', 95.893, 99.689, 'redDwarf', { r0: 90, r1: 360,
    cues: [
      { k: 'label', text: 'GJ 1002  ·  RED DWARF  ·  15.8 LY', x: 0.06, y: 0.1, t0: 96.2, px: 22, fill: '#FF8A6B' },
      { k: 'label', text: 'TWO EARTH-MASS PLANETS IN THE HABITABLE ZONE', x: 0.06, y: 0.14, t0: 96.9, px: 16, fill: '#FFB39A' },
    ] });
  add('S39', 99.689, 103.486, 'alienOrbit', { r: 330, z0: 0.9, z1: 1.15,
    cues: [{ k: 'label', text: 'GJ 1002 c  ·  21-DAY YEAR  ·  ONE FACE TO ITS STAR', x: 0.06, y: 0.1, t0: 99.9, px: 20, fill: '#7FF0E0' }] });
  add('S40', 103.486, 107.27, 'plate', { plate: 'E04', mat: 'light', pt0: 0.0, ...ALIENL });
  add('S41', 107.27, 111.061, 'alienOrbit', { r: 520, z0: 1.0, z1: 1.3, cx: 0.42, lon0: 1.1,
    cues: [{ k: 'term', text: 'SIGNAL RECEIVED  ·  ORIGIN: 3RD PLANET, G-TYPE STAR  ·  AGE 15.8 YEARS', t0: 107.5, x: 0.05, y: 0.9, px: 22, cps: 50, fill: '#7FF0E0' }] });
  add('S42', 111.061, 116.733, 'alienOrbit', { r: 330, z0: 1.15, z1: 1.2, listen: true, fadeLights: true,
    cues: [{ k: 'label', text: 'LISTENING', x: 0.5, y: 0.92, t0: 111.3, px: 20, align: 'center', fill: '#7FF0E0' }] });
  add('S43', 116.733, 122.427, 'reply', { cx: 0.62 });
  add('S44', 122.427, 126.13, 'replyBeam', { fx: {} });

  // ================= V5 =================
  add('S45', 126.13, 129.51, 'plate', { plate: 'P05', mat: 'ink', palette: 'inkDawn', song: 125.8, slip: 0.0, sparkle: 0.8,
    cam: { z0: 1.0, z1: 1.06, x0: 0.5, x1: 0.53 },
    cues: [{ k: 'sub', line: ['V5', 0] }] });
  add('S46', 129.51, 133.50, 'plate', { plate: 'P05', mat: 'ink', palette: 'inkDawn', song: 125.8, slip: 0.0, sparkle: 0.8,
    cam: { z0: 1.06, z1: 1.12, x0: 0.53, x1: 0.5 },
    ghost: { plate: 'P02', mat: 'light', palette: 'light2011', neon: '#FFB8E0', pt0: 11.5, speed: 0.4, k: 0.4, light: { scan: 0.7, cell: 6, bgDim: 0.0, dotMax: 0.36, lineW: 0.5, exposure: 0.7 } },
    cues: [{ k: 'sub', line: ['V5', 1] }] });

  // M1 (133.50-137.40): every two beats
  const m1 = [
    ['pulsar', {}], ['redDwarf', { r0: 300, r1: 330 }], ['plate', { plate: 'P05', mat: 'ink', palette: 'inkDawn', pt0: 3.0, song: undefined }],
    ['plate', { plate: 'E01', mat: 'ink', palette: 'inkDesert', ink: { allSoft: 0.55 }, analyse: { radius: 3 }, pt0: 1.0 }],
  ];
  const b1 = beatsIn(133.50, 137.40).filter((_, i) => i % 2 === 0);
  const m1cues = [{ k: 'block', line: ['V5', 2], x: 0.5, y: 0.935, px: 64, align: 'center', maxW: 0.98, band: 0.7 }];
  let prev = 133.50;
  b1.concat([137.40]).forEach((bt, i) => {
    if (bt - prev < 0.2) return;
    const [sc, p] = m1[i % m1.length];
    add(`M1_${i}`, prev, bt, sc, { ...p, cues: m1cues });
    prev = bt;
  });
  // M2 (137.40-143.22): every beat
  const m2 = [
    ['plate', STAGE(undefined, { pt0: 8.0 })],
    ['plate', { plate: 'E04', mat: 'light', pt0: 2.0, ...ALIENL }],
    ['plate', { plate: 'P05', mat: 'ink', palette: 'inkDawn', pt0: 5.0 }],
    ['transit', { t0: 130.0 }],
    ['alienOrbit', { r: 300 }],
    ['plate', { plate: 'E01', mat: 'ink', palette: 'inkDesert', ink: { allSoft: 0.55 }, analyse: { radius: 3 }, pt0: 2.0 }],
    ['globe', { lon: -100, tilt: -22, radius: 240 }],
    ['plate', STAGE4({ song: undefined, pt0: 9.0 })],
  ];
  const m2cues = [{ k: 'block', line: ['V5', 3], x: 0.5, y: 0.935, px: 54, align: 'center', maxW: 0.98, band: 0.7 }];
  prev = 137.40;
  beatsIn(137.40, 143.221).concat([143.221]).forEach((bt, i) => {
    if (bt - prev < 0.2) return;
    const [sc, p] = m2[i % m2.length];
    add(`M2_${i}`, prev, bt, sc, { ...p, cues: m2cues });
    prev = bt;
  });
  add('S49', 143.221, 147.006, 'black', { stars: 0.25,
    cues: [
      { k: 'block', line: ['V5', 4], from: 0, to: 4, x: 0.5, y: 0.5, px: 44, fam: 'mono', wght: 500, caps: false, align: 'center', maxW: 0.8 },
      { k: 'voice', line: ['V5', 4], from: 4, to: 5, x: 0.5, y: 0.62, px: 150, align: 'center' },
    ] });

  // ================= OUTRO: contact =================
  add('S50', 147.006, 148.927, 'plate', { plate: 'P06', mat: 'light', palette: 'light2011', neon: '#FFFFFF', song: 146.8, stamp: true,
    light: { scan: 0.4, split: 2.5, cell: 7, hueKeep: 0.6 }, impact: 147.006,
    cues: [
      { k: 'text', text: '0 CONFLICTS', t0: 147.006, x: 0.5, y: 0.6, px: 330, maxW: 0.94, slam: true },
      { k: 'term', text: "Merge made by the 'ort' strategy.", t0: 147.1, x: 0.05, y: 0.08, px: 24, cps: 60 },
    ] });
  const m3 = [
    ['plate', { photo: 'rna_band.jpg', mat: 'light', palette: 'light2011', neon: '#FFD6F0', light: { scan: 0.6, cell: 6, hueKeep: 0.6 }, stamp: true, cam: { z0: 1.05, z1: 1.15 } }],
    ['plate', { plate: 'E04', mat: 'light', pt0: 3.0, ...ALIENL }],
    ['plate', { plate: 'P06', mat: 'light', palette: 'light2011', song: 146.8, light: { scan: 0.4, cell: 7 } }],
    ['plate', { plate: 'E01', mat: 'ink', palette: 'inkDesert', ink: { allSoft: 0.55 }, analyse: { radius: 3 }, pt0: 3.0 }],
    ['plate', { photo: 'rna_band3.jpg', mat: 'light', palette: 'light2011', neon: '#C8FFE8', light: { scan: 0.6, cell: 6, hueKeep: 0.6 }, stamp: true, cam: { z0: 1.1, z1: 1.2 } }],
    ['alienOrbit', { r: 360, city: 1.6 }],
    ['plate', { plate: 'A08', mat: 'light', palette: 'light2011', song: 146.8 - 100, light: { scan: 0.4 } }],
    ['plate', { plate: 'A02', mat: 'ink', palette: 'inkRoomCool', pt0: 3.8, cam: { z0: 1.7, x0: 0.63, y0: 0.42 } }],
    ['plate', { photo: 'rna_jade_solo.jpg', mat: 'light', palette: 'light2011', neon: '#FFD6F0', light: { scan: 0.6, cell: 6, hueKeep: 0.6 }, stamp: true, cam: { z0: 1.0, z1: 1.1 } }],
    ['plate', { plate: 'A09', mat: 'light', palette: 'light2011', song: 146.8 - 100, light: { scan: 0.4 } }],
    ['globe', { lon: -100, tilt: -22, radius: 300, rings: { period: 0.5, n: 5, spread: 3 } }],
    ['plate', { plate: 'P04', mat: 'ink', palette: 'inkRoof', pt0: 4.2, cam: { z0: 1.9, x0: 0.76, y0: 0.64 } }],
    ['plate', { plate: 'E02', mat: 'ink', palette: 'inkDay', pt0: 3.0 }],
    ['plate', { plate: 'P03', mat: 'ink', palette: 'inkRoof', pt0: 12.0 }],
    ['plate', { photo: 'rna_band2.jpg', mat: 'light', palette: 'light2011', neon: '#FFD6F0', light: { scan: 0.6, cell: 6, hueKeep: 0.6 }, stamp: true, cam: { z0: 1.05, z1: 1.15 } }],
    ['plate', { plate: 'A06', mat: 'ink', palette: 'inkRoof', pt0: 4.0 }],
  ];
  // one word per beat, building phrases on each downbeat group
  const burstWords = ['RARE', 'EARTH', 'RARE EARTH', '2011', '→', '2026', '2011 → 2026', '15.8', 'LIGHT', 'YEARS', '15.8 LY',
    'SIGNAL', 'RECEIVED', 'SIGNAL RECEIVED', 'HELLO', 'HELLO'];
  const burstStyle = [
    { y: 0.6, fill: '#FFFFFF' }, { y: 0.6, fill: '#FFFFFF' }, { y: 0.58, fill: '#FFFFFF', stretch: 112 },
    { y: 0.6, fill: '#FF2D95' }, { y: 0.6, fill: '#FFFFFF' }, { y: 0.6, fill: '#FFB547' }, { y: 0.58, fill: '#FFFFFF' },
    { y: 0.6, fill: '#9CC8FF' }, { y: 0.6, fill: '#FFFFFF' }, { y: 0.6, fill: '#FFFFFF' }, { y: 0.58, fill: '#9CC8FF', stretch: 112 },
    { y: 0.6, fill: '#2FE6D3' }, { y: 0.6, fill: '#FFFFFF' }, { y: 0.58, fill: '#2FE6D3' }, { y: 0.6, fill: '#FFFFFF', fam: 'voice' }, { y: 0.6, fill: '#FFFFFF', fam: 'voice' },
  ];
  prev = 148.927;
  beatsIn(148.927, 156.491).concat([156.491]).forEach((bt, i) => {
    if (bt - prev < 0.2) return;
    const [sc, p] = m3[i % m3.length];
    const st = burstStyle[i % burstStyle.length];
    const wtxt = burstWords[i % burstWords.length];
    const cue = { k: 'text', text: wtxt, t0: prev, x: 0.5, y: st.y, px: wtxt.length > 6 ? 260 : 380, maxW: 0.9, slam: true, fill: st.fill, stretch: st.stretch || 100,
      fam: st.fam || 'hero', stroke: 'rgba(5,6,14,0.55)', lw: 6, shade: 0.55 };
    if (st.fam === 'voice') { cue.px = 300; cue.text = 'hello.'; cue.stroke = null; }
    add(`M3_${i}`, prev, bt, sc, { ...p, cues: [cue] });
    prev = bt;
  });
  add('S52', 156.491, 162.151, 'plate', { plate: 'A07', mat: 'ink', palette: 'inkRoof', pt0: 0.0, sparkle: 1.4,
    cues: [
      { k: 'text', text: 'ARE YOU STILL THERE?', t0: 158.383, x: 0.5, y: 0.2, px: 90, maxW: 0.8, fam: 'mono', wght: 600, fill: '#EAF2FF' },
      { k: 'text', text: 'yes.', t0: 160.27, x: 0.5, y: 0.33, px: 150, fam: 'voice', fill: '#FFFFFF' },
    ] });
  add('S53', 162.151, 170.6, 'tail');
  add('S54', 170.6, 172.4, 'endCard');
  return E;
}
