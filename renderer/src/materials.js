// The two materials of the film, as GPU passes over a plate frame.
//
//   INK   — present-day Earth: Kuwahara-flattened colour -> 4 tone bands mapped through a
//           scene ramp, halftone in the mid tones, XDoG ink contour, optional drawn mouth.
//   LIGHT — the signal / 2011 / space: emissive halftone dots on black, neon contour,
//           optional scanlines + RGB split for 2011 footage.
//
// Heavy image analysis runs at plate resolution; the stylisation (dots, lines) runs at
// output resolution so it stays crisp.

import { hex } from './util.js';

const KUWAHARA = `
uniform sampler2D src; uniform float radius;
void main(){
  vec2 px = 1.0 / vec2(textureSize(src, 0));
  vec3 m0=vec3(0),m1=vec3(0),m2=vec3(0),m3=vec3(0), s0=vec3(0),s1=vec3(0),s2=vec3(0),s3=vec3(0);
  float n = 0.0;
  int R = int(radius);
  for (int j = 0; j <= 5; j++) { if (j > R) break;
    for (int i = 0; i <= 5; i++) { if (i > R) break;
      vec3 a = texture(src, uv + vec2(-i,-j)*px).rgb; m0 += a; s0 += a*a;
      vec3 b = texture(src, uv + vec2( i,-j)*px).rgb; m1 += b; s1 += b*b;
      vec3 c = texture(src, uv + vec2(-i, j)*px).rgb; m2 += c; s2 += c*c;
      vec3 d = texture(src, uv + vec2( i, j)*px).rgb; m3 += d; s3 += d*d;
      n += 1.0; } }
  m0/=n; m1/=n; m2/=n; m3/=n;
  float v0 = dot(abs(s0/n - m0*m0), vec3(1)), v1 = dot(abs(s1/n - m1*m1), vec3(1));
  float v2 = dot(abs(s2/n - m2*m2), vec3(1)), v3 = dot(abs(s3/n - m3*m3), vec3(1));
  vec3 r = m0; float v = v0;
  if (v1 < v) { v = v1; r = m1; } if (v2 < v) { v = v2; r = m2; } if (v3 < v) { v = v3; r = m3; }
  o = vec4(r, 1.0);
}`;

const BLUR = `
uniform sampler2D src; uniform vec2 dir; uniform float sigma;
void main(){
  vec2 px = dir / vec2(textureSize(src, 0));
  vec4 s = vec4(0); float w = 0.0;
  int R = min(10, int(ceil(sigma * 3.0)));
  for (int i = -R; i <= R; i++) {
    float fi = float(i); float k = exp(-fi*fi / (2.0*sigma*sigma));
    s += texture(src, uv + px * fi) * k; w += k; }
  o = s / w;
}`;

// XDoG on luminance of two blurs; output r = ink amount.
const XDOG = `
uniform sampler2D g1; uniform sampler2D g2; uniform float tau; uniform float eps; uniform float phi;
void main(){
  float a = lum(texture(g1, uv).rgb), b = lum(texture(g2, uv).rgb);
  float d = a - tau * b;
  float e = d >= eps ? 1.0 : 1.0 + tanh(phi * (d - eps));
  o = vec4(vec3(1.0 - clamp(e, 0.0, 1.0)), 1.0);
}`;

// Shared: plate-space transform (pan/zoom/shake applied as uv mapping) and the mouth.
const PLATE_UV = `
uniform vec4 xf;      // (zoom, cx, cy, rot) : camera move over the plate
uniform vec2 shake;   // uv offset
uniform float plateAspect;
vec2 plateUV(vec2 u){
  vec2 p = u - 0.5;
  float outA = res.x / res.y;
  p.x *= outA;
  p = rot(xf.w) * p;
  p /= xf.x;
  p.x /= plateAspect;
  return p + vec2(xf.y, xf.z) + shake;
}
float inPlate(vec2 q){ return step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0); }
`;

