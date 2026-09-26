#!/bin/bash
# short_id  file  [--song t0 | --no-mask]
export LD_LIBRARY_PATH=/opt/egl
P=/home/user/rare-earth-video/work/gen/plates
cd /home/user/rare-earth-video/pipeline
run(){ python3 process_plate.py "$@" 2>&1 | grep -v -E "^W0000|^I0000|INFO:|WARNING|Feedback|inference_feedback" | tail -1; }
run P03 $P/P03_roof26_v4-074720.mp4 --song 80.0 &
run P04 $P/P04_roof26_v2-074720.mp4 --song 19.2 &
run P05 $P/P05_roof26_v5-074720.mp4 --song 125.8 &
wait
run P06 $P/P06_band_outro-074720.mp4 &
run A01 $P/A01_room26_box-074720.mp4 &
run A02 $P/A02_room26_window-074720.mp4 &
wait
run A03 $P/A03_room26_cu-074720.mp4 &
run A04 $P/A04_room26_headphones-074720.mp4 &
run A05 $P/A05_room26_phone-074720.mp4 &
wait
run A06 $P/A06_roof_duo-074720.mp4 &
run A07 $P/A07_roof_finale-074720.mp4 &
run A08 $P/A08_charlie_cu-074720.mp4 --song 42.6 &
wait
run A09 $P/A09_ricky_cu-074720.mp4 --song 46.5 &
run E01 $P/E01_ata_night-074720.mp4 --no-mask &
run E02 $P/E02_ata_dawn-074720.mp4 --no-mask &
run E03 $P/E03_launch-074720.mp4 --no-mask &
run E04 $P/E04_alien_array-074720.mp4 --no-mask &
wait
echo ALLDONE
