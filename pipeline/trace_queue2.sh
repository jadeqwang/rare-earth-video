#!/bin/bash
cd /home/user/rare-earth-video
while pgrep -f "trace_sing.sh" > /dev/null; do sleep 20; done
trace() { pid=$1; take=$2; shift 2; rm -rf render/assets/plates/$pid; python3 pipeline/trace.py $pid work/plates/raw/$take.mp4 "$@" --k 16 || echo "FAILED $take"; }
trace P09_catch P09_catch_t5 --keypt 0.15,0.3
trace P15_dawn P15_dawn_t5 --key none
trace P23_rim26 P23_rim26_t4 --keypt 0.85,0.2
trace P25_oh P25_oh_t5 --keypt 0.9,0.2
