import librosa, librosa.display, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt, json
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
S = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=512)), ref=np.max)
words=[]
import glob
fig, axes = plt.subplots(4,1, figsize=(26,16))
for k,ax in enumerate(axes):
    t0,t1=k*43.1,(k+1)*43.1
    librosa.display.specshow(S, sr=sr, hop_length=512, x_axis='time', y_axis='log', ax=ax, cmap='magma')
    ax.set_xlim(t0,t1); ax.set_ylim(40,11000)
    ax.set_xticks(np.arange(int(t0),int(t1)+1,1)); ax.tick_params(labelsize=7)
    for bt in np.arange(0.105, 173, 60/126.52):
        if t0<=bt<=t1: ax.axvline(bt, color='cyan', lw=0.4, alpha=0.5)
plt.tight_layout(); plt.savefig("spectrogram.png", dpi=60)
