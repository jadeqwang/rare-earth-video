import sys, glob, os
from PIL import Image, ImageDraw
out = sys.argv[1]; files = sys.argv[2:]
tw, th, cols = 480, 270, 4
rows = (len(files) + cols - 1) // cols
s = Image.new("RGB", (tw * cols, th * rows))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 90, 22], fill=(0, 0, 0)); d.text((5, 5), os.path.basename(f).rsplit('.', 1)[0], fill=(255, 255, 0))
    s.paste(im, ((i % cols) * tw, (i // cols) * th))
s.save(out, quality=85)
