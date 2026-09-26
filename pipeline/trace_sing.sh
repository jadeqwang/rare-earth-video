#!/bin/bash
cd /home/user/rare-earth-video
trace() { pid=$1; take=$2; shift 2; rm -rf render/assets/plates/$pid; python3 pipeline/trace.py $pid work/plates/raw/$take.mp4 "$@" --k 16 || echo "FAILED $take"; }
trace P02_care P02_care_t3 --keypt 0.05,0.1
trace P03_there P03_there_t1 --keypt 0.05,0.1
trace P10_alone P10_alone_t1 --keypt 0.97,0.6
trace P18_jade26 P18_jade26_t0 --keypt 0.75,0.25
trace P21_v5cu P21_v5cu_t1 --keypt 0.1,0.1
trace P05_guitar P05_guitar_t2 --key none
