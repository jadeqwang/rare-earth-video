import sys
from PIL import Image, ImageDraw
W, H = 1920, 1080
ims = []
for f in sys.argv[2:]:
    im = Image.open(f).convert("RGB").resize((W, H))
    d = ImageDraw.Draw(im)
    for x in range(0, W, 100):
        d.line([(x, 0), (x, H)], fill=(255, 255, 0) if x % 500 == 0 else (120, 120, 0), width=1)
        d.text((x + 3, 3), str(x), fill=(255, 255, 0))
    for y in range(0, H, 100):
        d.line([(0, y), (W, y)], fill=(255, 255, 0) if y % 500 == 0 else (120, 120, 0), width=1)
        d.text((3, y + 3), str(y), fill=(255, 255, 0))
    d.text((W - 200, 10), f.split('/')[-1], fill=(255, 80, 80))
    ims.append(im.resize((960, 540)))
cols = 2
s = Image.new("RGB", (960 * cols, 540 * ((len(ims) + 1) // cols)))
for i, im in enumerate(ims):
    s.paste(im, ((i % cols) * 960, (i // cols) * 540))
s.save(sys.argv[1], quality=88)
