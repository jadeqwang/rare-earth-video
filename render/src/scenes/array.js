// The dish array: toon-shaded 3D radio telescopes with ink outlines, choreographed to the song.
import * as THREE from 'three';
import { W, H } from '../core.js';
import { clamp, lerp, smooth, easeOutBack, easeInOutCubic, hash, rng } from '../lib/util.js';

const TOON_VS = /* glsl */`
out vec3 vN; out vec3 vW; out vec3 vV;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TOON_FS = /* glsl */`
precision highp float;
in vec3 vN; in vec3 vW; in vec3 vV; out vec4 o;
uniform vec3 lit, shade, deep, rimCol, keyDir, emissive, fogCol;
uniform float rimAmt, fogNear, fogFar, bands, emissAmt, glowBottom;
void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = dot(n, normalize(keyDir));
  vec3 c = d > 0.25 ? lit : (d > -0.3 ? shade : deep);
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
  c += rimCol * step(0.62, rim) * rimAmt * step(0.0, d + 0.2);
  c += emissive * emissAmt;
  c += glowBottom * vec3(1.0, 0.8, 0.4) * smoothstep(3.0, 0.0, vW.y) * 0.0;
  float dist = length(vW - cameraPosition);
  float f = smoothstep(fogNear, fogFar, dist);
  c = mix(c, fogCol, f);
  o = vec4(c, 1.0);
}`;
// dish bowl: the same toon ramp plus panel seams (concentric rings + radial spokes) so dishes read as structures
const DISH_VS = /* glsl */`
out vec3 vN; out vec3 vW; out vec3 vV; out vec3 vL;
void main(){
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const DISH_FS = TOON_FS.replace('in vec3 vN; in vec3 vW; in vec3 vV; out vec4 o;', 'in vec3 vN; in vec3 vW; in vec3 vV; in vec3 vL; out vec4 o; uniform float panelAmt;')
  .replace('  float dist = length(vW - cameraPosition);', `  float pr = length(vL.xz), pa = atan(vL.z, vL.x);
  float ringD = abs(fract(pr / 1.5 + 0.5) - 0.5) * 1.5;
  float sa = abs(fract(pa / 6.2831853 * 24.0 + 0.5) - 0.5) * (6.2831853 / 24.0) * pr;
  float fr = fwidth(pr) + 1e-4, fs = min(fwidth(pa), 0.1) * pr + 1e-4;
  float ring = 1.0 - smoothstep(0.04, 0.04 + fr, ringD);
  float spoke = pr > 1.4 ? 1.0 - smoothstep(0.04, 0.04 + fs, sa) : 0.0;
  float seam = max(ring, spoke) * step(0.6, pr) * step(pr, 5.85);
  c = mix(c, c * 0.7, seam * panelAmt);
  float dist = length(vW - cameraPosition);`);
const INK_VS = /* glsl */`
uniform float thick;   // outline width in pixels
uniform vec2 res;
void main(){
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 nv = normalize(normalMatrix * normal);
  vec2 dir = normalize(nv.xy + 1e-5);
  clip.xy += dir * thick * 2.0 / res * clip.w;
  gl_Position = clip;
}`;
const INK_FS = /* glsl */`precision highp float; out vec4 o; uniform vec3 ink; void main(){ o = vec4(ink, 1.0); }`;

function toonMat(o = {}) {
  return new THREE.ShaderMaterial({ vertexShader: o.panels ? DISH_VS : TOON_VS, fragmentShader: o.panels ? DISH_FS : TOON_FS, glslVersion: THREE.GLSL3, side: o.side ?? THREE.FrontSide,
    uniforms: { lit: { value: new THREE.Color(o.lit || '#e9eef8') }, shade: { value: new THREE.Color(o.shade || '#8d9cc4') },
      deep: { value: new THREE.Color(o.deep || '#4a5687') }, rimCol: { value: new THREE.Color(o.rim || '#bfe0ff') },
      keyDir: { value: new THREE.Vector3(-0.4, 0.8, 0.45) }, emissive: { value: new THREE.Color(o.emissive || '#000000') },
      fogCol: { value: new THREE.Color('#0b1230') }, rimAmt: { value: o.rimAmt ?? 0.35 }, fogNear: { value: 60 }, fogFar: { value: 420 },
      bands: { value: 3 }, emissAmt: { value: 0 }, glowBottom: { value: 0 }, panelAmt: { value: o.panelAmt ?? 1 } } });
}
function inkMat(thick = 2.2) {
  return new THREE.ShaderMaterial({ vertexShader: INK_VS, fragmentShader: INK_FS, glslVersion: THREE.GLSL3, side: THREE.BackSide,
    uniforms: { ink: { value: new THREE.Color('#0d1026') }, thick: { value: thick }, res: { value: new THREE.Vector2(W, H) } } });
}

// One radio telescope (VLA-like). Local frame: dish faces +Y when el = 90deg. Returns {root, az, el, focus, face}
function makeDish(mats) {
  const root = new THREE.Group();
  const add = (parent, geo, mat, pos, rot, ink = true) => {
    const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m);
    if (ink) { const k = new THREE.Mesh(geo, mats.ink); k.position.copy(m.position); k.rotation.copy(m.rotation); parent.add(k); }
    return m;
  };
  add(root, new THREE.CylinderGeometry(2.2, 2.6, 0.6, 20), mats.body, [0, 0.3, 0]);            // pad
  const az = new THREE.Group(); az.position.y = 0.6; root.add(az);
  add(az, new THREE.BoxGeometry(2.8, 1.4, 2.2), mats.body, [0, 0.7, 0]);                         // turret
  for (const sx of [-1, 1]) {                                                                   // A-frame yoke legs
    add(az, new THREE.BoxGeometry(0.45, 5.2, 0.7), mats.body, [sx * 1.9, 3.6, 0.9], [0.18, 0, sx * -0.08]);
    add(az, new THREE.BoxGeometry(0.45, 5.2, 0.7), mats.body, [sx * 1.9, 3.6, -0.9], [-0.18, 0, sx * -0.08]);
  }
  const el = new THREE.Group(); el.position.y = 6.2; az.add(el);
  add(el, new THREE.CylinderGeometry(0.35, 0.35, 4.4, 12), mats.strut, [0, 0, 0], [0, 0, Math.PI / 2]);  // elevation axle
  const R = 6.0, f = 4.6, rimY = (R * R) / (4 * f);
  const prof = [];
  for (let i = 0; i <= 28; i++) { const r = (i / 28) * R; prof.push(new THREE.Vector2(Math.max(r, 0.001), (r * r) / (4 * f) + 0.9)); }
  const bowlG = new THREE.LatheGeometry(prof, 56);
  add(el, bowlG, mats.dish, null, null, true);
  add(el, new THREE.TorusGeometry(R, 0.12, 6, 72), mats.body, [0, rimY + 0.9, 0], [Math.PI / 2, 0, 0]);   // rim ring
  add(el, new THREE.ConeGeometry(2.4, 2.2, 20, 1, true), mats.strut, [0, -0.2, 0], [Math.PI, 0, 0]);       // back truss
  const fy = f + 0.9;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const p0 = new THREE.Vector3(Math.cos(a) * R * 0.9, rimY + 0.9, Math.sin(a) * R * 0.9), p1 = new THREE.Vector3(0, fy - 0.2, 0);
    const len = p0.distanceTo(p1);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, len, 6), mats.strut);
    leg.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    el.add(leg);
    const legInk = new THREE.Mesh(leg.geometry, mats.ink); legInk.position.copy(leg.position); legInk.quaternion.copy(leg.quaternion); el.add(legInk);
  }
  add(el, new THREE.CylinderGeometry(0.9, 0.5, 0.5, 18), mats.body, [0, fy, 0]);                 // subreflector
  add(el, new THREE.CylinderGeometry(0.35, 0.6, 1.8, 14), mats.body, [0, 1.8, 0]);                // feed horn at vertex
  const focus = new THREE.Object3D(); focus.position.y = fy - 0.35; el.add(focus);
  const face = new THREE.Object3D(); face.position.y = fy + 5; el.add(face);                     // a point along the boresight
  return { root, az, el, focus, face, R, f };
}

