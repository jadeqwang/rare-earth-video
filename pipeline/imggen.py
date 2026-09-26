"""Image generation adapters (one call signature for every image model on the Cloudflare catalog).

    from imggen import gen_image
    path = gen_image("gpt", prompt, "work/style/x", refs=["Sheet_2_Jade_at_28.jpg"], aspect="16:9")
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

import cf

MODELS = {
    "gpt": "openai/gpt-image-2.5-sunburst",
    "gptf": "openai/gpt-image-2.5-flare",
    "nano": "google/nano-banana-pro",
    "nano2": "google/nano-banana-2",
    "seedream": "bytedance/seedream-5-pro",
    "grok": "xai/grok-imagine-image-2.0",
    "flux": "black-forest-labs/flux-2-max",
}


def _inp(key, prompt, refs, aspect, quality):
    if key in ("gpt", "gptf"):
        size = {"16:9": "1536x1024", "3:2": "1536x1024", "1:1": "1024x1024", "2:3": "1024x1536", "9:16": "1024x1536"}[aspect]
        d = {"prompt": prompt, "size": size, "quality": quality or "high", "output_format": "png"}
        if refs:
            d["images"] = [cf.data_uri(r, max_side=1536) for r in refs[:16]]
        return d
    if key in ("nano", "nano2"):
        d = {"prompt": prompt, "aspect_ratio": aspect, "output_format": "png"}
        if key == "nano":
            d["image_size"] = "2K"
        else:
            d["resolution"] = "2K"
        if refs:
            d["image_input"] = [cf.data_uri(r, max_side=1536) for r in refs[:3]]
        return d
    if key == "seedream":
        size = {"16:9": "2560x1440", "3:2": "2400x1600", "1:1": "2048x2048", "2:3": "1600x2400", "9:16": "1440x2560"}[aspect]
        d = {"prompt": prompt, "size": size, "watermark": False}
        if refs:
            d["image"] = [cf.data_uri(r, max_side=1536) for r in refs[:10]]
        return d
    if key == "grok":
        d = {"prompt": prompt, "aspect_ratio": aspect, "resolution": "2k", "quality": quality or "medium",
             "response_format": "b64_json"}
        if refs:
            d["images"] = [{"url": cf.data_uri(r, max_side=1536)} for r in refs[:5]]
        return d
    if key == "flux":
        wh = {"16:9": (1920, 1088), "3:2": (1920, 1280), "1:1": (1536, 1536), "2:3": (1280, 1920), "9:16": (1088, 1920)}[aspect]
        d = {"prompt": prompt, "width": wh[0], "height": wh[1], "output_format": "png", "safety_tolerance": 2}
        if refs:
            d["input_images"] = [cf.data_uri(r, max_side=1536) for r in refs[:8]]
        return d
    raise ValueError(key)


def gen_image(key, prompt, out_base, refs=None, aspect="16:9", quality=None, tag=None):
    """Generate one image; returns the local path (PNG/JPG as delivered)."""
    tag = tag or os.path.basename(out_base)
    inp = _inp(key, prompt, refs, aspect, quality)
    paths, rec = cf.generate(MODELS[key], inp, out_base, tag=f"{key}:{tag}", timeout=1200)
    if not paths:
        raise RuntimeError(f"no image for {tag}: {json.dumps(cf.result_of(rec))[:500]}")
    # normalise to an actual image file
    p = paths[0]
    try:
        Image.open(p).verify()
    except Exception:
        raise RuntimeError(f"bad image file {p}")
    return p


def gen_many(jobs, workers=6):
    """jobs: list of dicts(key, prompt, out_base, refs, aspect, quality). Returns list of (job, path|Exception)."""
    def one(j):
        try:
            return j, gen_image(j["key"], j["prompt"], j["out_base"], j.get("refs"), j.get("aspect", "16:9"),
                                j.get("quality"))
        except Exception as e:  # noqa: BLE001
            return j, e
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(one, jobs))
