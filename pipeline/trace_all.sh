#!/bin/bash
# Trace every chosen plate take (non-singing first). usage: bash pipeline/trace_all.sh [PID_take ...]
cd /home/user/rare-earth-video
declare -A KEY=(
 [P01_rim_t0]="--keypt 0.3,0.06" [P04_eye_t0]="--key none" [P05_guitar_t0]="--key none" [P06_rehearsal_t0]="--key none"
 [P07_rooftop_t0]="--keypt 0.5,0.05" [P08_notebook_t0]="--key none" [P11_gig_t0]="--keypt 0.03,0.05" [P12_charlie_t0]="--keypt 0.95,0.1"
 [P13_ricky_t0]="--keypt 0.05,0.1" [P14_pad_t0]="--keypt 0.1,0.1" [P16_launch_t0]="--key none" [P17_crowd_t0]="--key none"
 [P20_room26_t0]="--key none" [P22_cheer_t0]="--key none" [P24_group_t0]="--keypt 0.5,0.04"
)
todo=("$@"); [ ${#todo[@]} -eq 0 ] && todo=("${!KEY[@]}")
for take in "${todo[@]}"; do
  pid=${take%_t*}
  args=${KEY[$take]:-"--key auto"}
  [ -f render/assets/plates/$pid/meta.json ] && [ -z "$FORCE" ] && { echo "skip $pid"; continue; }
  rm -rf render/assets/plates/$pid
  python3 pipeline/trace.py $pid work/plates/raw/$take.mp4 $args --k 16 || echo "FAILED $take"
done