const MOUTH = `
uniform vec4 mouth;    // (x, y, angle, width) in plate uv; width <= 0 disables
uniform vec3 mouthShape; // (open 0..1, wide 0..1, round 0..1)
uniform vec3 mouthInk; uniform vec3 mouthIn; uniform vec3 mouthTongue; uniform vec3 skinTone;
// signed distance helpers
float sdEllipse(vec2 p, vec2 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
// returns (fill mask, ink mask, erase mask) for the mouth at plate uv q
vec3 mouthMasks(vec2 q){
  if (mouth.w <= 0.0) return vec3(0);
  vec2 p = q - mouth.xy; p.x *= plateAspect; p = rot(-mouth.z) * p; p /= mouth.w * plateAspect;
  // p is now in "mouth widths": x in [-0.5, 0.5] spans the lips
  float open = mouthShape.x, wide = mouthShape.y, rnd = mouthShape.z;
  float halfW = mix(0.30, 0.46, wide) * mix(1.0, 0.62, rnd);
  float halfH = mix(0.012, mix(0.16, 0.24, rnd), open);
  vec2 c = p - vec2(0.0, 0.03 * open);          // open mouths drop a little
  float d = sdEllipse(c, vec2(halfW, halfH));
  // flatten the top edge a bit (anime mouth: straighter upper lip)
  d = max(d, -(c.y + halfH * 0.72));
  float px = fwidth(p.x) * 1.2;
  float fill = open > 0.06 ? 1.0 - smoothstep(-px, px, d) : 0.0;
  float line = 1.0 - smoothstep(0.012, 0.012 + px, abs(d));
  // closed mouth: a single soft stroke with a tiny smile curve
  if (open <= 0.06) {
    float y = p.y - 0.06 * p.x * p.x;
    float stroke = (1.0 - smoothstep(0.010, 0.010 + px, abs(y))) * (1.0 - smoothstep(halfW * 0.85, halfW * 0.85 + px, abs(p.x)));
    line = stroke; fill = 0.0;
  }
  float erase = 1.0 - smoothstep(0.45, 0.72, length(p / vec2(0.58, 0.26)));
  return vec3(fill, line, erase);
}
vec3 mouthColor(vec2 q, vec3 col, float tongueY){
  vec3 m = mouthMasks(q);
  if (m.z <= 0.0) return col;
  // local skin tone: medoid of four samples around the mouth (cheeks, philtrum, chin),
  // so a sample that lands on hair or background is ignored
  vec2 ax = vec2(cos(mouth.z), plateAspect * sin(mouth.z)) * mouth.w;
  vec2 up = vec2(-sin(mouth.z), plateAspect * cos(mouth.z)) * mouth.w;
  vec3 s0 = skinAt(mouth.xy + ax * 0.85), s1 = skinAt(mouth.xy - ax * 0.85);
  vec3 s2 = skinAt(mouth.xy + up * 0.45), s3 = skinAt(mouth.xy - up * 0.55);
  float d0 = distance(s0, s1) + distance(s0, s2) + distance(s0, s3);
  float d1 = distance(s1, s0) + distance(s1, s2) + distance(s1, s3);
  float d2 = distance(s2, s0) + distance(s2, s1) + distance(s2, s3);
  float d3 = distance(s3, s0) + distance(s3, s1) + distance(s3, s2);
  vec3 sk = s0; float dm = d0;
  if (d1 < dm) { sk = s1; dm = d1; }
  if (d2 < dm) { sk = s2; dm = d2; }
  if (d3 < dm) { sk = s3; dm = d3; }
  col = mix(col, sk, m.z);
  vec2 p = q - mouth.xy; p.x *= plateAspect; p = rot(-mouth.z) * p; p /= mouth.w * plateAspect;
  vec3 inner = mix(mouthIn, mouthTongue, smoothstep(0.0, 0.12, p.y - tongueY) * mouthShape.x);
  col = mix(col, inner, m.x);
  col = mix(col, mouthInk, m.y);
  return col;
}
`;

