#!/usr/bin/env bash
# Optimiert die Original-GLBs (assets/source/3d) für die Auslieferung (public/3d).
# 2K-Texturen für Desktop, 1K für Mobil. WebP, Meshopt, Quantisierung. Siehe docs/design-startseite.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
for f in wildberry peach raspberry-lime; do
  npx -y @gltf-transform/cli@latest optimize "assets/source/3d/$f.glb" "public/3d/$f-2k.glb" --texture-size 2048 --texture-compress webp --compress meshopt --simplify false
  npx -y @gltf-transform/cli@latest optimize "assets/source/3d/$f.glb" "public/3d/$f-1k.glb" --texture-size 1024 --texture-compress webp --compress meshopt --simplify false
done
ls -la public/3d
