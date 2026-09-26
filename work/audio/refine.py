import json, numpy as np, librosa, soundfile as sf
canon=json.load(open("canon_whisper.json"))
rms=np.load("vocal_rms_5ms.npy"); tr=np.arange(len(rms))*110/22050
P=np.load("pitch.npz"); tp,f0,vf=P["t"],P["f0"],P["vf"]
midi=librosa.hz_to_midi(np.where(vf,f0,np.nan))
# ---- candidates ----
cands=[]
# (a) energy onsets: rises in log-rms, weighted by how quiet it was before
lr=np.log(rms+1e-3); k=6
d=np.r_[np.zeros(k),lr[k:]-lr[:-k]]
from scipy.signal import find_peaks
pk,_=find_peaks(d,height=0.35,distance=12)
for p in pk:
    pre=rms[max(0,p-30):p].mean(); post=rms[p:p+20].mean()
    if post<0.08: continue
    s=min(1.5, d[p]) + (0.8 if pre<0.05 else 0)
    # back off to the start of the rise
    q=p
    while q>0 and d[q-1]>0.05 and p-q<10: q-=1
    cands.append((tr[q],s,"E"))
# (b) pitch changes & voicing onsets
m=midi.copy()
for i in range(2,len(m)-6):
    if np.isnan(m[i]): continue
    if np.isnan(m[i-1]) and np.all(~np.isnan(m[i:i+5])):
        cands.append((tp[i],1.0,"V")); continue
    a=np.nanmedian(m[max(0,i-6):i]); b=np.nanmedian(m[i:i+6])
    if np.isfinite(a) and np.isfinite(b) and abs(b-a)>0.9 and np.all(~np.isnan(m[i:i+6])):
        cands.append((tp[i],0.6+min(0.6,abs(b-a)/6),"P"))
cands.sort()
# merge near-duplicates (<40ms), keep max strength
merged=[]
for c in cands:
    if merged and c[0]-merged[-1][0]<0.04:
        if c[1]>merged[-1][1]: merged[-1]=(merged[-1][0],c[1],merged[-1][2]+c[2])
        else: merged[-1]=(merged[-1][0],merged[-1][1],merged[-1][2]+c[2])
    else: merged.append(c)
C=np.array([c[0] for c in merged]); S=np.array([c[1] for c in merged])
print("candidates",len(C))
# ---- syllable priors ----
syl=[]
for wi,c in enumerate(canon):
    n=c["syl"]; ws,we=c["ws"],max(c["we"],c["ws"]+0.12*n)
    for s in range(n): syl.append({"w":wi,"s":s,"p":ws+(we-ws)*s/n,"first_of_line":c["wi"]==0 and s==0})
n=len(syl)
p=np.array([x["p"] for x in syl])
# ---- DP (2nd order via relative interval penalty, approximated with 1st-order state on candidate) ----
INF=1e18
# allowed window per syllable: whisper tends to be early -> allow [-0.35,+0.9]
allowed=[np.where((C>=p[i]-0.35)&(C<=p[i]+0.9))[0] for i in range(n)]
cost=[None]*n; back=[None]*n
def unary(i,idx):
    dt=C[idx]-(p[i]+0.18)
    u=(dt/0.35)**2 - 1.2*S[idx]
    if syl[i]["first_of_line"]:
        u-=0.8*S[idx]
    return u
cost[0]=unary(0,allowed[0]); back[0]=np.full(len(allowed[0]),-1)
for i in range(1,n):
    a_prev=allowed[i-1]; a=allowed[i]
    u=unary(i,a)
    if len(a_prev)==0 or len(a)==0:
        raise SystemExit(f"empty window at {i} {syl[i]} {canon[syl[i]['w']]}")
    Cp=C[a_prev][:,None]; Cn=C[a][None,:]
    gap=Cn-Cp
    exp_gap=p[i]-p[i-1]
    rel=((gap-exp_gap)/max(0.25,0.6*exp_gap))**2*0.6
    valid=gap>0.06
    tot=cost[i-1][:,None]+rel
    tot=np.where(valid,tot,INF)
    bi=np.argmin(tot,axis=0)
    cost[i]=tot[bi,np.arange(len(a))]+u
    back[i]=bi
# backtrack
idx=[None]*n
j=int(np.argmin(cost[-1])); idx[-1]=allowed[-1][j]
for i in range(n-1,0,-1):
    j=back[i][j]; idx[i-1]=allowed[i-1][j]
st=C[np.array(idx)]
for i,x in enumerate(syl): x["t"]=float(st[i])
# ---- word timing ----
for wi,c in enumerate(canon):
    ss=[x for x in syl if x["w"]==wi]
    c["t0"]=ss[0]["t"]; c["syl_t"]=[x["t"] for x in ss]
# word end: before next word start, or when vocal energy drops
for wi,c in enumerate(canon):
    nxt=canon[wi+1]["t0"] if wi+1<len(canon) else c["t0"]+1.5
    # find energy drop after last syllable
    i0=int(c["syl_t"][-1]/(110/22050))+20; i1=int(min(nxt,c["syl_t"][-1]+2.5)/(110/22050))
    seg=rms[i0:i1]; off=np.where(seg<0.06)[0]
    end=tr[i0+off[0]] if len(off) else min(nxt,c["syl_t"][-1]+2.5)
    c["t1"]=float(min(end,nxt-0.01))
json.dump(canon,open("words_aligned.json","w"),indent=1)
cur=None
for c in canon:
    key=(c["sec"],c["line"])
    if key!=cur:
        print(); print(f"[{c['sec']} L{c['line']}]",end=" "); cur=key
    print(f"{c['word']}@{c['t0']:.2f}({c['ws']:.2f})",end=" ")
print()
