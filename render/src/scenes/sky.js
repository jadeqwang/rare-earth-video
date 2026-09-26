// Procedural sky dome: gradient, Milky Way, crisp retro-anime stars with cross flares, and the beacon star (LGM-2).
import * as THREE from 'three';
import { W, H } from '../core.js';

const SKY_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform vec2 res;
uniform vec3 camF, camR, camU;      // camera basis
uniform float tanHalf;               // tan(fov/2) vertical
uniform vec3 zenith, horizon, glowCol;
uniform float horizonY, glowAmt, starAmt, mwAmt, time, twinkle, seed, beacon, beaconSize, flareAmt, exposure;
uniform vec3 galN, beaconDir, beaconCol;
uniform float trail;                 // star-trail length (radians of rotation about pole), 0 = none
uniform vec3 pole;

float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031,.1030,.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }

// octahedral map: direction -> [-1,1]^2 (area-uniform enough for star cells)
vec2 oct(vec3 n){ n /= (abs(n.x) + abs(n.y) + abs(n.z)); vec2 p = n.xy; if (n.z < 0.0) p = (1.0 - abs(p.yx)) * vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0); return p; }

// octahedral decode (inverse of oct())
vec3 octDec(vec2 p){ vec3 n = vec3(p, 1.0 - abs(p.x) - abs(p.y)); if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0); return normalize(n); }

// project a direction to pixel coordinates (returns z<=0 if behind)
vec3 toPx(vec3 sd){ float fz = dot(sd, camF); if (fz <= 0.01) return vec3(0.0, 0.0, -1.0);
  vec2 nd = vec2(dot(sd, camR) / (fz * tanHalf * res.x / res.y), dot(sd, camU) / (fz * tanHalf));
  return vec3((nd * 0.5 + 0.5) * res, 1.0); }

// one star layer: jittered cells in octahedral space; distance measured in true screen pixels
vec3 stars(vec3 d, vec2 frag, float dens, float sizePx, float prob, float bright, float layer){
  vec2 p = oct(d) * dens;
  vec2 ip = floor(p);
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(i, j);
    vec3 r = h33(vec3(c, layer + seed));
    if (r.z > prob) continue;
    vec3 sp = toPx(octDec((c + r.xy) / dens));
    if (sp.z < 0.0) continue;
    vec2 dv = frag - sp.xy;
    float d2 = dot(dv, dv);
    if (d2 > 36.0) continue;
    float mag = pow(h13(vec3(c * 1.7, layer + 5.0)), 4.0);
    float tw = 1.0 + twinkle * sin(time * (2.0 + 5.0 * r.x) + r.y * 40.0) * 0.5;
    float sz = sizePx * (0.55 + 1.1 * mag);
    float core = exp(-d2 / (sz * sz)) * (0.25 + 2.6 * mag) * tw;
    float t = h13(vec3(c, layer + 9.0));
    vec3 col = t < 0.12 ? vec3(1.0, 0.8, 0.58) : (t < 0.38 ? vec3(0.76, 0.85, 1.0) : (t < 0.46 ? vec3(1.0, 0.94, 0.82) : vec3(0.93, 0.96, 1.0)));
    acc += col * core * bright;
  }
  return acc;
}

// four-point cross flare for bright stars (screen-space, around projected position)
float cross4(vec2 q, float len, float w){
  float a = exp(-abs(q.x) / len) * exp(-q.y * q.y / (w * w));
  float b = exp(-abs(q.y) / len) * exp(-q.x * q.x / (w * w));
  return a + b;
}