const INK = `
uniform sampler2D flat_; uniform sampler2D edge; uniform sampler2D plate; uniform sampler2D mask; uniform sampler2D blurB; uniform float sparkle;
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 inkCol;
uniform float bands; uniform float hueKeep; uniform float cell; uniform float lineW; uniform float bgLine;
uniform float exposure; uniform float gamma; uniform float hasMask; uniform float paper; uniform float twoTone; uniform float bgSoft; uniform float allSoft;
${PLATE_UV}
vec3 skinAt(vec2 q){ return texture(flat_, q).rgb; }
${MOUTH}
void main(){
  vec2 q = plateUV(uv);
  float inside = inPlate(q);
  vec3 s = texture(flat_, q).rgb;
  s = mouthColor(q, s, 0.02);
  float L = pow(clamp(lum(s) * exposure, 0.0, 1.0), gamma);
  // tone bands with anti-aliased edges
  float x = L * bands;
  float fw = max(fwidth(x), 1e-4);
  float band = clamp(floor(x) + smoothstep(1.0 - fw, 1.0, fract(x)), 0.0, bands - 1.0);
  float tq = band / (bands - 1.0);
  // backgrounds are painted gradients, characters are cel: behind the person mask the
  // quantisation relaxes towards the continuous tone (no torn bands across skies)
  float mBg = hasMask > 0.5 ? texture(mask, q).r : 1.0;
  float softBg = max(bgSoft * (1.0 - mBg), allSoft);
  tq = mix(tq, clamp(L * (1.0 + 0.5 / bands) - 0.25 / bands, 0.0, 1.0), softBg);
  vec3 tone = ramp4(tq, c0, c1, c2, c3);
  // keep some of the plate's hue so skin, clothes and props stay distinct
  vec3 hue = s / max(lum(s), 1e-3) * lum(tone);
  vec3 col = mix(tone, hue, hueKeep * smoothstep(0.08, 0.3, L));
  // halftone in the middle tones (screen at 30 degrees, output-pixel space)
  vec2 hp = rot(0.5236) * (uv * res) / cell;
  vec2 f = fract(hp) - 0.5;
  float mid = (tq > 0.2 && tq < 0.8) ? 1.0 : 0.0;
  mid = mix(mid, smoothstep(0.1, 0.3, tq) * (1.0 - smoothstep(0.7, 0.9, tq)) * 0.5, softBg);
  float shadeAmt = mix(clamp(1.0 - (x - floor(x)), 0.0, 1.0), 0.5, softBg);
  float r = sqrt(shadeAmt) * 0.46;
  float dotm = 1.0 - smoothstep(r - 0.06, r + 0.06, length(f));
  col = mix(col, col * 0.62, dotm * mid * 0.85);
  // ink
  float m = hasMask > 0.5 ? texture(mask, q).r : 1.0;
  float e = texture(edge, q).r * mix(bgLine, 1.0, m) * lineW;
  col = mix(col, inkCol, clamp(e, 0.0, 1.0));
  // drawn mouth ink on top of everything
  vec3 mm = mouthMasks(q);
  col = mix(col, inkCol, mm.y * 0.95);
  // sparkle: small bright points (stars, speculars) that the flattening removed
  if (sparkle > 0.0) {
    float hpv = lum(texture(plate, q).rgb) - lum(texture(blurB, q).rgb);
    col += vec3(1.0, 0.97, 0.92) * smoothstep(0.05, 0.22, hpv) * sparkle;
  }
  // paper grain
  col *= 1.0 - paper * (hash21(floor(uv * res / 2.0)) - 0.5) * 0.06;
  o = vec4(col * inside, 1.0);
}`;

