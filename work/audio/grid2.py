import librosa, numpy as np
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
hop=128
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, aggregate=np.median)
fr = sr/hop
t = np.arange(len(oenv))/fr
def score(bpm, phase, t0=0, t1=1e9):
    per=60/bpm
    bt=np.arange(phase, t[-1], per)
    bt=bt[(bt>=t0)&(bt<t1)]
    idx=np.round(bt*fr).astype(int); idx=idx[idx<len(oenv)]
    return oenv[idx].mean()
best=(0,None)
for bpm in np.arange(118,134,0.02):
    per=60/bpm
    for ph in np.arange(0,per,0.005):
        s=score(bpm,ph)
        if s>best[0]: best=(s,(bpm,ph))
print("global best", best)
bpm,ph=best[1]
# local check: in 20s windows, best phase offset relative to global grid
per=60/bpm
for w0 in range(0,170,10):
    bs=(0,0)
    for d in np.arange(-0.2,0.2,0.005):
        s=score(bpm,ph+d,w0,w0+20)
        if s>bs[0]: bs=(s,d)
    print(f"window {w0:3d}-{w0+20:3d}: best phase shift {bs[1]:+.3f}s score {bs[0]:.2f}")
