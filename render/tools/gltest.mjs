import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(`<canvas id=c width=1920 height=1080></canvas><script>
const c=document.getElementById('c'); const gl=c.getContext('webgl2',{preserveDrawingBuffer:true});
window.info = gl ? (gl.getParameter(gl.VERSION)+' | '+gl.getParameter(gl.SHADING_LANGUAGE_VERSION)+' | '+(gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):'')) : 'no webgl2';
const vs='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}';
const fs='#version 300 es\\nprecision highp float;uniform float t;out vec4 o;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}void main(){vec2 uv=gl_FragCoord.xy/1080.;float v=0.;float a=.5;vec2 q=uv*3.;for(int i=0;i<6;i++){v+=a*n(q+t);q*=2.;a*=.5;}o=vec4(v,v*.8,v*.6,1);}';
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(x);return x;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const tl=gl.getUniformLocation(pr,'t');
window.draw=(t)=>{gl.uniform1f(tl,t);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();};
</script>`);
console.log(await page.evaluate(() => window.info));
let t0 = Date.now();
for (let i = 0; i < 10; i++) await page.evaluate((t) => window.draw(t), i * 0.04);
console.log('draw ms/frame', (Date.now() - t0) / 10);
t0 = Date.now();
for (let i = 0; i < 5; i++) { await page.evaluate((t) => window.draw(t), i * 0.04); await page.screenshot({ type: 'png' }); }
console.log('draw+png screenshot ms/frame', (Date.now() - t0) / 5);
t0 = Date.now();
for (let i = 0; i < 5; i++) { await page.evaluate((t) => window.draw(t), i * 0.04); await page.screenshot({ type: 'jpeg', quality: 95 }); }
console.log('draw+jpeg screenshot ms/frame', (Date.now() - t0) / 5);
await browser.close();