export class DishArray {
  constructor(core) {
    this.core = core;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(40, W / H, 0.5, 3000);
    this.mats = { dish: toonMat({ lit: '#aebfe6', shade: '#5a6aa0', deep: '#2e386a', side: THREE.DoubleSide, rimAmt: 0.25, panels: true }),
      body: toonMat({ lit: '#9dadd6', shade: '#4f5e92', deep: '#2a335f', rimAmt: 0.25 }), strut: toonMat({ lit: '#8f9fca', shade: '#465489', deep: '#262e58', rimAmt: 0.2 }),
      ink: inkMat(2.2), ground: toonMat({ lit: '#1a2248', shade: '#131a3a', deep: '#0d1230', rimAmt: 0 }) };
    this.dishes = [];
    this.layout('rows');
    // ground
    const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), this.mats.ground);
    g.rotation.x = -Math.PI / 2; this.scene.add(g); this.ground = g;
    // mountain backdrop: a far cylinder with layered ridge silhouettes (transparent above the ridges)
    this.mtnTex = this.makeMountains();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1400, 1400, 420, 96, 1, true),
      new THREE.MeshBasicMaterial({ map: this.mtnTex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    cyl.position.y = 150; this.scene.add(cyl); this.mtn = cyl;
  }

  makeMountains(colors = ['#1b2554', '#131b41', '#0c1230']) {
    const c = document.createElement('canvas'); c.width = 4096; c.height = 512;
    const g = c.getContext('2d');
    const R = rng(5);
    colors.forEach((col, layer) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 512);
      const base = 300 + layer * 38, amp = 110 - layer * 30;
      let y = base;
      for (let x = 0; x <= 4096; x += 16) {
        y += (R() - 0.5) * 22 * (1 + layer * 0.3); y = Math.max(base - amp, Math.min(base + 20, y));
        const ridge = Math.sin(x / (380 + layer * 90) + layer * 2) * amp * 0.45 + Math.sin(x / 97 + layer) * 8;
        g.lineTo(x, y - ridge);
      }
      g.lineTo(4096, 512); g.closePath(); g.fill();
      // thin rim light on the ridge line
      g.strokeStyle = layer === 0 ? 'rgba(140,170,255,0.35)' : 'rgba(0,0,0,0)'; g.lineWidth = 2; g.stroke();
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
    return t;
  }

  setMountains(colors) { this.mtn.material.map = this.makeMountains(colors); this.mtn.material.needsUpdate = true; }

  layout(kind) {
    for (const d of this.dishes) this.scene.remove(d.root);
    this.dishes = [];
    const R = rng(11);
    if (kind === 'rows') {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const d = makeDish(this.mats);
        const x = (c - 3) * 21 + (r % 2) * 10.5 + (R() - 0.5) * 2, z = -r * 22 - 10 + (R() - 0.5) * 2;
        d.root.position.set(x, 0, z);
        d.home = { x, z, r, c };
        this.scene.add(d.root); this.dishes.push(d);
      }
    } else if (kind === 'Y') {
      for (let arm = 0; arm < 3; arm++) for (let k = 1; k <= 9; k++) {
        const d = makeDish(this.mats);
        const a = (arm / 3) * Math.PI * 2 + Math.PI / 2, rr = 14 + k * k * 2.6;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        d.root.position.set(x, 0, z); d.home = { x, z, r: k, c: arm };
        this.scene.add(d.root); this.dishes.push(d);
      }
    }
    this.kind = kind;
  }

  // pose(d, i, t) -> {az, el} in radians; choreo: function(i, d, t) returning {az, el}
  pose(choreo, t) {
    this.dishes.forEach((d, i) => {
      const p = choreo(i, d, t);
      d.az.rotation.y = p.az;
      d.el.rotation.x = -(Math.PI / 2 - p.el);   // el=90deg -> dish faces +Y
      d.glow = p.glow ?? 0;
    });
  }

  setLook(o = {}) {
    const M = this.mats;
    const set = (m, k, v) => { if (v !== undefined) m.uniforms[k].value.set(v); };
    for (const m of [M.dish, M.body, M.strut]) {
      if (o.keyDir) m.uniforms.keyDir.value.set(...o.keyDir);
      if (o.fogCol) m.uniforms.fogCol.value.set(o.fogCol);
      if (o.rim) m.uniforms.rimCol.value.set(o.rim);
      if (o.rimAmt !== undefined) m.uniforms.rimAmt.value = o.rimAmt;
      if (o.fogFar) { m.uniforms.fogFar.value = o.fogFar; m.uniforms.fogNear.value = o.fogNear ?? o.fogFar * 0.15; }
    }
    if (o.dish) { set(M.dish, 'lit', o.dish[0]); set(M.dish, 'shade', o.dish[1]); set(M.dish, 'deep', o.dish[2]); }
    if (o.body) { set(M.body, 'lit', o.body[0]); set(M.body, 'shade', o.body[1]); set(M.body, 'deep', o.body[2]); set(M.strut, 'lit', o.body[0]); set(M.strut, 'shade', o.body[1]); set(M.strut, 'deep', o.body[2]); }
    if (o.ground) { set(M.ground, 'lit', o.ground[0]); set(M.ground, 'shade', o.ground[1]); set(M.ground, 'deep', o.ground[2]); M.ground.uniforms.fogCol.value.set(o.fogCol || '#0b1230'); }
    if (o.ink) M.ink.uniforms.ink.value.set(o.ink);
  }

  // Render: sky (from ctx.sky using this camera) + 3D, into target. Returns receiver screen positions for glow FX.
  render(ctx, target, o = {}) {
    const cam = this.cam;
    cam.fov = o.fov || 40; cam.aspect = W / H; cam.near = 0.5; cam.far = 3000; cam.updateProjectionMatrix();
    cam.position.set(...o.pos); cam.lookAt(new THREE.Vector3(...o.look));
    if (o.roll) cam.rotateZ(o.roll);
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    const R = new THREE.Vector3(e[0], e[1], e[2]), U = new THREE.Vector3(e[4], e[5], e[6]), F = new THREE.Vector3(-e[8], -e[9], -e[10]);
    if (o.sky !== false) ctx.sky.renderBasis(target, { ...(o.sky || {}), F, R, U, fov: cam.fov, time: o.time });
    const r = this.core.renderer;
    r.setRenderTarget(target);
    r.clearDepth();
    r.render(this.scene, cam);
    // project receiver foci
    const out = [];
    const v = new THREE.Vector3(), fp = new THREE.Vector3(), vv = new THREE.Vector3();
    for (const d of this.dishes) {
      d.focus.getWorldPosition(v);
      d.face.getWorldPosition(fp);
      const bore = fp.clone().sub(v).normalize();
      const toCam = vv.copy(cam.position).sub(v).normalize();
      const facing = bore.dot(toCam);           // >0: we look into the dish
      const dist = v.distanceTo(cam.position);
      v.project(cam);
      if (v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3) out.push({ x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H, dist, glow: (d.glow || 0) * clamp(facing * 3 + 0.2), d });
    }
    return out;
  }
}

// ---- choreography helpers -------------------------------------------------------------------------
export const CHOREO = {
  // all dishes point at a sky direction (az, el)
  unison: (az, el) => () => ({ az, el }),
  stow: () => ({ az: 0, el: Math.PI / 2 * 0.98 }),
  sleep: (i) => ({ az: 0.3, el: 0.12 }),
  // ripple of elevation travelling along rows
  wave: (t, base = 0.9, amp = 0.35, speed = 3.0, k = 0.25) => (i, d) => ({ az: 0.2 * Math.sin(t * 0.8 + d.home.c * 0.3), el: base + amp * Math.sin(t * speed - (d.home.r * 1.3 + d.home.c * 0.6) * k * 4) }),
};
