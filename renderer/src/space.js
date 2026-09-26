// Procedural space in the LIGHT material: emissive halftone bodies over a star field.
//   stars()  — layered star field, Milky Way band, warp streaks
//   body()   — halftone sphere: Earth (real land + city lights), eyeball exoplanet, red dwarf, gas giant, moon
//   dot()    — Voyager "pale blue dot" sunbeam frame

import { hex } from './util.js';

const STARS = `
uniform float t; uniform float zoom; uniform vec2 cam; uniform float rotA; uniform float density; uniform float bright;
uniform float mw; uniform float mwAng; uniform float mwOff; uniform float warp; uniform float warpT; uniform vec3 tint;
uniform float twinkle; uniform vec2 warpC;
vec3 starCol(float h){ return h < 0.2 ? vec3(0.7,0.8,1.0) : h < 0.7 ? vec3(1.0,0.97,0.92) : h < 0.9 ? vec3(1.0,0.85,0.6) : vec3(1.0,0.6,0.45); }
float starLayerB(vec2 p, float scale, float seed, float base, out vec3 col){
  vec2 q = p * scale; vec2 i = floor(q); vec2 f = fract(q);
  float acc = 0.0; col = vec3(0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = i + vec2(x, y);
    float h = hash21(c + seed);
    if (h > density) continue;
    vec2 pos = hash22(c + seed * 1.7);
    float mag = pow(hash21(c * 1.3 + seed), 6.0);
    float d = length((f - vec2(x, y) - pos) / scale) * res.y * zoom; // px distance (stars stay points under zoom)
    float size = 0.55 + mag * 2.6;
    float tw = 1.0 - twinkle * 0.5 * (0.5 + 0.5 * sin(t * (2.0 + h * 9.0) + h * 40.0));
    float v = exp(-d * d / (size * size)) * (base + mag * 2.2) * tw;
    acc += v; col += v * starCol(hash21(c + seed * 3.1));
  }
  return acc;
}
float starLayer(vec2 p, float scale, float seed, out vec3 col){ return starLayerB(p, scale, seed, 0.25, col); }
void main(){
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  p = rot(rotA) * p / zoom + cam;
  vec3 col = vec3(0); vec3 c;
  starLayerB(p, 18.0, 1.0, 0.22, c); col += c;
  starLayerB(p, 42.0, 7.0, 0.12, c); col += c * 0.7;
  starLayerB(p, 90.0, 13.0, 0.06, c); col += c * 0.45;
  // Milky Way band
  if (mw > 0.0) {
    vec2 b = rot(mwAng) * p;
    float band = exp(-pow((b.y - mwOff) * 3.2, 2.0));
    float cloud = fbm(b * 3.0 + 4.0) * 0.8 + fbm(b * 9.0) * 0.4;
    float dust = smoothstep(0.45, 0.75, fbm(b * 5.0 + 11.0)) * exp(-pow((b.y - mwOff) * 7.0, 2.0));
    float glow = band * cloud * (1.0 - dust * 0.6);
    col += glow * mw * vec3(0.55, 0.62, 0.9) * 0.55;
    vec3 c2; float dense = starLayerB(p, 160.0, 21.0, 0.03, c2);
    col += c2 * band * mw * 0.45 * (1.0 - dust);
  }
  // warp streaks radiating from warpC
  if (warp > 0.0) {
    vec2 q = (uv - 0.5 - warpC) * vec2(res.x / res.y, 1.0);
    float a = atan(q.y, q.x), r = length(q);
    float bins = 520.0;
    for (int L = 0; L < 3; L++) {
      float fl = float(L);
      float ai = floor((a / TAU + 0.5) * bins + fl * 0.37);
      float h = hash11(ai * 1.37 + fl * 101.0);
      if (h > 0.55) continue;
      float z = fract(h * 13.7 - warpT * (0.35 + h) );
      float r0 = 0.04 / max(z, 0.02);
      float len = warp * 0.9 * r0;
      float ac = ((ai + 0.5 - fl * 0.37) / bins - 0.5) * TAU;
      float dAng = abs(mod(a - ac + PI, TAU) - PI) * r * res.y;
      float along = smoothstep(r0 - 0.002, r0, r) * (1.0 - smoothstep(r0 + len - 0.01, r0 + len, r));
      float w = 0.6 + 1.6 * (1.0 - z);
      col += along * exp(-dAng * dAng / (w * w)) * vec3(0.75, 0.85, 1.0) * (1.0 - z) * 1.6 * warp;
    }
  }
  o = vec4(col * bright * tint, 1.0);
}`;

