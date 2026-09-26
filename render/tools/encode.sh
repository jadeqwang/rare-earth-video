#!/bin/bash
# Final encode: rendered frames + the untouched song -> H.264 MP4 that fits under GitHub's 100 MB file limit.
#   bash tools/encode.sh ../work/frames_v2 ../video/rare_earth_keep_listening.mp4 [target_MB]
# The renderer's film grain is per-pixel noise; a light denoise first keeps a ~4 Mbit/s encode clean instead of blocky.
set -e
FR=${1:?frames dir}; OUT=${2:?output mp4}; MB=${3:-92}
AUDIO=../work/audio/song.wav
DUR=172.36
ABR=256
VBR=$(python3 -c "print(int(($MB*8*1024*1024/$DUR - $ABR*1000)/1000))")
echo "video bitrate ${VBR}k"
mkdir -p "$(dirname "$OUT")"
P=$(mktemp -d)
VF="hqdn3d=1.2:1.0:4:4"
X264="-c:v libx264 -preset slow -tune animation -profile:v high -b:v ${VBR}k -maxrate $((VBR * 2))k -bufsize $((VBR * 3))k -pix_fmt yuv420p"
ffmpeg -y -hide_banner -loglevel error -framerate 24 -i "$FR/f%05d.jpg" -vf "$VF" $X264 -pass 1 -passlogfile "$P/x264" -an -f mp4 /dev/null
ffmpeg -y -hide_banner -loglevel error -framerate 24 -i "$FR/f%05d.jpg" -i "$AUDIO" -map 0:v -map 1:a -vf "$VF" $X264 \
  -pass 2 -passlogfile "$P/x264" -c:a aac -b:a ${ABR}k -shortest -movflags +faststart "$OUT"
rm -rf "$P"
ls -la "$OUT"
