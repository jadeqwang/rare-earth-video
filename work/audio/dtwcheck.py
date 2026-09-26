import json, numpy as np, librosa
canon=json.load(open("words_aligned.json"))
rms=np.load("vocal_rms_5ms.npy"); tr=np.arange(len(rms))*110/22050
P=np.load("pitch.npz"); tp,f0,vf=P["t"],P["f0"],P["vf"]
midi=librosa.hz_to_midi(np.where(vf,f0,np.nan))
def feat(a,b):
    t=np.arange(a,b,0.01)
    m=np.interp(t,tp,np.nan_to_num(midi,nan=0)); vv=np.interp(t,tp,vf.astype(float))
    e=np.interp(t,tr,np.log(rms+1e-3))
    m=np.where(vv>0.5,m,0); pm=np.where(m>0,(m-60)/6,0)
    de=np.r_[0,np.diff(e)]*8
    return t,np.vstack([pm,e/2,de,vv]).T
def dtwmap(srcA,srcB,dstA,dstB):
    ts,X=feat(srcA,srcB); td,Y=feat(dstA,dstB)
    D,wp=librosa.sequence.dtw(X.T,Y.T,metric='euclidean',global_constraints=True,band_rad=0.12)
    wp=wp[::-1]
    return lambda x: float(np.interp(x, ts[wp[:,0]], td[wp[:,1]]))
pairs=[("V1","V4",(3.4,17.2),(79.9,93.6)),("V2","V5",(19.0,41.6),(125.6,147.9))]
out={}
for s,d,(a,b),(c,e) in pairs:
    f=dtwmap(a,b,c,e)
    sw=[w for w in canon if w["sec"]==s]; dw=[w for w in canon if w["sec"]==d]
    print(f"== {s}->{d}")
    for x,y in zip(sw,dw):
        m=f(x["t0"]); flag="  <-- " if abs(m-y["t0"])>0.12 else ""
        print(f"  {y['word']:>10}: dp {y['t0']:.2f}  dtw {m:.2f}  diff {m-y['t0']:+.2f}{flag}")
        out[f"{d}:{y['line']}:{y['wi']}"]=m
json.dump(out,open("dtw_map.json","w"),indent=1)
