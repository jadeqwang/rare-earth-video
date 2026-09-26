#!/bin/bash
# Final encode: rendered frames + the untouched song -> H.264 MP4 that fits under GitHub's 100 MB file limit.
#   bash tools/encode.sh ../work/frames_v2 ../video/rare_earth_keep_listening.mp4 [target_MB]
set -e
FR=${1:?frames dir}; OUT=${2:?output mp4}; MB=${3:-92}
AUDIO=../work/audio/song.wav
DUR=172.36
ABR=256
# total bits for the target size, minus audio, over the duration
VBR=$(python3 -c "print(int(($MB*8*1024*1024/$DUR - $ABR*1000)/1000))")
echo "video bitrate ${VBR}k"
mkdir -p "$(dirname "$OUT")"
P=$(mktemp -d)
ffmpeg -y -hide_banner -loglevel error -framerate 24 -i "$FR/f%05d.jpg" -c:v libx264 -preset slow -b:v ${VBR}k -pass 1 -passlogfile "$P/x264" \
  -pix_fmt yuv420p -an -f mp4 /dev/null
ffmpeg -y -hide_banner -loglevel error -framerate 24 -i "$FR/f%05d.jpg" -i "$AUDIO" -map 0:v -map 1:a -c:v libx264 -preset slow -b:v ${VBR}k \
  -pass 2 -passlogfile "$P/x264" -pix_fmt yuv420p -c:a aac -b:a ${ABR}k -shortest -movflags +faststart "$OUT"
rm -rf "$P"
ls -la "$OUT"