const BODY = `
uniform sampler2D landTex; uniform sampler2D lightTex;
uniform vec2 center; uniform float radius; uniform float lon; uniform float tilt; uniform vec3 sunDir;
uniform float kind; uniform float cell; uniform float t; uniform vec3 colA; uniform vec3 colB; uniform vec3 colC;
uniform float cityAmt; uniform float atmo; uniform float halftone; uniform float flare; uniform float ringLights; uniform float spin;
uniform float alpha; uniform vec3 atmoCol;
// returns (shade, landMask, lights, feature) at a point on the unit sphere facing the camera
vec3 sph(vec2 p){ float z = sqrt(max(0.0, 1.0 - dot(p, p))); return vec3(p, z); }
vec4 surface(vec3 n){
  // rotate by tilt (x axis) then longitude (y axis)
  vec3 q = n;
  float ct = cos(tilt), st = sin(tilt);
  q = vec3(q.x, ct * q.y - st * q.z, st * q.y + ct * q.z);
  float cl = cos(lon), sl = sin(lon);
  q = vec3(cl * q.x + sl * q.z, q.y, -sl * q.x + cl * q.z);
  float la = asin(clamp(q.y, -1.0, 1.0));
  float lo = atan(q.x, q.z);
  vec2 eq = vec2(lo / TAU + 0.5, 0.5 - la / PI);
  float land = 0.0, lights = 0.0, feat = 0.0;
  if (kind < 0.5) { land = texture(landTex, vec2(eq.x, 1.0 - eq.y)).r; lights = texture(lightTex, vec2(eq.x, 1.0 - eq.y)).r; }
  else if (kind < 1.5) { // eyeball exoplanet: procedural continents + terminator cities
    float c = fbm(eq * vec2(9.0, 5.0) + 3.1); land = smoothstep(0.52, 0.56, c);
    feat = fbm(eq * vec2(30.0, 16.0));
  } else if (kind < 2.5) { // star granulation
    feat = fbm(eq * vec2(26.0, 14.0) + t * 0.05) * 0.6 + fbm(eq * vec2(80.0, 40.0) - t * 0.08) * 0.4;
  } else if (kind < 3.5) { // gas giant bands
    feat = 0.5 + 0.5 * sin(la * 18.0 + fbm(eq * vec2(6.0, 30.0)) * 4.0);
  } else { // moon / rocky
    feat = fbm(eq * vec2(14.0, 8.0)); land = smoothstep(0.35, 0.8, fbm(eq * vec2(40.0, 22.0)));
  }
  return vec4(land, lights, feat, la);
}
vec3 shadeAt(vec2 p, out float lightsOut){
  vec3 n = sph(p);
  vec4 s = surface(n);
  float ndl = dot(n, normalize(sunDir));
  float day = smoothstep(-0.08, 0.25, ndl);
  lightsOut = 0.0;
  vec3 c;
  if (kind < 0.5) {
    vec3 ocean = colA, land = colB;
    c = mix(ocean, land, s.x) * (0.08 + 1.1 * max(ndl, 0.0));
    lightsOut = s.y * (1.0 - day) * cityAmt;
  } else if (kind < 1.5) {
    // eyeball: dayside hot ocean, twilight band, icy night; cities only on land along the terminator
    float term = exp(-pow((ndl + 0.02) / 0.075, 2.0));
    c = mix(colA * 0.05, mix(colA, colB, s.x), smoothstep(-0.12, 0.45, ndl)) * (0.06 + max(ndl, 0.0));
    float clusters = step(0.62, s.z) * s.x;
    lightsOut = term * clusters * cityAmt;
    c += vec3(0.55, 0.75, 0.95) * 0.04 * smoothstep(0.0, -0.7, ndl);
  } else if (kind < 2.5) {
    float mu = n.z;
    float limb = pow(mu, 0.55);
    c = mix(colA, colB, s.z) * limb * 1.6;
  } else if (kind < 3.5) {
    c = mix(colA, colB, s.z) * (0.06 + max(ndl, 0.0));
  } else {
    c = mix(colA, colB, s.z) * (1.0 - 0.35 * s.x) * (0.05 + max(ndl, 0.0));
  }
  return c;
}
void main(){
  vec2 px = uv * res;
  vec2 d = (px - center) / radius;
  float r = length(d);
  vec3 col = vec3(0);
  // halftone sampling: evaluate at the dot-cell centre
  float useHT = halftone * smoothstep(6.0, 14.0, radius / cell);
  mat2 R = rot(0.5236);
  vec2 hp = R * px / cell; vec2 g = floor(hp) + 0.5; vec2 cpx = transpose(R) * (g * cell);
  vec2 dc = (cpx - center) / radius;
  if (r < 1.0 || length(dc) < 1.0) {
    float lc, lp;
    vec3 cc = length(dc) < 1.0 ? shadeAt(dc, lc) : vec3(0);
    vec3 cp = r < 1.0 ? shadeAt(d, lp) : vec3(0);
    float Lc = lum(cc);
    float rad = sqrt(clamp(Lc * 1.3, 0.0, 1.0)) * 0.62;
    float dotm = 1.0 - smoothstep(rad - 0.08, rad + 0.08, length(hp - g));
    vec3 ht = cc / max(Lc, 1e-3) * min(Lc * 1.3, 1.0) * dotm * 1.35;
    col = mix(cp * step(r, 1.0), ht, useHT);
    // city / terminator lights as small warm dots (always crisp)
    float lights = mix(lp * step(r, 1.0), lc, useHT);
    float ldot = 1.0 - smoothstep(0.18, 0.3, length(hp - g));
    col += colC * lights * mix(1.0, ldot * 2.2, useHT) * 1.4;
  }
  // limb / atmosphere
  float rim = exp(-pow((r - 1.0) * radius / max(2.0, radius * 0.035), 2.0));
  float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(normalize(vec3(d, 0.15)), normalize(sunDir)));
  col += atmoCol * rim * atmo * (kind > 1.5 && kind < 2.5 ? 1.0 : lit);
  if (kind > 1.5 && kind < 2.5) { // star corona + flares
    float corona = exp(-max(r - 1.0, 0.0) * 5.0) * step(1.0, r);
    col += colB * corona * 0.7;
    float a = atan(d.y, d.x);
    float fl = pow(max(0.0, fbm(vec2(a * 3.0, t * 0.4)) - 0.45) * 2.4, 2.0) * exp(-max(r - 1.0, 0.0) * 9.0) * step(1.0, r);
    col += colB * fl * flare * 2.0;
  }
  o = vec4(col * alpha, 1.0);
}`;

