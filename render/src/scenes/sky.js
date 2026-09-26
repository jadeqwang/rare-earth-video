// Procedural sky dome: gradient, Milky Way, crisp retro-anime stars with cross flares, and the beacon star (LGM-2).
// Fast path for software GL: the Milky Way is baked once into an equirect texture, stars are a point catalogue
// projected in a vertex shader, and flares (bright stars, beacon) are point sprites; only the gradient is per pixel.
import * as THREE from 'three';
import { W, H } from '../core.js';
import { rng } from '../lib/util.js';

const NOISE = /* glsl */`
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }`;

// bake: equirect Milky Way (lon = atan(x, z), lat = asin(y))
const MW_BAKE_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform vec3 galN; uniform float seed;
${NOISE}
void main(){
  float lon = (vUv.x - 0.5) * 6.2831853, lat = (vUv.y - 0.5) * 3.1415927;
  vec3 d = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  float g = dot(d, galN);
  float band = exp(-g * g * 16.0);
  vec3 c = vec3(0.0);
  if (band > 0.004) {
    float cloud = fbm(d * 2.2 + seed);
    float fine = fbm(d * 11.0 + 7.0 + seed);
    float dust = fbm(d * 8.0 + 3.0 + seed);
    float mw = band * smoothstep(0.4, 0.75, cloud * 0.7 + fine * 0.3) * (1.0 - 0.85 * smoothstep(0.52, 0.7, dust) * band);
    c = vec3(0.5, 0.58, 1.0) * mw * 0.36 + vec3(1.0, 0.82, 0.92) * pow(band, 4.0) * smoothstep(0.6, 0.9, cloud) * 0.12;
  }
  o = vec4(c, 1.0);
}`;

const SKY_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform vec2 res;
uniform vec3 camF, camR, camU;      // camera basis
uniform float tanHalf;               // tan(fov/2) vertical
uniform vec3 zenith, horizon, glowCol;
uniform float horizonY, glowAmt, mwAmt, exposure;
uniform sampler2D mwTex;
void main(){
  vec2 ndc = (vUv - 0.5) * 2.0;
  vec3 d = normalize(camF + ndc.x * camR * tanHalf * res.x / res.y + ndc.y * camU * tanHalf);
  float up = d.y;                                    // world up = +y
  float t = smoothstep(horizonY - 0.05, 0.9, up);
  vec3 col = mix(horizon, zenith, pow(t, 0.55));
  col += glowCol * glowAmt * exp(-max(up - horizonY, 0.0) * 7.0);
  if (mwAmt > 0.001) {
    vec2 uv = vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    col += texture(mwTex, uv).rgb * mwAmt;
  }
  o = vec4(col * exposure, 1.0);
}`;

// shared projection for point passes: direction -> clip, same basis as the gradient pass
const PROJ = /* glsl */`
uniform vec3 camF, camR, camU; uniform float tanHalf; uniform vec2 res;
bool projectDir(vec3 d, out vec4 clip){
  float fz = dot(d, camF);
  if (fz <= 0.02) { clip = vec4(2.0, 2.0, 2.0, 1.0); return false; }
  clip = vec4(dot(d, camR) / (fz * tanHalf * res.x / res.y), dot(d, camU) / (fz * tanHalf), 0.0, 1.0);
  return true;
}`;

const STAR_VS = /* glsl */`
in float size; in float bright; in vec3 scol; in float ph;
uniform float time, twinkle, starAmt, horizonY, exposure;
out vec3 vCol; out float vSz; out float vBox;
${PROJ}
void main(){
  vec3 d = normalize(position);
  vec4 clip;
  if (!projectDir(d, clip) || starAmt <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vCol = vec3(0.0); vSz = 1.0; vBox = 1.0; return; }
  gl_Position = clip;
  float tw = 1.0 + twinkle * sin(time * (2.0 + 5.0 * ph) + ph * 40.0) * 0.5;
  float hf = smoothstep(horizonY - 0.02, horizonY + 0.12, d.y);
  vSz = size;
  vBox = ceil(size * 5.0) * 2.0 + 1.0;
  gl_PointSize = vBox;
  vCol = scol * bright * tw * hf * starAmt * exposure;
}`;
const STAR_FS = /* glsl */`
precision highp float; in vec3 vCol; in float vSz; in float vBox; out vec4 o;
void main(){ vec2 q = (gl_PointCoord - 0.5) * vBox; float d2 = dot(q, q); if (d2 > 36.0) discard; o = vec4(vCol * exp(-d2 / (vSz * vSz)), 1.0); }`;