const LIGHT = `
uniform sampler2D soft; uniform sampler2D edge; uniform sampler2D plate; uniform sampler2D mask;
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 neon;
uniform float cell; uniform float ang; uniform float gain; uniform float hueKeep; uniform float lineW;
uniform float scan; uniform float split; uniform float hasMask; uniform float bgDim; uniform float dotMin; uniform float t; uniform float dotMax; uniform float hiComp; uniform float exposure;
${PLATE_UV}
vec3 skinAt(vec2 q){ return texture(soft, q).rgb; }
${MOUTH}
vec3 samplePlate(vec2 q){ return texture(soft, q).rgb; }
void main(){
  vec2 px = uv * res;
  mat2 R = rot(ang);
  vec2 hp = R * px / cell;
  vec2 g = floor(hp) + 0.5;
  vec2 cpx = transpose(R) * (g * cell);
  vec2 cq = plateUV(cpx / res);
  vec3 s = samplePlate(cq);
  float m = hasMask > 0.5 ? texture(mask, cq).r : 1.0;
  float L = clamp(lum(s) * gain, 0.0, 1.0) * mix(bgDim, 1.0, m);
  L = L / (1.0 + L * hiComp) * (1.0 + hiComp);      // compress highlights so whites stay as dots
  float r = sqrt(max(L, dotMin)) * dotMax;
  float d = length(hp - g);
  float dotm = 1.0 - smoothstep(r - 0.07, r + 0.07, d);
  vec3 tone = ramp4(L, c0, c1, c2, c3);
  vec3 hue = s / max(lum(s), 1e-3) * L;
  vec3 col = mix(tone, hue * 1.1, hueKeep) * dotm * exposure;
  // neon contour, with optional RGB split
  vec2 q = plateUV(uv);
  float inside = inPlate(q);
  float er, eg, eb;
  vec2 so = vec2(split / res.x, 0.0);
  er = texture(edge, q + so).r; eg = texture(edge, q).r; eb = texture(edge, q - so).r;
  float mm = hasMask > 0.5 ? texture(mask, q).r : 1.0;
  vec3 e = vec3(er, eg, eb) * mix(0.35, 1.0, mm) * lineW;
  col += neon * e;
  // drawn mouth as neon
  vec3 mk = mouthMasks(q);
  col += neon * mk.y * 1.2 + neon * 0.25 * mk.x;
  // scanlines (2011 footage)
  float sl = 0.5 + 0.5 * sin(px.y * PI / 2.0);
  col *= mix(1.0, 0.55 + 0.45 * sl, scan);
  o = vec4(col * inside, 1.0);
}`;

export class Materials {
  constructor(gl) {
    this.g = gl;
    this.pK = gl.program('kuwahara', KUWAHARA);
    this.pB = gl.program('blur', BLUR);
    this.pX = gl.program('xdog', XDOG);
    this.pInk = gl.program('ink', INK);
    this.pLight = gl.program('light', LIGHT);
    this.work = new Map();
    this.plateTex = gl.texture(1280, 720);
    this.maskTex = gl.texture(640, 360);
    this.blank = gl.texture(4, 4);
  }

  // One set of analysis targets per slot (a plate drawn with a material), kept in a small
  // LRU so split screens and ghosts don't evict each other.
  _targets(w, h, slot) {
    const key = slot + '@' + w + 'x' + h;
    if (this.work.has(key)) {
      const T = this.work.get(key);
      this.work.delete(key); this.work.set(key, T);   // most recently used last
      return T;
    }
    let T;
    const sizeKey = '@' + w + 'x' + h;
    if (this.work.size >= 6) {
      const old = [...this.work.keys()].find((k) => k.endsWith(sizeKey));
      if (old) { T = this.work.get(old); this.work.delete(old); T.lastImg = null; }
    }
    if (!T) {
      const g = this.g;
      T = { src: g.texture(w, h), flat: g.target(w, h), t1: g.target(w, h), g1: g.target(w, h), g2: g.target(w, h), edge: g.target(w, h), soft: g.target(w, h) };
    }
    this.work.set(key, T);
    return T;
  }