const PALEDOT = `
uniform float t; uniform float dotR; uniform vec2 dotP; uniform float bandAmt; uniform float grainAmt;
void main(){
  vec2 p = uv;
  vec3 col = vec3(0.0);
  // scattered sunlight bands (Voyager 1, 1990): soft diagonal streaks
  vec2 q = rot(-0.18) * (p - 0.5);
  float b1 = exp(-pow((q.x + 0.02) * 9.0, 2.0)), b2 = exp(-pow((q.x - 0.19) * 12.0, 2.0)), b3 = exp(-pow((q.x + 0.27) * 14.0, 2.0));
  float n = fbm(vec2(q.x * 30.0, q.y * 2.0)) * 0.5 + 0.5;
  col += vec3(0.62, 0.36, 0.18) * b1 * 0.95 * n;
  col += vec3(0.28, 0.36, 0.62) * b2 * 0.75 * n;
  col += vec3(0.55, 0.28, 0.36) * b3 * 0.55 * n;
  col *= bandAmt;
  // the dot
  float d = length((p - dotP) * res) ;
  col += vec3(0.62, 0.78, 1.0) * exp(-d * d / (dotR * dotR)) * 1.6;
  col += vec3(0.62, 0.78, 1.0) * exp(-d / (dotR * 5.0)) * 0.12;
  col += (hash21(floor(p * res / 2.0) + floor(t * 12.0)) - 0.5) * grainAmt;
  o = vec4(max(col, 0.0), 1.0);
}`;

