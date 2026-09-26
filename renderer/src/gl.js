// Minimal WebGL2 toolkit: programs with cached uniform setters, float textures,
// framebuffers and a fullscreen-triangle draw. Everything the renderer draws goes
// through `pass()`.

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

export const GLSL_COMMON = `
precision highp float;
uniform vec2 res;
#define PI 3.14159265359
#define TAU 6.28318530718
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 ramp4(float x, vec3 a, vec3 b, vec3 c, vec3 d){
  x = clamp(x, 0.0, 1.0);
  return x < 0.3333 ? mix(a, b, x / 0.3333) : x < 0.6667 ? mix(b, c, (x - 0.3333) / 0.3333) : mix(c, d, (x - 0.6667) / 0.3333);
}
`;

export class GL {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.progs = new Map();
    this.vs = this._shader(gl.VERTEX_SHADER, VS);
  }

  _shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
      throw new Error('shader compile failed: ' + log + '\n' + numbered);
    }
    return s;
  }

  program(name, fs) {
    if (this.progs.has(name)) return this.progs.get(name);
    const gl = this.gl;
    const src = `#version 300 es\n${GLSL_COMMON}\nin vec2 uv;\nout vec4 o;\n${fs}`;
    const p = gl.createProgram();
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link failed: ' + gl.getProgramInfoLog(p));
    const prog = { p, loc: new Map(), name };
    this.progs.set(name, prog);
    return prog;
  }

  texture(w, h, opt = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const fmt = opt.float ? [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT] : [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt[0], w, h, 0, fmt[1], fmt[2], null);
    const f = opt.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    const wrap = opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return { t, w, h };
  }

  target(w, h, opt = {}) {
    const gl = this.gl, tex = this.texture(w, h, { float: true, ...opt });
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex.t, 0);
    return { ...tex, fbo: f };
  }

  // Upload an image / canvas / ImageBitmap into an existing texture (resizing it).
  upload(tex, src, flip = true) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex.t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    tex.w = src.width; tex.h = src.height;
    return tex;
  }

  // Run a fragment program over `out` (a target, or null for the canvas).
  pass(prog, out, tex = {}, uni = {}, blend = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    const w = out ? out.w : gl.canvas.width, h = out ? out.h : gl.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    let unit = 0;
    for (const [name, t] of Object.entries(tex)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t ? t.t : null);
      gl.uniform1i(this._loc(prog, name), unit);
      unit++;
    }
    this._set(prog, 'res', [w, h]);
    for (const [name, v] of Object.entries(uni)) this._set(prog, name, v);
    if (blend === 'add') { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
    else if (blend === 'alpha') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    else gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  _loc(prog, name) {
    if (!prog.loc.has(name)) prog.loc.set(name, this.gl.getUniformLocation(prog.p, name));
    return prog.loc.get(name);
  }

  _set(prog, name, v) {
    const gl = this.gl, l = this._loc(prog, name);
    if (l === null) return;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (typeof v === 'boolean') gl.uniform1i(l, v ? 1 : 0);
    else if (v.length === 2) gl.uniform2fv(l, v);
    else if (v.length === 3) gl.uniform3fv(l, v);
    else if (v.length === 4) gl.uniform4fv(l, v);
    else if (v.length === 16) gl.uniformMatrix4fv(l, false, v);
    else gl.uniform1fv(l, v);
  }
}
