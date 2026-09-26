import librosa, numpy as np, json
y, sr = librosa.load("song48k.wav", sr=22050, mono=True)
dur = len(y)/sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time', tightness=100)
print("duration", dur, "tempo", tempo)
bt = np.array(beats)
ibi = np.diff(bt)
print("beats", len(bt), "median IBI", np.median(ibi), "=> bpm", 60/np.median(ibi))
print("first beats", np.round(bt[:24],3))
# onset strength, RMS
hop=512
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
# 1-second energy profile
sec = np.arange(0, int(dur)+1)
prof = [float(np.sqrt(np.mean(y[int(s*sr):int((s+1)*sr)]**2))) if int(s*sr)<len(y) else 0 for s in sec]
mx=max(prof)
for s in sec:
    if s < len(prof):
        bar = "#"*int(60*prof[s]/mx)
        print(f"{s:4d}s {prof[s]:.3f} {bar}")
json.dump({"duration":dur,"tempo":float(np.atleast_1d(tempo)[0]),"beats":[float(b) for b in bt]}, open("beats_librosa.json","w"))