export class Space {
  constructor(e) {
    this.e = e; const g = e.g;
    this.pStars = g.program('stars', STARS);
    this.pBody = g.program('body', BODY);
    this.pDot = g.program('paledot', PALEDOT);
    this.tmpA = g.target(e.W, e.H);
    this.tmpB = g.target(e.W, e.H);
    this.pAdd = g.program('spaceadd', `uniform sampler2D a; uniform sampler2D b; void main(){ o = vec4(texture(a, uv).rgb + texture(b, uv).rgb, 1.0); }`);
    this.pCopy = g.program('spacecopy', `uniform sampler2D a; void main(){ o = vec4(texture(a, uv).rgb, 1.0); }`);
  }
  async init() {
    const g = this.e.g;
    const land = await this.e.image('assets/geo/land.png');
    const lights = await this.e.image('assets/geo/lights.png');
    this.land = g.upload(g.texture(land.width, land.height, { repeat: true }), land, true);
    this.lights = g.upload(g.texture(lights.width, lights.height, { repeat: true }), lights, true);
  }
  stars(out, o = {}) {
    this.e.g.pass(this.pStars, out, {}, {
      t: o.t || 0, zoom: o.zoom ?? 1, cam: o.cam || [0, 0], rotA: o.rot || 0, density: o.density ?? 0.5, bright: o.bright ?? 1,
      mw: o.mw ?? 0, mwAng: o.mwAng ?? 0.5, mwOff: o.mwOff ?? 0, warp: o.warp ?? 0, warpT: o.warpT ?? 0, tint: o.tint || [1, 1, 1],
      twinkle: o.twinkle ?? 1, warpC: o.warpC || [0, 0],
    });
  }
  // Draw a body additively over `base` into `out` (base may equal a scratch target).
  body(base, out, o = {}) {
    const g = this.e.g, S = this.e.S;
    const kinds = { earth: 0, eyeball: 1, star: 2, giant: 3, moon: 4 };
    g.pass(this.pBody, this.tmpB, { landTex: this.land, lightTex: this.lights }, {
      center: o.center || [this.e.W / 2, this.e.H / 2], radius: o.radius ?? 300 * S, lon: o.lon ?? 0, tilt: o.tilt ?? 0.3,
      sunDir: o.sun || [0.8, 0.2, 0.4], kind: kinds[o.kind || 'earth'], cell: (o.cell ?? 6) * S, t: o.t || 0,
      colA: hex(o.colA || '#1E4C9A'), colB: hex(o.colB || '#9CC8FF'), colC: hex(o.colC || '#FFB547'),
      cityAmt: o.city ?? 1, atmo: o.atmo ?? 1, halftone: o.halftone ?? 1, flare: o.flare ?? 0, ringLights: 0, spin: 0,
      alpha: o.alpha ?? 1, atmoCol: hex(o.atmoCol || '#9CC8FF'),
    });
    g.pass(this.pAdd, out, { a: base, b: this.tmpB });
  }
  paleDot(out, o = {}) {
    const S = this.e.S;
    this.e.g.pass(this.pDot, out, {}, { t: o.t || 0, dotR: (o.dotR ?? 1.6) * S, dotP: o.dotP || [0.62, 0.42], bandAmt: o.bands ?? 1, grainAmt: o.grain ?? 0.05 });
  }
  copy(src, out) { this.e.g.pass(this.pCopy, out, { a: src }); }
}
