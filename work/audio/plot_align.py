import json, numpy as np, matplotlib, librosa, sys
matplotlib.use("Agg"); import matplotlib.pyplot as plt
canon=json.load(open(sys.argv[1] if len(sys.argv)>1 else "words_aligned.json"))
rms=np.load("vocal_rms_5ms.npy"); tr=np.arange(len(rms))*110/22050
P=np.load("pitch.npz"); tp,f0,vf=P["t"],P["f0"],P["vf"]; midi=librosa.hz_to_midi(np.where(vf,f0,np.nan))
lines={}
for c in canon: lines.setdefault((c["sec"],c["line"]),[]).append(c)
keys=list(lines.keys())
for part in range(0,len(keys),7):
    ks=keys[part:part+7]
    fig,axes=plt.subplots(len(ks),1,figsize=(22,3.0*len(ks)))
    for ax,k in zip(np.atleast_1d(axes),ks):
        ws=lines[k]; a=min(w["t0"] for w in ws)-0.5; b=max(w["t1"] for w in ws)+0.4
        sel=(tr>=a)&(tr<=b); ax.plot(tr[sel],rms[sel],color="k",lw=0.8)
        ax2=ax.twinx(); s2=(tp>=a)&(tp<=b); ax2.plot(tp[s2],midi[s2],color="tab:orange",lw=1.2); ax2.set_ylim(45,80)
        for w in ws:
            ax.axvline(w["t0"],color="tab:blue",lw=1.2); ax.text(w["t0"],1.02,w["word"],fontsize=10,color="tab:blue",rotation=0)
            for st in w["syl_t"][1:]: ax.axvline(st,color="tab:blue",lw=0.6,ls=":")
            ax.axvline(w["ws"],color="gray",lw=0.6,ls="--")
        ax.set_xlim(a,b); ax.set_ylim(0,1.15); ax.set_title(f"{k[0]} line {k[1]}",fontsize=10,loc="left")
        ax.set_xticks(np.arange(np.ceil(a*4)/4,b,0.25)); ax.tick_params(labelsize=6)
    plt.tight_layout(); plt.savefig(f"align_check_{part//7}.png",dpi=55); plt.close()
print("ok")
