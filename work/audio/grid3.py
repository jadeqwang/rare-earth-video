import librosa, numpy as np, json
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
# kick-focused onset: lowpass energy flux
hop=128; fr=sr/hop
S=np.abs(librosa.stft(y,n_fft=2048,hop_length=hop))
freqs=librosa.fft_frequencies(sr=sr,n_fft=2048)
low=S[(freqs>30)&(freqs<150)].sum(0)
flux=np.maximum(0,np.diff(np.log1p(low),prepend=0))
flux=flux/flux.max()
full=librosa.onset.onset_strength(y=y,sr=sr,hop_length=hop)
full=full/full.max()
t=np.arange(len(flux))/fr
# silence detection (hard cut)
rms=librosa.feature.rms(y=y,hop_length=hop)[0]
for i in range(1,len(rms)):
    pass
quiet = t[rms < 0.01]
# group quiet regions
regs=[]
for q in quiet:
    if regs and q-regs[-1][1] < 0.02: regs[-1][1]=q
    else: regs.append([q,q])
print("quiet regions (rms<0.01, >50ms):", [(round(a,3),round(b,3)) for a,b in regs if b-a>0.05])
# local beat tracking with prior 126.52
tempo, beats = librosa.beat.beat_track(onset_envelope=flux*0.6+full*0.4, sr=sr, hop_length=hop, units='time', bpm=126.52, tightness=800)
b=np.array(beats)
d=np.diff(b)
print("n beats", len(b), "IBI stats", d.mean(), d.std(), d.min(), d.max())
# report sections of tempo
for w0 in range(0,172,8):
    sel=(b[:-1]>=w0)&(b[:-1]<w0+8)
    if sel.sum()>2: print(f"{w0:3d}-{w0+8:3d}s: mean IBI {d[sel].mean():.4f} -> {60/d[sel].mean():.2f} bpm; first beat {b[:-1][sel][0]:.3f}")
json.dump({"beats":[float(x) for x in b]},open("beats_local.json","w"))
# kick onsets (peaks in low flux)
pk=librosa.util.peak_pick(flux,pre_max=10,post_max=10,pre_avg=20,post_avg=20,delta=0.08,wait=40)
kicks=t[pk]
print("n kicks", len(kicks)); print(np.round(kicks[:40],3))
json.dump({"kicks":[float(x) for x in kicks]},open("kicks.json","w"))
