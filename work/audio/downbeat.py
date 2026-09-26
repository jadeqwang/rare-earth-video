import librosa, numpy as np, json
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
hop=256
rms=librosa.feature.rms(y=y,hop_length=hop,frame_length=1024)[0]; t=librosa.frames_to_time(np.arange(len(rms)),sr=sr,hop_length=hop)
for a,b in [(63.8,65.6),(145.5,147.6),(15.8,19.6),(92.0,93.5),(110.0,111.5),(125.0,126.2)]:
    sel=(t>=a)&(t<=b)
    print(f"--- {a}-{b}")
    print(" ".join(f"{tt:.2f}:{r:.3f}" for tt,r in zip(t[sel][::2],rms[sel][::2])))
beats=np.array(json.load(open("beats_local.json"))["beats"])
chroma=librosa.feature.chroma_cqt(y=y,sr=sr,hop_length=hop)
# beat-synchronous chroma
bf=librosa.time_to_frames(beats,sr=sr,hop_length=hop)
cs=librosa.util.sync(chroma,bf,aggregate=np.median)
nov=np.r_[0,np.linalg.norm(np.diff(cs,axis=1),axis=0)]
# low-frequency energy per beat (kick/bass)
S=np.abs(librosa.stft(y,n_fft=2048,hop_length=hop)); fq=librosa.fft_frequencies(sr=sr,n_fft=2048)
low=S[(fq<200)].sum(0); ls=librosa.util.sync(low[None,:],bf,aggregate=np.mean)[0]
for ph in range(4):
    idx=np.arange(ph,len(nov),4)
    print("phase",ph,"chroma novelty mean",nov[idx].mean().round(3), "first downbeat", beats[ph] if ph < len(beats) else None)
