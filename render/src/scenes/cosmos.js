// Cosmic set pieces: LGM-2 (red dwarf + transit-beacon shades + planet), the galaxy of lighthouses, the orrery,
// and the Pale Blue Dot.
import * as THREE from 'three';
import { W, H } from '../core.js';
import { clamp, lerp, hash, rng, easeInOutCubic, easeOutCubic, smooth } from '../lib/util.js';

// ------------------------------------------------------------------------------------------------ LGM-2
const STAR_VS = /* glsl */`out vec3 vN; out vec3 vP; out vec3 vV; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vP = position; vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
const STAR_FS = /* glsl */`
precision highp float; in vec3 vN; in vec3 vP; in vec3 vV; out vec4 o;
uniform float time, bright; uniform vec3 hot, cool;
float h13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){
  float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
  float limb = pow(mu, 0.55);
  float g = vn(vP * 9.0 + time * 0.25) * 0.6 + vn(vP * 23.0 - time * 0.4) * 0.4;
  float cells = smoothstep(0.35, 0.75, g);
  vec3 c = mix(cool, hot, cells * 0.55 + limb * 0.45);
  c *= (0.25 + 0.75 * limb) * bright;
  o = vec4(c, 1.0);
}`;

export class Beacon {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 500);
    this.starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, glslVersion: THREE.GLSL3,
      uniforms: { time: { value: 0 }, bright: { value: 1 }, hot: { value: new THREE.Color('#ffb46e') }, cool: { value: new THREE.Color('#b8321a') } } });
    this.star = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.starMat);
    this.scene.add(this.star);
    // shades: thin dark panels on an inclined ring
    this.ring = new THREE.Group(); this.scene.add(this.ring);
    this.ring.rotation.set(0.18, 0, 0.12);
    this.N = 8;
    this.shades = [];
    const shadeMat = new THREE.MeshBasicMaterial({ color: '#07060c' });
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#4a1a0e' });
    for (let i = 0; i < this.N; i++) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 0.01), shadeMat);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.235, 2.32, 0.004), edgeMat); e.position.z = -0.008;
      g.add(e); g.add(p);
      this.ring.add(g); this.shades.push(g);
    }
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), new THREE.MeshBasicMaterial({ color: '#05040a' }));
    this.scene.add(this.planet);
  }
  // o: {t, camPos, look, fov, phase (0..1 of the ring), R (ring radius), planetU (0..1 across the disk, or null), bright}
  render(core, target, o) {
    this.starMat.uniforms.time.value = o.t;
    this.starMat.uniforms.bright.value = o.bright ?? 1;
    const R = o.R || 1.9;
    this.shades.forEach((g, i) => {
      const a = (i / this.N + (o.phase || 0)) * Math.PI * 2;
      g.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      g.lookAt(0, 0, 0);
      g.visible = o.shades !== false;
    });
    if (o.planetU !== null && o.planetU !== undefined) { this.planet.visible = true; this.planet.position.set(lerp(-1.6, 1.6, o.planetU), (o.planetY || -0.15), 2.4); this.planet.scale.setScalar(o.planetR || 1); }
    else this.planet.visible = false;
    this.cam.fov = o.fov || 30; this.cam.updateProjectionMatrix();
    this.cam.position.set(...(o.camPos || [0, 0, 7])); this.cam.lookAt(new THREE.Vector3(...(o.look || [0, 0, 0])));
    core.renderer.setRenderTarget(target); core.renderer.clearDepth(); core.renderer.render(this.scene, this.cam);
    // screen position/size of the star for glow drawing
    const c = new THREE.Vector3(0, 0, 0).project(this.cam), e = new THREE.Vector3(1, 0, 0).applyMatrix4(new THREE.Matrix4()).project(this.cam);
    const sx = (c.x * 0.5 + 0.5) * W, sy = (1 - (c.y * 0.5 + 0.5)) * H;
    const d = this.cam.position.length();
    const rpx = (1 / Math.tan((this.cam.fov * Math.PI / 180) / 2) / d) * H / 2;
    return { x: sx, y: sy, r: rpx };
  }
}

// ------------------------------------------------------------------------------------------------ galaxy
const GAL_VS = /* glsl */`
attribute float size; attribute vec3 col; attribute float bt; attribute float bph;
uniform float time, beaconT, scale, beat; varying vec3 vCol; varying float vB;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float on = step(bt, beaconT);
  float blink = 0.55 + 0.45 * sin(time * 6.2832 * 0.9 + bph * 6.2832);
  vB = on * blink;
  vCol = mix(col, vec3(1.0, 0.8, 0.38) * 2.2, on);
  gl_PointSize = size * scale / -mv.z * (1.0 + on * (1.6 + 1.2 * beat));
  gl_Position = projectionMatrix * mv;
}`;
const GAL_FS = /* glsl */`
precision highp float; varying vec3 vCol; varying float vB;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = exp(-r * r * 22.0) + 0.25 * exp(-r * r * 5.0); gl_FragColor = vec4(vCol * a * (0.45 + vB), 1.0); }`;

export class Galaxy {
  constructor(n = 160000) {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 5000);
    const R = rng(77);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), bt = new Float32Array(n), bph = new Float32Array(n);
    const arms = 4;
    for (let i = 0; i < n; i++) {
      let x, y, z, c;
      const u = R();
      if (u < 0.18) { // bulge
        const r = Math.pow(R(), 1.6) * 60, th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1);
        x = r * Math.sin(ph) * Math.cos(th); z = r * Math.sin(ph) * Math.sin(th); y = r * Math.cos(ph) * 0.45;
        c = [1.0, 0.82 + R() * 0.1, 0.55 + R() * 0.15];
      } else {
        const arm = Math.floor(R() * arms);
        const r = 30 + Math.pow(R(), 0.8) * 420;
        const th = arm * (Math.PI * 2 / arms) + Math.log(r / 30) * 2.2 + (R() - 0.5) * (0.55 + 60 / r);
        x = Math.cos(th) * r + (R() - 0.5) * 18; z = Math.sin(th) * r + (R() - 0.5) * 18; y = (R() - 0.5) * 10 * (1 - r / 500);
        const hot = R();
        c = hot < 0.12 ? [1.0, 0.55, 0.75] : (hot < 0.55 ? [0.62, 0.74, 1.0] : [0.92, 0.94, 1.0]);
      }
      pos.set([x, y, z], i * 3); col.set(c.map((v) => v * (0.35 + R() * 0.6)), i * 3);
      size[i] = 1.2 + Math.pow(R(), 6) * 7;
      // beacon activation: most stars never; a spreading set lights up from the outer arms inward and at random
      const d = Math.hypot(x, z);
      bt[i] = R() < 0.14 ? (R() * 0.85 + 0.15 * (1 - d / 460)) : 9;
      bph[i] = R();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('col', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('bt', new THREE.BufferAttribute(bt, 1));
    geo.setAttribute('bph', new THREE.BufferAttribute(bph, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: GAL_VS, fragmentShader: GAL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, beaconT: { value: -1 }, scale: { value: 900 }, beat: { value: 0 } } });
    this.points = new THREE.Points(geo, this.mat);
    this.scene.add(this.points);
    this.sun = new THREE.Vector3(260, 2, 40);   // where "we" are
  }
  // o: {t, camPos, look, fov, beaconT (0..1 fraction of beacons lit), beat, rot}
  render(core, target, o) {
    const u = this.mat.uniforms;
    u.time.value = o.t; u.beaconT.value = o.beaconT ?? -1; u.beat.value = o.beat || 0;
    this.points.rotation.y = o.rot || 0;
    this.cam.fov = o.fov || 45; this.cam.updateProjectionMatrix();
    this.cam.position.set(...o.camPos); this.cam.lookAt(new THREE.Vector3(...(o.look || [0, 0, 0])));
    core.renderer.setRenderTarget(target); core.renderer.clearDepth(); core.renderer.render(this.scene, this.cam);
    const s = this.sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.points.rotation.y).project(this.cam);
    return { sun: { x: (s.x * 0.5 + 0.5) * W, y: (1 - (s.y * 0.5 + 0.5)) * H, vis: s.z < 1 } };
  }
}

// ------------------------------------------------------------------------------------------------ orrery (2D)
export class Orrery {
  constructor(n = 520) {
    const R = rng(12);
    this.sys = [];
    const cols = 26;
    for (let i = 0; i < n; i++) {
      const np = 1 + Math.floor(Math.pow(R(), 1.3) * 6);
      const planets = [];
      let a = 0.3 + R() * 0.3;
      for (let k = 0; k < np; k++) { a *= 1.35 + R() * 0.6; planets.push({ a, ph: R() * 6.28, col: R() < 0.2 ? '#ff9a6a' : (R() < 0.5 ? '#8ecbff' : '#e8f0ff'), s: 1 + R() * 2 }); }
      this.sys.push({ gx: i % cols, gy: Math.floor(i / cols), planets, star: R() < 0.3 ? '#ffb070' : '#fff1c8', scale: 0.8 + R() * 0.4 });
    }
    this.cols = cols; this.rows = Math.ceil(n / cols);
  }
  // zoom: pixels per grid cell; focus: [gx, gy] cell at screen centre
  draw(g, t, { zoom = 70, focus = [13, 10], alpha = 1, highlight = -1, speed = 1 } = {}) {
    g.save(); g.globalAlpha = alpha;
    const cx = W / 2 - focus[0] * zoom, cy = H / 2 - focus[1] * zoom;
    for (let i = 0; i < this.sys.length; i++) {
      const S = this.sys[i];
      const x = cx + S.gx * zoom + (S.gy % 2) * zoom * 0.5, y = cy + S.gy * zoom * 0.9;
      if (x < -zoom * 3 || x > W + zoom * 3 || y < -zoom * 3 || y > H + zoom * 3) continue;
      const sc = zoom * 0.11 * S.scale;
      for (const p of S.planets) {
        const r = p.a * sc;
        if (r > 1.2) { g.strokeStyle = i === highlight ? 'rgba(255,207,90,0.55)' : 'rgba(142,203,255,0.22)'; g.lineWidth = zoom > 200 ? 1.5 : 0.8; g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, 7); g.stroke(); }
        const w = speed * 1.2 / Math.pow(p.a, 1.5);
        const ang = p.ph + t * w;
        g.fillStyle = p.col;
        const ps = Math.max(1, p.s * zoom / 70);
        g.beginPath(); g.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.45, ps, 0, 7); g.fill();
      }
      g.fillStyle = S.star; g.beginPath(); g.arc(x, y, Math.max(1.2, zoom * 0.035), 0, 7); g.fill();
    }
    g.restore();
  }
}

// ------------------------------------------------------------------------------------------------ pale blue dot (2D)
export function paleBlueDot(g, t, { dot = [1180, 640], alpha = 1, zoom = 1 } = {}) {
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = '#030305'; g.fillRect(0, 0, W, H);
  // scattered sunlight in the camera optics: broad soft diagonal bands of warm and cool light
  const bands = [[-0.05, '96,62,44', 260, 0.55], [0.22, '150,98,64', 150, 0.6], [0.43, '118,120,150', 210, 0.45], [0.62, '170,112,74', 120, 0.5], [0.86, '90,70,60', 300, 0.4]];
  g.translate(W / 2, H / 2); g.rotate(-0.42); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  for (const [u, c, wd, a] of bands) {
    const x = u * W * 1.25;
    const gr = g.createLinearGradient(x - wd, 0, x + wd, 0);
    gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.35, `rgba(${c},${a * 0.6})`); gr.addColorStop(0.5, `rgba(${c},${a})`);
    gr.addColorStop(0.65, `rgba(${c},${a * 0.6})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x - wd, -600, wd * 2, H + 1200);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const [dx, dy] = dot;
  const gr = g.createRadialGradient(dx, dy, 0, dx, dy, 6 * zoom);
  gr.addColorStop(0, 'rgba(200,230,255,1)'); gr.addColorStop(0.45, 'rgba(120,180,255,0.75)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(dx, dy, 6 * zoom, 0, 7); g.fill();
  g.restore();
}
