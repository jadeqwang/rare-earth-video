import json, numpy as np, re, librosa, soundfile as sf
from lyrics_def import SECTIONS
# ---------- Whisper anchors (song-mix turbo) ----------
W=[]
for tag in "abcd":
    d=json.load(open(f"turbo_{tag}.json")); s={"a":0,"b":50,"c":100,"d":135}[tag]
    for seg in d["result"]["segments"]:
        for w in seg.get("words",[]): W.append((w["start"]+s,w["end"]+s,w["word"].strip()))
W.sort()
def norm(x): return re.sub(r"[^a-z']","",x.lower().replace("’","'"))
# dedupe overlapping chunk words (keep first occurrence within 0.3s)
ded=[]
for w in W:
    if ded and abs(w[0]-ded[-1][0])<0.3 and norm(w[2])==norm(ded[-1][2]): continue
    ded.append(w)
W=ded
# hallucination region guard: drop words after 147.5 (outro garbage) and dup V5 lines
W=[w for w in W if w[0]<147.5]
# ---------- map canonical words to whisper words, in order ----------
canon=[]
for sec,lines in SECTIONS:
    for li,line in enumerate(lines):
        for wi,(word,syl) in enumerate(line):
            canon.append({"sec":sec,"line":li,"wi":wi,"word":word,"syl":syl})
# simple monotonic matcher: walk through whisper words, match normalized text
j=0; miss=[]
for c in canon:
    target=norm(c["word"]).replace("-","")
    found=None
    for k in range(j, min(j+12,len(W))):
        ww=norm(W[k][2]).replace("-","")
        if ww==target or (target.startswith(ww) and len(ww)>2) or (ww.startswith(target) and len(target)>2) or (target=="lived" and ww=="live") or (target=="selfdestruct" and ww in("self","selfdestruct")):
            found=k; break
    if found is None:
        miss.append(c["word"]); c["ws"]=None; c["we"]=None
    else:
        c["ws"],c["we"]=W[found][0],W[found][1]; j=found+1
        if target=="selfdestruct" and norm(W[found][2])=="self" and found+1<len(W): c["we"]=W[found+1][1]; j=found+2
print("unmatched:",miss)
# interpolate missing
for i,c in enumerate(canon):
    if c["ws"] is None:
        prev=next((canon[k] for k in range(i-1,-1,-1) if canon[k]["ws"] is not None),None)
        nxt=next((canon[k] for k in range(i+1,len(canon)) if canon[k]["ws"] is not None),None)
        c["ws"]=(prev["we"] if prev else 0)+0.05; c["we"]=(nxt["ws"] if nxt else c["ws"]+0.4)
        c["interp"]=True
json.dump(canon,open("canon_whisper.json","w"),indent=1)
for c in canon[:6]: print(c)
print(len(canon))
