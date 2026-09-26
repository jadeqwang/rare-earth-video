"""Contact sheet of rendered stills: python3 contact.py <dir> <out.jpg> [cols] [w]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
W = int(sys.argv[4]) if len(sys.argv) > 4 else 640
fs = sorted(glob.glob(os.path.join(d, '*.jpg')))
H = W * 9 // 16
rows = (len(fs) + cols - 1) // cols
s = Image.new('RGB', (W * cols, H * rows), (30, 30, 30)); dr = ImageDraw.Draw(s)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((W, H)); s.paste(im, ((i % cols) * W, (i // cols) * H))
    dr.text(((i % cols) * W + 6, (i // cols) * H + 4), os.path.basename(f)[:-4], fill=(255, 255, 0))
s.save(out, quality=85)
