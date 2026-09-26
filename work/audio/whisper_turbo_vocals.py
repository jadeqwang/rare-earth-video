import base64, json, subprocess, sys, urllib.request, os
ACC="78885e7db58a4c34423a7e62c8471b75"
URL=f"https://api.cloudflare.com/client/v4/accounts/{ACC}/ai/run/@cf/openai/whisper-large-v3-turbo"
prompt = ("Do you still care. You're yearning to see the life out there. Searching for me. Are you still there. "
          "A rare earth looking for a friend. Lived my life on a pale blue dot. Your signal here I think I've caught. "
          "The beating blinking of a star. A planet's transit is not that far from my own. How could we be alone. "
          "Before they launch or self-destruct. Weapons, wars, and now we're... Keep on looking, keep the faith. "
          "Keep up funding, our planet waits for your transmission. Our science has a vision.")
def run(start, dur, tag):
    fn=f"vchunk_{tag}.mp3"
    subprocess.run(["ffmpeg","-loglevel","error","-y","-ss",str(start),"-t",str(dur),"-i","vocals16k.mp3","-ac","1","-ar","16000","-b:a","64k",fn],check=True)
    b64=base64.b64encode(open(fn,"rb").read()).decode()
    body=json.dumps({"audio":b64,"task":"transcribe","language":"en","initial_prompt":prompt,"vad_filter":False}).encode()
    req=urllib.request.Request(URL,data=body,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=300) as r: d=json.load(r)
    json.dump(d,open(f"vturbo_{tag}.json","w"),indent=1)
    res=d.get("result",{})
    out=[]
    for seg in res.get("segments",[]):
        for w in seg.get("words",[]):
            out.append((round(w["start"]+start,2), round(w["end"]+start,2), w["word"]))
    return res.get("text"), out
chunks=[(0,45,"a"),(40,45,"b"),(75,30,"c"),(115,40,"d"),(145,28,"e")]
allw={}
import json
res={}
for s,dur,tag in chunks:
    text,words=run(s,dur,tag); res[tag]={"start":s,"text":text,"words":words}
    print(f"=== chunk {tag} [{s},{s+dur}] ::", text)
    for w in words: print("  ",w)

json.dump(res,open("vturbo_all.json","w"),indent=1)
