import numpy as np, soundfile as sf, librosa, json
v,sr=sf.read('stems/vocals.wav'); v=v.mean(1)
y=librosa.resample(v,orig_sr=sr,target_sr=22050); sr=22050
hop=220  # 10ms
f0,vf,vp=librosa.pyin(y,fmin=130,fmax=900,sr=sr,frame_length=2048,hop_length=hop)
t=librosa.times_like(f0,sr=sr,hop_length=hop)
np.savez('pitch.npz',t=t,f0=f0,vf=vf,vp=vp)
print("frames",len(t),"voiced frac",np.nanmean(vf))
