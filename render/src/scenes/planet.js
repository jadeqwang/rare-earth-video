// Cel-shaded planets (Earth and the other world): canvas-generated textures + a toon terminator shader.
import * as THREE from 'three';
import { W, H } from '../core.js';
import { rng, clamp, lerp } from '../lib/util.js';

const PL_VS = /* glsl */`
out vec2 vUv; out vec3 vN; out vec3 vV; out vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
const PL_FS = /* glsl */`
precision highp float;
in vec2 vUv; in vec3 vN; in vec3 vV; in vec3 vW; out vec4 o;
uniform sampler2D day, night, clouds;
uniform vec3 sunDir, rimCol, nightTint, termCol;
uniform float rimAmt, nightAmt, cloudShift, cloudAmt, cel, lightsAmt, time, pulse, dayGain;
void main(){
  vec3 n = normalize(vN);
  float d = dot(n, normalize(sunDir));
  float lit = cel > 0.5 ? smoothstep(-0.02, 0.06, d) : smoothstep(-0.15, 0.25, d);
  float half_ = cel > 0.5 ? (d > 0.45 ? 1.0 : 0.82) : 1.0;
  vec3 dc = texture(day, vUv).rgb * half_ * dayGain;
  vec3 nc = texture(day, vUv).rgb * nightTint * nightAmt;
  vec3 lights = texture(night, vUv).rgb * lightsAmt * (1.0 - lit) * (1.0 + pulse);
  vec2 cuv = vec2(fract(vUv.x + cloudShift), vUv.y);
  float cl = texture(clouds, cuv).r * cloudAmt;
  vec3 c = mix(nc, dc, lit);
  c = mix(c, mix(vec3(0.08, 0.1, 0.2), vec3(0.97, 0.98, 1.0) * half_, lit), cl);
  c += lights * (1.0 - cl * 0.7);
  // terminator band
  float band = exp(-pow(d / 0.06, 2.0));
  c += termCol * band * 0.5 * (1.0 - cl * 0.5);
  // rim (atmosphere)
  float f = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4);
  c += rimCol * f * rimAmt * (0.25 + 0.75 * smoothstep(-0.3, 0.4, d));
  o = vec4(c, 1.0);
}`;
const ATM_FS = /* glsl */`
precision highp float;
in vec2 vUv; in vec3 vN; in vec3 vV; in vec3 vW; out vec4 o;
uniform vec3 rimCol, sunDir; uniform float amt;
void main(){
  vec3 n = normalize(vN);
  float f = pow(1.0 - abs(dot(n, normalize(vV))), 3.0);
  float s = smoothstep(-0.35, 0.5, dot(n, normalize(sunDir)));
  o = vec4(rimCol * f * amt * (0.2 + 0.8 * s), 1.0);
}`;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}

function valueNoiseCanvas(g, w, h, seed, scale, octaves, threshold, soft, color) {
  const R = rng(seed);
  const img = g.createImageData(w, h);
  const grids = [];
  for (let o = 0; o < octaves; o++) { const gw = Math.ceil(scale * 2 ** o) + 1, gh = Math.ceil(scale * 2 ** o / 2) + 1; const a = new Float32Array(gw * gh); for (let i = 0; i < a.length; i++) a[i] = R(); grids.push({ gw, gh, a }); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0, amp = 1, tot = 0;
    grids.forEach((G, o) => {
      const fx = (x / w) * (G.gw - 1), fy = (y / h) * (G.gh - 1);
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i0 = iy * G.gw + ix, x1 = (ix + 1) % G.gw === 0 ? iy * G.gw : i0 + 1;
      const a = G.a[i0], b = G.a[Math.min(G.a.length - 1, i0 + 1)], c = G.a[Math.min(G.a.length - 1, i0 + G.gw)], d = G.a[Math.min(G.a.length - 1, i0 + G.gw + 1)];
      v += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy); tot += amp; amp *= 0.5;
    });
    v /= tot;
    const lat = Math.abs(y / h - 0.5) * 2;
    const k = clamp((v - threshold) / soft) * (1 - 0.3 * lat);
    const i = (y * w + x) * 4;
    img.data[i] = color[0] * k; img.data[i + 1] = color[1] * k; img.data[i + 2] = color[2] * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

export async function makeEarthTextures(base = '') {
  const land = await (await fetch(base + 'assets/geo/ne_50m_land.geojson')).json();
  const places = await (await fetch(base + 'assets/geo/ne_50m_populated_places_simple.geojson')).json();
  const TW = 2048, TH = 1024;
  const P = (lon, lat) => [(lon + 180) / 360 * TW, (90 - lat) / 180 * TH];
  const landPath = (g) => {
    g.beginPath();
    for (const f of land.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const ring of poly) { ring.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }
    }
  };
  const day = canvasTex(TW, TH, (g) => {
    const oc = g.createLinearGradient(0, 0, 0, TH);
    oc.addColorStop(0, '#2c5fb0'); oc.addColorStop(0.5, '#1d4f9e'); oc.addColorStop(1, '#2c5fb0');
    g.fillStyle = oc; g.fillRect(0, 0, TW, TH);
    // shallow-water halo
    landPath(g); g.lineWidth = 7; g.strokeStyle = '#3f86cf'; g.stroke();
    landPath(g);
    g.save(); g.clip();
    const lg = g.createLinearGradient(0, 0, 0, TH);
    lg.addColorStop(0, '#f2f6ff'); lg.addColorStop(0.1, '#e6eef8'); lg.addColorStop(0.16, '#6f8a5c'); lg.addColorStop(0.32, '#6b8a4f');
    lg.addColorStop(0.4, '#c9ad72'); lg.addColorStop(0.47, '#6f944f'); lg.addColorStop(0.55, '#5f8a48'); lg.addColorStop(0.62, '#c6a56c');
    lg.addColorStop(0.72, '#7a9458'); lg.addColorStop(0.86, '#e8eef8'); lg.addColorStop(1, '#f2f6ff');
    g.fillStyle = lg; g.fillRect(0, 0, TW, TH);
    g.restore();
    // mottling: soft translucent blobs drawn unclipped on a scratch canvas, then masked to land in one composite
    // (clipping thousands of fills against the complex land path is extremely slow in software rendering)
    const mc = document.createElement('canvas'); mc.width = TW; mc.height = TH;
    const mg = mc.getContext('2d');
    const RM = rng(17);
    for (let i = 0; i < 2600; i++) {
      const x = RM() * TW, y = TH * (0.12 + RM() * 0.76), r = 6 + Math.pow(RM(), 2) * 60;
      const dark = RM() < 0.55;
      mg.fillStyle = dark ? `rgba(40,52,30,${0.08 + RM() * 0.14})` : `rgba(214,190,140,${0.06 + RM() * 0.12})`;
      mg.beginPath(); mg.ellipse(x, y, r * (1 + RM()), r, RM() * 3, 0, Math.PI * 2); mg.fill();
    }
    const lc = document.createElement('canvas'); lc.width = TW; lc.height = TH;
    const lgc = lc.getContext('2d');
    landPath(lgc); lgc.fillStyle = '#fff'; lgc.fill();
    lgc.globalCompositeOperation = 'source-in'; lgc.drawImage(mc, 0, 0);
    g.drawImage(lc, 0, 0);
    landPath(g); g.lineWidth = 1.2; g.strokeStyle = 'rgba(20,30,60,0.55)'; g.stroke();
  });
  const night = canvasTex(TW, TH, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
    const R = rng(3);
    for (const f of places.features) {
      const p = f.properties; const pop = Math.max(p.pop_max || 1e4, 1e4);
      const n = Math.floor(Math.log10(pop) * Math.log10(pop) * 3.2);
      const spread = 2 + Math.log10(pop) * 1.7;
      const [cx, cy] = P(p.longitude, p.latitude);
      for (let i = 0; i < n; i++) {
        const r = Math.abs((R() + R() + R() - 1.5)) * spread * 2.2, a = R() * Math.PI * 2;
        const b = 0.35 + R() * 0.65;
        g.fillStyle = `rgba(255,${190 + (R() * 50) | 0},${110 + (R() * 60) | 0},${b})`;
        g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.3, 1.3);
      }
    }
  });
  const clouds = canvasTex(1024, 512, (g, w, h) => valueNoiseCanvas(g, w, h, 7, 6, 5, 0.58, 0.1, [255, 255, 255]));
  return { day, night, clouds };
}

export async function makeOtherTextures() {
  // tidally locked "eyeball" world: substellar ocean eye (u=0.5), ice and lavender ice-fields elsewhere,
  // a spiral storm over the eye, and a ring of city light along the terminator (u=0.25 / 0.75)
  const TW = 2048, TH = 1024;
  const R = rng(21);
  const day = canvasTex(TW, TH, (g) => {
    const bg = g.createLinearGradient(0, 0, TW, 0);
    bg.addColorStop(0, '#e9e4f2'); bg.addColorStop(0.5, '#d9d2ea'); bg.addColorStop(1, '#e9e4f2');
    g.fillStyle = bg; g.fillRect(0, 0, TW, TH);
    // ice cracks / ridges
    g.strokeStyle = 'rgba(150,140,190,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 160; i++) { g.beginPath(); let x = R() * TW, y = R() * TH; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 120; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    // the ocean eye
    const cx = TW * 0.5, cy = TH * 0.5;
    const eg = g.createRadialGradient(cx, cy, 0, cx, cy, 470);
    eg.addColorStop(0, '#0e3f6e'); eg.addColorStop(0.55, '#15558a'); eg.addColorStop(0.8, '#2f79a8'); eg.addColorStop(0.9, '#9ec7df'); eg.addColorStop(1, 'rgba(217,210,234,0)');
    g.fillStyle = eg; g.beginPath(); g.ellipse(cx, cy, 520, 470, 0, 0, Math.PI * 2); g.fill();
    // land scraps in the eye
    for (let i = 0; i < 5; i++) { const a = R() * 6.28, r = 200 + R() * 220; g.fillStyle = `rgba(${120 + R() * 40},${95 + R() * 30},${80 + R() * 20},0.9)`; g.beginPath(); g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, 7); g.fill(); }
  });
  const night = canvasTex(TW, TH, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 30000; i++) {
      const lat = (R() - 0.5) * 168;
      const side = R() < 0.5 ? 0.25 : 0.75;
      const lon = (side + (R() + R() + R() - 1.5) * 0.03) * 360 - 180;
      const x = (lon + 180) / 360 * TW, y = (90 - lat) / 180 * TH;
      g.fillStyle = `rgba(255,${170 + (R() * 70) | 0},${90 + (R() * 70) | 0},${0.3 + R() * 0.7})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
  });
  const clouds = canvasTex(1024, 512, (g, w, h) => {
    valueNoiseCanvas(g, w, h, 33, 7, 5, 0.6, 0.12, [255, 255, 255]);
    // a loose cyclone over the substellar point: many short soft strokes along a log spiral
    const cx = w * 0.5, cy = h * 0.5;
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const arm = Math.floor(R() * 3), k = R() * 70;
      const a = arm * 2.1 + k * 0.08 + (R() - 0.5) * 0.35, r = 10 + k * 2.3 + (R() - 0.5) * 14;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.9;
      g.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.3})`; g.lineWidth = 3 + R() * 7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + 1.4) * (8 + R() * 16), y + Math.sin(a + 1.4) * (8 + R() * 16)); g.stroke();
    }
  });
  return { day, night, clouds };
}

export class Planet {
  constructor(tex, o = {}) {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
    this.mat = new THREE.ShaderMaterial({ vertexShader: PL_VS, fragmentShader: PL_FS, glslVersion: THREE.GLSL3,
      uniforms: { day: { value: tex.day }, night: { value: tex.night }, clouds: { value: tex.clouds }, sunDir: { value: new THREE.Vector3(1, 0.2, 0.4) },
        rimCol: { value: new THREE.Color(o.rim || '#7fb8ff') }, nightTint: { value: new THREE.Color(o.nightTint || '#16204a') }, termCol: { value: new THREE.Color(o.term || '#ff9a5a') },
        rimAmt: { value: o.rimAmt ?? 0.7 }, nightAmt: { value: 0.5 }, cloudShift: { value: 0 }, cloudAmt: { value: o.cloudAmt ?? 0.6 }, cel: { value: 1 },
        lightsAmt: { value: o.lightsAmt ?? 1.6 }, time: { value: 0 }, pulse: { value: 0 }, dayGain: { value: 1 } } });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), this.mat);
    this.scene.add(this.mesh);
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), new THREE.ShaderMaterial({ vertexShader: PL_VS, fragmentShader: ATM_FS, glslVersion: THREE.GLSL3,
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { rimCol: { value: new THREE.Color(o.rim || '#7fb8ff') }, sunDir: this.mat.uniforms.sunDir, amt: { value: o.atmAmt ?? 1.3 } } }));
    this.scene.add(this.atm);
  }
  // o: {pos:[x,y,z] camera, look, fov, rotY, tilt, sun:[x,y,z], cloud, lights, pulse}
  render(core, target, o) {
    const u = this.mat.uniforms;
    if (o.sun) u.sunDir.value.set(...o.sun).normalize();
    u.cloudShift.value = o.cloud ?? 0; u.pulse.value = o.pulse ?? 0;
    if (o.lights !== undefined) u.lightsAmt.value = o.lights;
    if (o.dayGain !== undefined) u.dayGain.value = o.dayGain;
    this.mesh.rotation.set(o.tilt || 0.41, o.rotY || 0, 0);
    this.mesh.position.set(...(o.at || [0, 0, 0])); this.atm.position.copy(this.mesh.position);
    this.mesh.scale.setScalar(o.scale || 1); this.atm.scale.setScalar(o.scale || 1);
    this.cam.fov = o.fov || 30; this.cam.updateProjectionMatrix();
    this.cam.position.set(...o.pos); this.cam.lookAt(new THREE.Vector3(...(o.look || [0, 0, 0])));
    const r = core.renderer; r.setRenderTarget(target); r.clearDepth(); r.render(this.scene, this.cam);
  }
  // screen position of a surface point (lat/lon degrees) using the last render's transforms; face > 0 when it faces the camera
  project(lat, lon, alt = 1.0) {
    const th = (90 - lat) * Math.PI / 180, ph = (lon + 180) * Math.PI / 180;
    const p = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(alt);
    this.mesh.updateMatrixWorld();
    const w = p.clone().applyMatrix4(this.mesh.matrixWorld);
    const n = w.clone().sub(this.mesh.position).normalize();
    const face = n.dot(this.cam.position.clone().sub(w).normalize());
    const lit = n.dot(this.mat.uniforms.sunDir.value);
    const q = w.clone().project(this.cam);
    return { x: (q.x * 0.5 + 0.5) * W, y: (1 - (q.y * 0.5 + 0.5)) * H, face, lit };
  }
}