  // Analyse the current plate image: flatten (INK) or soften (LIGHT), plus XDoG edges.
  // Drawings are held on twos, so an unchanged image in the same slot reuses its analysis.
  analyse(img, mat, opt = {}, slot = 'main') {
    const g = this.g;
    const w = img.width, h = img.height, T = this._targets(w, h, slot + ':' + mat);
    const sig = mat + JSON.stringify(opt);
    if (T.lastImg === img && T.lastSig === sig) return T;
    T.lastImg = img; T.lastSig = sig;
    g.upload(T.src, img);
    this.plateTex = T.src;
    const s1 = opt.edgeSigma ?? 1.0;
    g.pass(this.pB, T.t1, { src: this.plateTex }, { dir: [1, 0], sigma: s1 });
    g.pass(this.pB, T.g1, { src: T.t1 }, { dir: [0, 1], sigma: s1 });
    g.pass(this.pB, T.t1, { src: this.plateTex }, { dir: [1, 0], sigma: s1 * 1.6 });
    g.pass(this.pB, T.g2, { src: T.t1 }, { dir: [0, 1], sigma: s1 * 1.6 });
    g.pass(this.pX, T.edge, { g1: T.g1, g2: T.g2 }, { tau: opt.tau ?? 0.985, eps: opt.eps ?? -0.004, phi: opt.phi ?? 180 });
    if (mat === 'ink') {
      g.pass(this.pK, T.flat, { src: this.plateTex }, { radius: opt.radius ?? 4 });
    } else {
      const ss = opt.softSigma ?? 1.6;
      g.pass(this.pB, T.t1, { src: this.plateTex }, { dir: [1, 0], sigma: ss });
      g.pass(this.pB, T.soft, { src: T.t1 }, { dir: [0, 1], sigma: ss });
    }
    return T;
  }

  setMask(img) { if (img) { this.g.upload(this.maskTex, img); return true; } return false; }

  _mouthUniforms(m) {
    return {
      mouth: m ? [m.x, m.y, m.a, m.w] : [0, 0, 0, 0],
      mouthShape: m ? [m.open, m.wide, m.round] : [0, 0, 0],
      mouthInk: hex(m?.ink || '#1a0f24'), mouthIn: hex(m?.inner || '#4a1426'), mouthTongue: hex(m?.tongue || '#c8566b'),
      skinTone: m?.skin || [0.93, 0.78, 0.68],
    };
  }

  ink(out, T, o) {
    const p = o.palette;
    this.g.pass(this.pInk, out, { flat_: T.flat, edge: T.edge, plate: T.src, mask: o.hasMask ? this.maskTex : this.blank, blurB: T.g2 }, {
      sparkle: o.sparkle ?? 0,
      c0: hex(p[0]), c1: hex(p[1]), c2: hex(p[2]), c3: hex(p[3]), inkCol: hex(o.ink || p[0]),
      bands: o.bands ?? 4, hueKeep: o.hueKeep ?? 0.35, cell: o.cell ?? 6, lineW: o.lineW ?? 1.0, bgLine: o.bgLine ?? 0.45,
      exposure: o.exposure ?? 1.0, gamma: o.gamma ?? 1.0, hasMask: o.hasMask ? 1 : 0, paper: o.paper ?? 1, bgSoft: o.bgSoft ?? 0.8, allSoft: o.allSoft ?? 0,
      xf: o.xf || [1, 0.5, 0.5, 0], shake: o.shake || [0, 0], plateAspect: o.plateAspect || 16 / 9,
      ...this._mouthUniforms(o.mouth),
    });
  }

  light(out, T, o) {
    const p = o.palette;
    this.g.pass(this.pLight, out, { soft: T.soft, edge: T.edge, plate: T.src, mask: o.hasMask ? this.maskTex : this.blank }, {
      c0: hex(p[0]), c1: hex(p[1]), c2: hex(p[2]), c3: hex(p[3]), neon: o.neon || [1, 1, 1],
      cell: o.cell ?? 7, ang: o.ang ?? 0.5236, gain: o.gain ?? 1.0, hueKeep: o.hueKeep ?? 0.45, lineW: o.lineW ?? 0.75,
      scan: o.scan ?? 0, split: o.split ?? 0, hasMask: o.hasMask ? 1 : 0, bgDim: o.bgDim ?? 1.0, dotMin: o.dotMin ?? 0.0, t: o.t || 0, dotMax: o.dotMax ?? 0.5, hiComp: o.hiComp ?? 1.2, exposure: o.exposure ?? 0.95,
      xf: o.xf || [1, 0.5, 0.5, 0], shake: o.shake || [0, 0], plateAspect: o.plateAspect || 16 / 9,
      ...this._mouthUniforms(o.mouth),
    });
  }
}