const FLARE_VS = /* glsl */`
in float kind; in float mag; in float ph;
uniform float time, starAmt, horizonY, exposure, beacon, beaconSize;
uniform vec3 beaconDir;
out float vKind; out float vM; out float vBox; out float vA;
${PROJ}
void main(){
  vec3 d = kind > 0.5 ? normalize(beaconDir) : normalize(position);
  vec4 clip;
  float on = kind > 0.5 ? beacon : starAmt;
  if (!projectDir(d, clip) || on <= 0.0 || (kind < 0.5 && dot(d, camF) <= 0.1)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vKind = 0.0; vM = 0.0; vBox = 1.0; vA = 0.0; return; }
  gl_Position = clip;
  float hf = smoothstep(horizonY - 0.02, horizonY + 0.12, d.y);
  vKind = kind; vM = mag;
  vBox = kind > 0.5 ? min(1000.0, ceil(400.0 * beaconSize)) : 241.0;
  gl_PointSize = vBox;
  vA = (kind > 0.5 ? beacon : starAmt * hf * (0.85 + 0.15 * sin(time * 3.0 + ph * 2.1))) * exposure;
}`;
const FLARE_FS = /* glsl */`
precision highp float; in float vKind; in float vM; in float vBox; in float vA; out vec4 o;
uniform float beaconSize, flareAmt; uniform vec3 beaconCol;
float cross4(vec2 q, float len, float w){
  float a = exp(-abs(q.x) / len) * exp(-q.y * q.y / (w * w));
  float b = exp(-abs(q.y) / len) * exp(-q.x * q.x / (w * w));
  return a + b;
}
void main(){
  vec2 q = (gl_PointCoord - 0.5) * vBox;
  vec3 c;
  if (vKind > 0.5) {
    float sz = beaconSize, r2 = dot(q, q);
    vec3 bc = beaconCol * vA;
    c = bc * (exp(-r2 / (2.2 * sz * sz)) * 3.0 + exp(-r2 / (60.0 * sz * sz)) * 0.35 + exp(-sqrt(r2) / (40.0 * sz)) * 0.12);
    c += bc * cross4(q, 26.0 * sz, 1.1 * sz) * 0.9 * flareAmt;
    vec2 qd = mat2(0.7071, -0.7071, 0.7071, 0.7071) * q;
    c += bc * cross4(qd, 9.0 * sz, 0.8 * sz) * 0.45 * flareAmt;
  } else {
    float m = vM;
    c = vec3(0.85, 0.92, 1.0) * (exp(-dot(q, q) / 3.0) * 2.5 + cross4(q, 9.0 * m, 0.9) * 0.55 * flareAmt) * m * vA;
  }
  o = vec4(c, 1.0);
}`;

export function camBasis(yaw, pitch, roll = 0) {
  // yaw about +y, pitch about camera right; forward starts at -z
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const F = new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize();
  let R = new THREE.Vector3().crossVectors(F, new THREE.Vector3(0, 1, 0)).normalize();
  let U = new THREE.Vector3().crossVectors(R, F).normalize();
  if (roll) { const cr = Math.cos(roll), sr = Math.sin(roll); const R2 = R.clone().multiplyScalar(cr).addScaledVector(U, sr); const U2 = U.clone().multiplyScalar(cr).addScaledVector(R, -sr); R = R2; U = U2; }
  return { F, R, U };
}

export const SKY_PRESETS = {
  night: { zenith: [0.012, 0.018, 0.05], horizon: [0.07, 0.1, 0.24], glowCol: [0.15, 0.2, 0.45], glowAmt: 0.35, starAmt: 1.0, mwAmt: 1.0, horizonY: -0.02 },
  deep: { zenith: [0.004, 0.006, 0.02], horizon: [0.02, 0.03, 0.08], glowCol: [0.1, 0.12, 0.3], glowAmt: 0.1, starAmt: 1.1, mwAmt: 1.2, horizonY: -1.0 },
  dusk: { zenith: [0.03, 0.03, 0.1], horizon: [0.28, 0.16, 0.38], glowCol: [0.9, 0.4, 0.35], glowAmt: 0.5, starAmt: 0.7, mwAmt: 0.5, horizonY: -0.02 },
  dawn: { zenith: [0.1, 0.2, 0.45], horizon: [1.0, 0.72, 0.45], glowCol: [1.0, 0.6, 0.3], glowAmt: 0.8, starAmt: 0.25, mwAmt: 0.1, horizonY: -0.02 },
  predawn: { zenith: [0.03, 0.05, 0.15], horizon: [0.45, 0.35, 0.5], glowCol: [0.9, 0.55, 0.4], glowAmt: 0.45, starAmt: 0.75, mwAmt: 0.5, horizonY: -0.02 },
};

const GAL_N = new THREE.Vector3(0.35, 0.5, 0.79).normalize();
const SEED = 1.7;

