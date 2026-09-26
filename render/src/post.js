// Post: bloom (multi-scale), film halation, grade, chromatic aberration, vignette, grain, flash/impact.
import * as THREE from 'three';
import { W, H } from './core.js';

const BRIGHT_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src; uniform float thresh, knee;
void main(){
  vec3 c = texture(src, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float s = clamp((l - thresh + knee) / (2.0 * knee), 0.0, 1.0);
  float w = (l > thresh + knee) ? 1.0 : s * s;
  o = vec4(c * w, 1.0);
}`;
// 13-tap downsample (CoD / Jimenez)
const DOWN_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src; uniform vec2 px;
void main(){
  vec3 a = texture(src, vUv + px*vec2(-2, 2)).rgb, b = texture(src, vUv + px*vec2(0, 2)).rgb, c = texture(src, vUv + px*vec2(2, 2)).rgb;
  vec3 d = texture(src, vUv + px*vec2(-2, 0)).rgb, e = texture(src, vUv).rgb, f = texture(src, vUv + px*vec2(2, 0)).rgb;
  vec3 g = texture(src, vUv + px*vec2(-2,-2)).rgb, h = texture(src, vUv + px*vec2(0,-2)).rgb, i = texture(src, vUv + px*vec2(2,-2)).rgb;
  vec3 j = texture(src, vUv + px*vec2(-1, 1)).rgb, k = texture(src, vUv + px*vec2(1, 1)).rgb;
  vec3 l = texture(src, vUv + px*vec2(-1,-1)).rgb, m = texture(src, vUv + px*vec2(1,-1)).rgb;
  vec3 r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  o = vec4(r, 1.0);
}`;
const UP_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src; uniform sampler2D base; uniform vec2 px; uniform float mixw;
void main(){
  vec3 s = vec3(0.0);
  s += texture(src, vUv + px*vec2(-1, 1)).rgb * 1.0; s += texture(src, vUv + px*vec2(0, 1)).rgb * 2.0; s += texture(src, vUv + px*vec2(1, 1)).rgb * 1.0;
  s += texture(src, vUv + px*vec2(-1, 0)).rgb * 2.0; s += texture(src, vUv).rgb * 4.0;               s += texture(src, vUv + px*vec2(1, 0)).rgb * 2.0;
  s += texture(src, vUv + px*vec2(-1,-1)).rgb * 1.0; s += texture(src, vUv + px*vec2(0,-1)).rgb * 2.0; s += texture(src, vUv + px*vec2(1,-1)).rgb * 1.0;
  s /= 16.0;
  o = vec4(texture(base, vUv).rgb + s * mixw, 1.0);
}`;
const FINAL_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src, bloom, hal;
uniform float bloomAmt, halAmt, exposure, sat, contrast, vig, ca, grain, time, flash, impact, weaveX, weaveY, grainSize, fade;
uniform vec3 lift, gamma, gain, flashCol, halTint, fadeCol;
uniform vec2 res;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv + vec2(weaveX, weaveY) / res;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec3 c;
  if (ca > 0.0) {
    vec2 off = d * ca * r2 * 4.0 / res * 1000.0;
    c = vec3(texture(src, uv - off).r, texture(src, uv).g, texture(src, uv + off).b);
  } else c = texture(src, uv).rgb;
  vec3 b = texture(bloom, uv).rgb;
  vec3 hl = texture(hal, uv).rgb;
  c += b * bloomAmt;
  c += dot(hl, vec3(0.33)) * halTint * halAmt;
  c *= exposure;
  // soft shoulder so glows roll off instead of clipping
  c = mix(c, aces(c * 1.05) * 1.02, 0.35);
  // lift / gamma / gain
  c = c * gain + lift * (1.0 - c);
  c = pow(max(c, 0.0), 1.0 / gamma);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  c *= 1.0 - vig * smoothstep(0.1, 0.75, r2 * 1.6);
  c = mix(c, flashCol, flash);
  if (impact > 0.0) { float li = dot(c, vec3(0.3,0.55,0.15)); vec3 inv = vec3(step(0.42, 1.0 - li)); c = mix(c, inv * vec3(1.0, 0.97, 0.92), impact); }
  c = mix(c, fadeCol, fade);
  // film grain (luma weighted, blocky at grainSize px)
  vec2 gp = floor(gl_FragCoord.xy / grainSize);
  float n = h12(gp + fract(time * 13.37) * 173.0) + h12(gp * 1.7 + fract(time * 7.1) * 91.0) - 1.0;
  float lw = 1.0 - abs(l - 0.45) * 1.1;
  c += n * grain * max(lw, 0.25);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(core) {
    this.core = core;
    this.mBright = core.material('post_bright', BRIGHT_FS, { src: null, thresh: 0.75, knee: 0.25 });
    this.mDown = core.material('post_down', DOWN_FS, { src: null, px: new THREE.Vector2() });
    this.mUp = core.material('post_up', UP_FS, { src: null, base: null, px: new THREE.Vector2(), mixw: 1 });
    this.mFinal = core.material('post_final', FINAL_FS, {
      src: null, bloom: null, hal: null, bloomAmt: 0.6, halAmt: 0.25, exposure: 1, sat: 1, contrast: 1, vig: 0.25, ca: 0,
      grain: 0.035, time: 0, flash: 0, impact: 0, weaveX: 0, weaveY: 0, grainSize: 1.5, fade: 0,
      lift: new THREE.Vector3(0, 0, 0), gamma: new THREE.Vector3(1, 1, 1), gain: new THREE.Vector3(1, 1, 1),
      flashCol: new THREE.Vector3(1, 1, 1), halTint: new THREE.Vector3(1.0, 0.35, 0.18), fadeCol: new THREE.Vector3(0, 0, 0),
      res: new THREE.Vector2(W, H) });
  }

  // p: grade params for this frame
  run(src, p, time) {
    const c = this.core;
    const levels = [2, 4, 8, 16, 32, 64];
    const bright = c.rt('bright', W / 2, H / 2);
    c.pass(this.mBright, bright, { src: src.texture, thresh: p.thresh ?? 0.72, knee: p.knee ?? 0.3 });
    let prev = bright;
    const downs = [];
    for (let i = 1; i < levels.length; i++) {
      const w = W / levels[i], h = H / levels[i];
      const t = c.rt('down' + i, w, h);
      c.pass(this.mDown, t, { src: prev.texture, px: new THREE.Vector2(1 / (W / levels[i - 1]), 1 / (H / levels[i - 1])) });
      downs.push(t); prev = t;
    }
    // upsample chain
    let up = downs[downs.length - 1];
    for (let i = downs.length - 2; i >= 0; i--) {
      const t = c.rt('up' + i, W / levels[i + 1], H / levels[i + 1]);
      c.pass(this.mUp, t, { src: up.texture, base: downs[i].texture, px: new THREE.Vector2(1 / (W / levels[i + 2]), 1 / (H / levels[i + 2])), mixw: 1 });
      up = t;
    }
    const U = (v, d) => new THREE.Vector3(...(v || d));
    c.pass(this.mFinal, null, {
      src: src.texture, bloom: up.texture, hal: downs[2].texture,
      bloomAmt: p.bloom ?? 0.55, halAmt: p.halation ?? 0.25, exposure: p.exposure ?? 1, sat: p.sat ?? 1, contrast: p.contrast ?? 1,
      vig: p.vig ?? 0.28, ca: p.ca ?? 0.0, grain: p.grain ?? 0.035, time, flash: p.flash ?? 0, impact: p.impact ?? 0,
      weaveX: p.weaveX ?? 0, weaveY: p.weaveY ?? 0, grainSize: p.grainSize ?? 1.5, fade: p.fade ?? 0,
      lift: U(p.lift, [0, 0, 0]), gamma: U(p.gamma, [1, 1, 1]), gain: U(p.gain, [1, 1, 1]),
      flashCol: U(p.flashCol, [1, 1, 1]), halTint: U(p.halTint, [1.0, 0.35, 0.18]), fadeCol: U(p.fadeCol, [0, 0, 0]),
    });
  }
}
