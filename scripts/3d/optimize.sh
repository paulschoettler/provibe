#!/usr/bin/env bash
# Bereitet die Original-GLBs (assets/source/3d) für die Auslieferung vor (public/3d).
#
# Je Sorte zwei Dateien:
#   <sorte>-2k.glb  Desktop: Basecolor 2048 px, Metal/Roughness 1024 px
#   <sorte>-1k.glb  Mobil:   Basecolor 1024 px, Metal/Roughness 512 px
#
# Was genau passiert und warum, steht oben in scripts/3d/prepare-can.mjs und in
# docs/design-startseite.md, Abschnitt 3. Kurz: Alphakanal der Basecolor auf Weiß,
# Etikett als Druckfarbe statt Vollmetall, Texturkoordinaten mit 16 Bit, WebP 90, Meshopt.
#
# Idempotent: Die Werkzeuge liegen mit festen Versionen in node_modules/.cache/provibe-3d
# und werden nur beim ersten Lauf installiert. Die Originale werden nur gelesen.
set -euo pipefail
cd "$(dirname "$0")/../.."

TOOLS="node_modules/.cache/provibe-3d"
# Feste Versionen, damit ein erneuter Lauf dieselben Dateien erzeugt.
PACKAGES=(
  "@gltf-transform/core@4.5.1"
  "@gltf-transform/extensions@4.5.1"
  "@gltf-transform/functions@4.5.1"
  "meshoptimizer@1.3.0"
  "sharp@0.35.5"
)
STAMP="$TOOLS/.versions"

if [[ ! -f "$STAMP" || "$(cat "$STAMP")" != "${PACKAGES[*]}" ]]; then
  echo "Installiere Werkzeuge nach $TOOLS"
  mkdir -p "$TOOLS"
  # Eigenes package.json, damit npm nicht im Projekt-Workspace installiert.
  echo '{ "name": "provibe-3d-tools", "private": true, "type": "module" }' > "$TOOLS/package.json"
  npm install --prefix "$TOOLS" --no-audit --no-fund --no-save "${PACKAGES[@]}"
  echo "${PACKAGES[*]}" > "$STAMP"
fi

# Das Skript muss neben seinen Abhängigkeiten liegen, sonst findet Node sie nicht.
cp scripts/3d/prepare-can.mjs "$TOOLS/prepare-can.mjs"

# Je Sorte aus dem Original beide Varianten erzeugen.
for sorte in wildberry peach raspberry-lime; do
  quelle="assets/source/3d/$sorte.glb"
  node "$TOOLS/prepare-can.mjs" "$quelle" "public/3d/$sorte-2k.glb" 2048 1024
  node "$TOOLS/prepare-can.mjs" "$quelle" "public/3d/$sorte-1k.glb" 1024 512
done

ls -la public/3d