export class Sky {
  constructor(core) {
    this.core = core;
    this.mwRT = core.rt('skyMW', 2048, 1024, { float: true });
    this.mwRT.texture.wrapS = THREE.RepeatWrapping;
    const bake = core.material('skyMWBake', MW_BAKE_FS, { galN: GAL_N, seed: SEED });
    core.pass(bake, this.mwRT, { galN: GAL_N, seed: SEED });
    this.mat = core.material('sky', SKY_FS, {
      res: new THREE.Vector2(W, H), camF: new THREE.Vector3(), camR: new THREE.Vector3(), camU: new THREE.Vector3(), tanHalf: 0.5,
      zenith: new THREE.Vector3(), horizon: new THREE.Vector3(), glowCol: new THREE.Vector3(), horizonY: 0, glowAmt: 0,
      mwAmt: 1, exposure: 1, mwTex: this.mwRT.texture });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // shared uniforms for the point passes
    this.U = { camF: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, tanHalf: { value: 0.5 },
      res: { value: new THREE.Vector2(W, H) }, time: { value: 0 }, twinkle: { value: 0.4 }, starAmt: { value: 1 }, horizonY: { value: 0 }, exposure: { value: 1 },
      beacon: { value: 0 }, beaconSize: { value: 1 }, flareAmt: { value: 1 }, beaconDir: { value: new THREE.Vector3(-0.35, 0.55, -0.76).normalize() },
      beaconCol: { value: new THREE.Vector3(1.0, 0.8, 0.42) } };
    this.starScene = new THREE.Scene();
    this.starScene.add(this.makeStars());
    this.starScene.add(this.makeFlares());
  }

  // star catalogue: three magnitude layers like the old procedural field, extra faint stars along the galactic band
  makeStars() {
    const R = rng(1234);
    const pos = [], size = [], bright = [], scol = [], ph = [];
    const layers = [[30000, 0.75, 0.45, true], [7700, 0.95, 0.85, false], [640, 1.25, 1.4, false]];
    for (const [n, sizePx, br, bandBoost] of layers) {
      let made = 0, guard = 0;
      while (made < n && guard++ < n * 6) {
        const z = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        const d = new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
        if (bandBoost) { const g = d.dot(GAL_N); const band = Math.exp(-g * g * 16); if (R() > (0.22 + 0.45 * band) / 0.67) continue; }
        const mag = Math.pow(R(), 4);
        const t = R();
        const c = t < 0.12 ? [1.0, 0.8, 0.58] : (t < 0.38 ? [0.76, 0.85, 1.0] : (t < 0.46 ? [1.0, 0.94, 0.82] : [0.93, 0.96, 1.0]));
        pos.push(d.x, d.y, d.z); size.push(sizePx * (0.55 + 1.1 * mag)); bright.push((0.25 + 2.6 * mag) * br); scol.push(...c); ph.push(R());
        made++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('bright', new THREE.Float32BufferAttribute(bright, 1));
    g.setAttribute('scol', new THREE.Float32BufferAttribute(scol, 3));
    g.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, glslVersion: THREE.GLSL3, uniforms: this.U,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false;
    return p;
  }

  // 7 bright named stars (fixed directions) + the beacon as point sprites
  makeFlares() {
    const R = rng(77);
    const pos = [], kind = [], mag = [], ph = [];
    for (let k = 0; k < 7; k++) {
      const d = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1 + 0.6, R() * 2 - 1).normalize();
      pos.push(d.x, d.y, d.z); kind.push(0); mag.push(0.4 + 0.6 * R()); ph.push(k);
    }
    pos.push(0, 1, 0); kind.push(1); mag.push(1); ph.push(0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
    g.setAttribute('mag', new THREE.Float32BufferAttribute(mag, 1));
    g.setAttribute('ph', new THREE.Float32BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: FLARE_VS, fragmentShader: FLARE_FS, glslVersion: THREE.GLSL3, uniforms: this.U,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false;
    return p;
  }

  // o: {yaw,pitch,roll,fov(deg), preset or colors, beacon, time, ...}
  render(target, o) {
    const { F, R, U } = camBasis(o.yaw || 0, o.pitch || 0, o.roll || 0);
    this.renderBasis(target, { ...o, F, R, U });
  }
  // o.F/R/U: camera basis vectors (THREE.Vector3)
  renderBasis(target, o) {
    const P = { ...SKY_PRESETS[o.preset || 'night'], ...o };
    const { F, R, U } = P;
    const V = (a) => new THREE.Vector3(...a);
    const tanHalf = Math.tan(((P.fov || 60) * Math.PI / 180) / 2);
    const exposure = P.exposure ?? 1;
    this.core.pass(this.mat, target, {
      camF: F, camR: R, camU: U, tanHalf,
      zenith: V(P.zenith), horizon: V(P.horizon), glowCol: V(P.glowCol), horizonY: P.horizonY, glowAmt: P.glowAmt,
      mwAmt: P.mwAmt, exposure,
    });
    const u = this.U;
    u.camF.value.copy(F); u.camR.value.copy(R); u.camU.value.copy(U); u.tanHalf.value = tanHalf;
    u.time.value = P.time || 0; u.twinkle.value = P.twinkle ?? 0.4; u.starAmt.value = P.starAmt; u.horizonY.value = P.horizonY; u.exposure.value = exposure;
    u.beacon.value = P.beacon ?? 0; u.beaconSize.value = P.beaconSize ?? 1; u.flareAmt.value = P.flareAmt ?? 1;
    if (P.beaconDir) u.beaconDir.value.set(...P.beaconDir).normalize();
    else u.beaconDir.value.set(-0.35, 0.55, -0.76).normalize();
    const r = this.core.renderer;
    r.setRenderTarget(target);
    r.render(this.starScene, this.cam);
  }
}
