import sys, time; sys.path.insert(0,'/home/user/rare-earth-video/pipeline')
from gen import batch, as_data_uri
R='/home/user/rare-earth-video/work/refs/'
refs=[as_data_uri(R+'jade2011_sing.jpg'),as_data_uri(R+'jade2011_full.jpg'),as_data_uri(R+'jade2011_face.jpg')]
P=("Character design turnaround sheet for an anime music video. Style: modern anime key-visual — crisp clean line art, "
   "flat cel shading with two tones, bold readable silhouettes, subtle warm rim light; NOT 3D, NOT Pixar, NOT watercolor. "
   "Character: JADE in 2011, a 28-year-old East Asian indie singer. Match the woman in the reference photos: her face, "
   "long straight black hair, black bucket hat, loose white linen shirt with rolled sleeves over a cream top, rust-red "
   "tiered ruffled midi skirt, brown strappy sandals, thin silver necklace, holding a black handheld microphone. "
   "Layout on a plain light grey background: full body front view, three-quarter view, side profile, back view, and a row "
   "of three head close-ups (eyes closed singing with mouth open; soft smile at viewer; looking up in wonder). "
   "Consistent proportions, no text, no labels.")
t=time.strftime("%H%M%S")
jobs=[
 {"id":f"j11-nbpro-{t}","model":"google/nano-banana-pro","input":{"prompt":P,"image_input":refs,"aspect_ratio":"16:9","image_size":"2K","output_format":"png"},"ext":".png"},
 {"id":f"j11-gpt2-{t}","model":"openai/gpt-image-2","input":{"prompt":P,"images":refs,"size":"1536x1024","quality":"high","output_format":"png"},"ext":".png"},
 {"id":f"j11-grok2-{t}","model":"xai/grok-imagine-image-2.0","input":{"prompt":P,"images":[{"url":u,"type":"image_url"} for u in refs],"aspect_ratio":"16:9","resolution":"2k"},"ext":".jpg"},
 {"id":f"j11-sd45-{t}","model":"bytedance/seedream-4.5","input":{"prompt":P,"image_input":refs,"aspect_ratio":"16:9","size":"2K"},"ext":".jpg"},
 {"id":f"j11-flux-{t}","model":"black-forest-labs/flux-2-max","input":{"prompt":P,"input_images":refs,"width":1920,"height":1088,"output_format":"png"},"ext":".png"},
]
res=batch(jobs,".")
