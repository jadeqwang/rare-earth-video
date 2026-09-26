import sys, time; sys.path.insert(0,'/home/user/rare-earth-video/pipeline')
from gen import batch, as_data_uri
R='/home/user/rare-earth-video/work/refs/'; ROOT='/home/user/rare-earth-video/'
anchor=as_data_uri(R+'SHEET_jade2011.png')
STYLE=("Same art style as the first reference sheet: modern anime key-visual, crisp clean line art, flat cel shading, "
       "warm rim light, plain light grey background, no text or labels. ")
t=time.strftime("%H%M%S")
jobs=[
 {"id":f"jade26-{t}","model":"openai/gpt-image-2","ext":".png","input":{"quality":"high","size":"1536x1024","output_format":"png",
   "images":[anchor,as_data_uri(R+'jade2011_face.jpg'),as_data_uri(ROOT+'Sheet_1_Jade_now.jpg')],
   "prompt":STYLE+("Character turnaround sheet: JADE in 2026, the SAME woman as in the first sheet, now 43 — same face, a little older and calmer, "
     "faint smile lines, no hat, long black hair tied up in a loose messy bun with loose strands, oversized heather-grey hoodie, dark "
     "charcoal joggers, white socks. Full body front, three-quarter, side profile, back view; row of three head close-ups: "
     "quiet singing with eyes half closed; wide-eyed wonder looking up; gentle smile wearing black over-ear headphones.")}},
 {"id":f"charlie-{t}","model":"openai/gpt-image-2","ext":".png","input":{"quality":"high","size":"1536x1024","output_format":"png",
   "images":[anchor,as_data_uri(R+'charlie_a.jpg'),as_data_uri(R+'charlie_b.jpg'),as_data_uri(ROOT+'Sheet_3a_Charlie.jpg')],
   "prompt":STYLE+("Character turnaround sheet: CHARLIE, guitarist of the same indie band in 2011, a lean man around 30 matching the man with "
     "the flat cap in the photos: grey wool flat cap, dark curly hair, short stubble, charcoal t-shirt, faded jeans, brown boots, playing a "
     "worn acoustic guitar with a leather strap. Front, three-quarter, side, back; row of three head close-ups: focused playing, "
     "laughing, looking up.")}},
 {"id":f"ricky-{t}","model":"openai/gpt-image-2","ext":".png","input":{"quality":"high","size":"1536x1024","output_format":"png",
   "images":[anchor,as_data_uri(R+'ricky_a.jpg'),as_data_uri(R+'ricky_b.jpg'),as_data_uri(ROOT+'Sheet_3b_Ricky.jpg')],
   "prompt":STYLE+("Character turnaround sheet: RICKY, electric guitarist of the same indie band in 2011, a slim East Asian man around 30 "
     "matching the man in the striped shirt in the photos: short black hair, calm focused face, blue-and-white vertical striped "
     "button-up shirt with sleeves rolled, dark jeans, white sneakers, playing a natural-wood Stratocaster-style electric guitar with "
     "a navy strap. Front, three-quarter, side, back; row of three head close-ups: concentrating, small smile, looking up.")}},
 {"id":f"props-{t}","model":"openai/gpt-image-2","ext":".png","input":{"quality":"high","size":"1536x1024","output_format":"png",
   "images":[anchor,as_data_uri(ROOT+'Sheet_1_Jade_now.jpg'),as_data_uri(ROOT+'Sheet_4_recorder.jpg')],
   "prompt":STYLE+("Prop and pet design sheet. Left half: a fluffy brown tabby cat with green eyes — sitting front view, side view, "
     "loaf pose sleeping, and a head close-up with ears perked up in surprise. Right half: a handheld digital field recorder with "
     "crossed X/Y microphones on top, small backlit LCD showing a waveform, red REC LED, play/stop buttons — front, back, side, "
     "three-quarter, and held in a hand with the thumb on PLAY.")}},
]
res=batch(jobs,".")
