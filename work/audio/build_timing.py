import json, numpy as np, librosa, soundfile as sf
beats=np.array(json.load(open("beats_local.json"))["beats"])
k0=int(np.argmin(np.abs(beats-4.12)))
down=beats[k0::4]
print("first beats",np.round(beats[:12],3))
for ev in [19.0,41.2,57.8,64.5,73.0,80.3,94.8,110.5,117.0,126.1,147.0,162.0]:
    j=np.argmin(np.abs(down-ev)); print(f"event {ev:6.1f}: nearest downbeat {down[j]:.3f} (bar {j}) d={down[j]-ev:+.3f}")
# extend beats back into the intro with the first IBI
ibi=beats[k0+1]-beats[k0]
pre=[beats[k0]-ibi*i for i in range(1,9) if beats[k0]-ibi*i>0][::-1]
allb=np.r_[pre,beats[k0:]]
# frame-rate curves (24 fps) for the renderer
FPS=24
y,sr=librosa.load("song48k.wav",sr=22050,mono=True)
dur=len(y)/sr; nf=int(np.ceil(dur*FPS))
hop=int(sr/FPS)
rms=librosa.feature.rms(y=y,frame_length=2048,hop_length=hop,center=True)[0][:nf]
S=np.abs(librosa.stft(y,n_fft=2048,hop_length=hop))[:, :nf]; fq=librosa.fft_frequencies(sr=sr,n_fft=2048)
def band(a,b): e=S[(fq>=a)&(fq<b)].sum(0); return e/np.percentile(e,99)
low=band(20,150); mid=band(150,2000); high=band(4000,11000)
flux=np.r_[0,np.maximum(0,np.diff(np.log1p(S),axis=1)).sum(0)]; flux/=np.percentile(flux,99)
v,vsr=sf.read("stems/vocals.wav"); v=v.mean(1); vh=int(vsr/FPS)
venv=np.array([np.sqrt(np.mean(v[i*vh:(i+1)*vh]**2)) for i in range(nf)]); venv/=np.percentile(venv,99)
v100h=vsr//100; venv100=np.array([np.sqrt(np.mean(v[i*v100h:(i+1)*v100h]**2)) for i in range(len(v)//v100h)]); venv100/=np.percentile(venv100,99)
kicks=json.load(open("kicks.json"))["kicks"]
lines=json.load(open("lyrics_timed.json"))
sections=[
 {"id":"intro","t0":0.0,"t1":3.82,"desc":"pad swell; vocal pickup at 3.82, band enters 4.12"},
 {"id":"V1","t0":3.82,"t1":19.0,"desc":"verse 1 / hook: do you still care"},
 {"id":"V2","t0":19.0,"t1":41.2,"desc":"verse 2: pale blue dot; breakdown 35-41"},
 {"id":"break","t0":41.2,"t1":57.8,"desc":"instrumental break, full energy"},
 {"id":"V3","t0":57.8,"t1":80.4,"desc":"verse 3: launch/self-destruct; censored hole 64.48-65.5; breakdown 73-80"},
 {"id":"V4","t0":80.4,"t1":94.8,"desc":"hook return"},
 {"id":"bridge","t0":94.8,"t1":126.1,"desc":"instrumental; drums drop ~110.8; build 117-125"},
 {"id":"V5","t0":126.1,"t1":147.0,"desc":"quiet intimate restart, builds; near-silence 143.5-146.9"},
 {"id":"outro","t0":147.0,"t1":162.2,"desc":"climax drop, loudest section"},
 {"id":"tail","t0":162.2,"t1":dur,"desc":"sustain + fade"},
]
events=[{"id":"band_in","t":4.12},{"id":"censor_hole","t0":64.48,"t1":65.52},{"id":"drop","t":147.0},
        {"id":"v5_whisper","t":126.13},{"id":"bridge_breakdown","t":110.8},{"id":"end_silence","t":170.6}]
out={"fps":FPS,"duration":dur,"frames":nf,"tempo_bpm_approx":126.3,
     "beats":[round(float(b),4) for b in allb],"downbeats":[round(float(b),4) for b in down],
     "sections":sections,"events":events,"lines":lines,"kicks":[round(k,3) for k in kicks],
     "curves":{"rms":np.round(rms/np.percentile(rms,99),3).tolist(),"low":np.round(low,3).tolist(),"mid":np.round(mid,3).tolist(),
               "high":np.round(high,3).tolist(),"flux":np.round(flux,3).tolist(),"vocal":np.round(venv,3).tolist()},
     "vocal100":np.round(venv100,3).tolist()}
json.dump(out,open("timing.json","w"))
print("frames",nf,"beats",len(allb),"downbeats",len(down))
