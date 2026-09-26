import librosa, numpy as np, json
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
tg = librosa.feature.tempogram(onset_envelope=oenv, sr=sr, hop_length=256)
# global tempo candidates
ac = librosa.autocorrelate(oenv, max_size=len(oenv))
fr = sr/256
lags = np.arange(len(ac))/fr
mask=(lags>0.3)&(lags<1.2)
cand = lags[mask][np.argsort(ac[mask])[::-1][:8]]
print("top autocorr lags (s):", np.round(cand,4), "bpm:", np.round(60/cand,2))
# try several bpm with dynamic programming, then fit
for start_bpm in [123.0, 125.0, 128.0, 129.2]:
    tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, units='time', start_bpm=start_bpm, tightness=400)
    b=np.array(beats); i=np.arange(len(b))
    A=np.vstack([i,np.ones_like(i)]).T
    (per,off),res,_,_=np.linalg.lstsq(A,b,rcond=None)
    resid=b-(per*i+off)
    print(f"start {start_bpm}: n={len(b)} period={per:.5f} bpm={60/per:.3f} offset={off:.3f} resid_std={resid.std():.4f} maxabs={np.abs(resid).max():.3f}")