void main(){
  vec2 ndc = (vUv - 0.5) * 2.0;
  vec3 d = normalize(camF + ndc.x * camR * tanHalf * res.x / res.y + ndc.y * camU * tanHalf);
  float up = d.y;                                    // world up = +y
  // gradient
  float t = smoothstep(horizonY - 0.05, 0.9, up);
  vec3 col = mix(horizon, zenith, pow(t, 0.55));
  col += glowCol * glowAmt * exp(-max(up - horizonY, 0.0) * 7.0);
  // Milky Way
  float g = dot(d, galN);
  float band = exp(-g * g * 16.0);
  float cloud = fbm(d * 2.2 + seed);
  float fine = fbm(d * 11.0 + 7.0 + seed);
  float dust = fbm(d * 8.0 + 3.0 + seed);
  float mw = band * smoothstep(0.4, 0.75, cloud * 0.7 + fine * 0.3) * (1.0 - 0.85 * smoothstep(0.52, 0.7, dust) * band);
  col += vec3(0.5, 0.58, 1.0) * mw * mwAmt * 0.36;
  col += vec3(1.0, 0.82, 0.92) * pow(band, 4.0) * smoothstep(0.6, 0.9, cloud) * mwAmt * 0.12;
  // stars: three layers (more in the band)
  vec3 s = vec3(0.0);
  if (trail > 0.0) {
    // star trails: accumulate rotated samples about the pole
    for (int k = 0; k < 24; k++) {
      float a = trail * float(k) / 23.0;
      float ca = cos(a), sa = sin(a);
      vec3 dd = d * ca + cross(pole, d) * sa + pole * dot(pole, d) * (1.0 - ca);
      s += stars(dd, gl_FragCoord.xy, 60.0, 1.0, 0.5, 0.9, 1.0) / 8.0 + stars(dd, gl_FragCoord.xy, 22.0, 1.3, 0.4, 1.4, 2.0) / 6.0;
    }
  } else {
    s += stars(d, gl_FragCoord.xy, 120.0, 0.75, 0.22 + 0.45 * band, 0.45, 1.0);
    s += stars(d, gl_FragCoord.xy, 48.0, 0.95, 0.42, 0.85, 2.0);
    s += stars(d, gl_FragCoord.xy, 15.0, 1.25, 0.35, 1.4, 3.0);
  }
  float horizonFade = smoothstep(horizonY - 0.02, horizonY + 0.12, up);
  col += s * starAmt * horizonFade;
  // bright named stars with cross flares (fixed directions from seed)
  for (int k = 0; k < 7; k++) {
    vec3 r = h33(vec3(float(k) * 7.3, seed, 3.0)) * 2.0 - 1.0;
    vec3 sd = normalize(r + vec3(0.0, 0.6, 0.0));
    float fz = dot(sd, camF);
    if (fz <= 0.1) continue;
    vec2 sp = vec2(dot(sd, camR), dot(sd, camU)) / fz / tanHalf; sp.x *= res.y / res.x;
    vec2 q = (ndc - sp) * res * 0.5;
    float m = 0.4 + 0.6 * h13(vec3(float(k), 2.0, seed));
    float tw = 0.85 + 0.15 * sin(time * 3.0 + float(k) * 2.1);
    col += vec3(0.85, 0.92, 1.0) * (exp(-dot(q, q) / 3.0) * 2.5 + cross4(q, 9.0 * m, 0.9) * 0.55 * flareAmt) * m * tw * starAmt * horizonFade;
  }
  // beacon LGM-2
  float bz = dot(beaconDir, camF);
  if (bz > 0.05 && beacon > 0.0) {
    vec2 bp = vec2(dot(beaconDir, camR), dot(beaconDir, camU)) / bz / tanHalf; bp.x *= res.y / res.x;
    vec2 q = (ndc - bp) * res * 0.5;
    float r2 = dot(q, q);
    float sz = beaconSize;
    vec3 bc = beaconCol * beacon;
    col += bc * (exp(-r2 / (2.2 * sz * sz)) * 3.0 + exp(-r2 / (60.0 * sz * sz)) * 0.35 + exp(-sqrt(r2) / (40.0 * sz)) * 0.12);
    col += bc * cross4(q, 26.0 * sz, 1.1 * sz) * 0.9 * flareAmt;
    vec2 qd = mat2(0.7071, -0.7071, 0.7071, 0.7071) * q;
    col += bc * cross4(qd, 9.0 * sz, 0.8 * sz) * 0.45 * flareAmt;
  }
  o = vec4(col * exposure, 1.0);
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

export class Sky {
  constructor(core) {
    this.core = core;
    this.mat = core.material('sky', SKY_FS, {
      res: new THREE.Vector2(W, H), camF: new THREE.Vector3(), camR: new THREE.Vector3(), camU: new THREE.Vector3(), tanHalf: 0.5,
      zenith: new THREE.Vector3(), horizon: new THREE.Vector3(), glowCol: new THREE.Vector3(), horizonY: 0, glowAmt: 0, starAmt: 1,
      mwAmt: 1, time: 0, twinkle: 0.4, seed: 1.7, beacon: 0, beaconSize: 1, flareAmt: 1, exposure: 1,
      galN: new THREE.Vector3(0.35, 0.5, 0.79).normalize(), beaconDir: new THREE.Vector3(-0.35, 0.55, -0.76).normalize(),
      beaconCol: new THREE.Vector3(1.0, 0.8, 0.42), trail: 0, pole: new THREE.Vector3(0, 0.8, -0.6).normalize() });
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
    this.core.pass(this.mat, target, {
      camF: F, camR: R, camU: U, tanHalf: Math.tan(((P.fov || 60) * Math.PI / 180) / 2),
      zenith: V(P.zenith), horizon: V(P.horizon), glowCol: V(P.glowCol), horizonY: P.horizonY, glowAmt: P.glowAmt,
      starAmt: P.starAmt, mwAmt: P.mwAmt, time: P.time || 0, twinkle: P.twinkle ?? 0.4, seed: P.seed ?? 1.7,
      beacon: P.beacon ?? 0, beaconSize: P.beaconSize ?? 1, flareAmt: P.flareAmt ?? 1, exposure: P.exposure ?? 1,
      trail: P.trail || 0, beaconDir: P.beaconDir ? V(P.beaconDir).normalize() : this.mat.uniforms.beaconDir.value,
      galN: P.galN ? V(P.galN).normalize() : this.mat.uniforms.galN.value,
    });
  }
}
