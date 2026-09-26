#!/bin/bash
# Re-render frame ranges into an existing frames dir (after small shot fixes), e.g.
#   bash tools/patch.sh ../work/frames_v2 229:281 920:958
set -e
OUT=${1:?frames dir}; shift
for r in "$@"; do
  node tools/render.mjs --from ${r%:*} --to ${r#*:} --workers ${WORKERS:-3} --out "$OUT" 2>&1 | grep -v " 404 \|status of 404" | tail -1
done
