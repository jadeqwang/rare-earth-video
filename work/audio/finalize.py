import json, numpy as np
canon=json.load(open("words_aligned.json")); dtw=json.load(open("dtw_map.json"))
fix={("V2",0,"life"):20.55,("V5",0,"life"):127.18,("V5",0,"pale"):128.60,("V5",0,"blue"):128.78,
     ("V5",1,"I've"):132.32,("V5",4,"alone"):146.32,("V4",4,"A"):89.99}
for c in canon:
    k=(c["sec"],c["line"],c["word"])
    if k in fix:
        d=fix[k]-c["t0"]; c["t0"]=fix[k]; c["syl_t"]=[s+d if i==0 else s for i,s in enumerate(c["syl_t"])]
        c["syl_t"][0]=fix[k]; c["fixed"]=True
# enforce monotonic syllables and word ends
for i,c in enumerate(canon):
    nxt=canon[i+1]["t0"] if i+1<len(canon) else c["t0"]+2
    c["syl_t"]=[max(s,c["t0"]) for s in c["syl_t"]]
    c["t1"]=float(min(max(c["t1"],c["syl_t"][-1]+0.12),nxt-0.01))
# lines
lines=[]
for c in canon:
    key=(c["sec"],c["line"])
    if not lines or lines[-1]["key"]!=key: lines.append({"key":key,"sec":c["sec"],"idx":c["line"],"words":[]})
    lines[-1]["words"].append({"w":c["word"],"t0":round(c["t0"],3),"t1":round(c["t1"],3),"syl":[round(s,3) for s in c["syl_t"]]})
for L in lines:
    L["t0"]=L["words"][0]["t0"]; L["t1"]=L["words"][-1]["t1"]; L["text"]=" ".join(w["w"] for w in L["words"]); del L["key"]
for L in lines: print(f'{L["sec"]} {L["t0"]:7.2f}-{L["t1"]:7.2f}  {L["text"]}')
json.dump(lines,open("lyrics_timed.json","w"),indent=1)
