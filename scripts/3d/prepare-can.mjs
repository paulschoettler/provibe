// Bereitet ein Original-Dosenmodell (assets/source/3d) für die Auslieferung vor.
//
// Aufruf (über scripts/3d/optimize.sh, das die Werkzeuge bereitstellt):
//   node prepare-can.mjs <quelle.glb> <ziel.glb> <basecolor-px> <metalrough-px>
//
// Warum ein eigenes Skript statt `gltf-transform optimize`:
// 1. Raspberry_Lime.glb liefert die Basecolor als PNG mit Alphakanal. Alles außerhalb
//    des Etiketts (Rand, Deckel, Boden) ist dort transparentes Schwarz. Das Material ist
//    OPAQUE, der Alphakanal zählt also nicht, und Deckel und Boden werden schwarz
//    gerendert. Wildberry und Peach haben an derselben Stelle Weiß. Wir legen die
//    Basecolor deshalb auf Weiß und werfen den Alphakanal weg.
// 2. Die Metal/Roughness-Textur macht das ganze Etikett voll metallisch (Metalness 1)
//    und mit roughnessFactor 1,7 (außerhalb der glTF-Spanne 0 bis 1) recht glatt. Ein
//    voll metallisches Etikett hat keinen diffusen Anteil, es zeigt nur Spiegelungen.
//    Folge: Pfirsiche wirken kupferbraun, dunkle senkrechte Bänder spiegeln die Umgebung.
//    Wir bauen die Textur neu: Der bedruckte Bereich wird lackierte Farbe (wenig
//    Metall, mittlere Rauheit), Deckel, Rand und Boden bleiben blankes Aluminium. Der
//    Faktor 1,7 wird in die Textur eingerechnet, danach stehen beide Faktoren auf 1.
// 3. Texturkoordinaten mit 16 Bit statt der 12 Bit von `optimize`, Normalen mit 12 Bit
//    statt 8 Bit. Das kostet wenige Kilobyte und hält Naht und Lichtkanten sauber.
// 4. Basecolor als WebP mit Qualität 90 und smartSubsample, damit rote Schrift auf
//    Grün keine Farbsäume bekommt. Verkleinert wird mit Lanczos.
//
// Das Skript verändert die Quelle nicht und erzeugt bei gleicher Eingabe dieselbe Datei.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { meshopt, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const [source, target, baseSizeArg, mrSizeArg] = process.argv.slice(2);
if (!source || !target) {
  console.error(
    "Aufruf: node prepare-can.mjs <quelle.glb> <ziel.glb> <basecolor-px> <metalrough-px>",
  );
  process.exit(1);
}
const BASE_SIZE = Number(baseSizeArg ?? 2048);
const MR_SIZE = Number(mrSizeArg ?? 1024);

/** WebP-Qualität der Basecolor. Unter 85 franst die feine Schrift der Rückseite aus. */
const BASE_QUALITY = 90;
/** WebP-Qualität der Metal/Roughness-Textur. Sie ist fast flächig, 90 reicht dicke. */
const MR_QUALITY = 90;

/**
 * Bedruckter Bereich im UV-Layout (v von oben, Anteil der Texturhöhe). Ermittelt aus
 * dem Alphakanal der Raspberry-Lime-Basecolor: deckend von Zeile 96 bis 2173 von 4096.
 * Alle drei Modelle teilen Mesh und UV-Layout. Darüber liegt der blanke Rand an der
 * Öffnung, darunter Boden und Deckel.
 */
const PRINT_V_START = 96 / 4096;
const PRINT_V_END = 2174 / 4096;
/** Weicher Übergang zwischen Druck und blankem Metall, in Anteilen der Texturhöhe. */
const PRINT_FEATHER = 6 / 4096;

/** Metalness der Druckfarbe. Etwas Metall lässt das Aluminium durchschimmern. */
const PRINT_METALNESS = 0.12;
/** Grundrauheit der Druckfarbe (lackiert, seidenmatt). */
const PRINT_ROUGHNESS = 0.38;
/** Anteil der feinen Rauheitsstruktur aus dem Original, die im Druck erhalten bleibt. */
const PRINT_ROUGHNESS_DETAIL = 0.35;
/** roughnessFactor der Quelle, wird in die Textur eingerechnet. */
const SOURCE_ROUGHNESS_FACTOR = 1.7;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

const document = await io.read(source);
const root = document.getRoot();
document.createExtension(EXTTextureWebP).setRequired(true);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 1 im bedruckten Bereich, 0 auf blankem Metall, weich dazwischen. */
function printMask(v) {
  const top = smoothstep(PRINT_V_START - PRINT_FEATHER, PRINT_V_START + PRINT_FEATHER, v);
  const bottom = 1 - smoothstep(PRINT_V_END - PRINT_FEATHER, PRINT_V_END + PRINT_FEATHER, v);
  return Math.min(top, bottom);
}

async function prepareBaseColor(texture) {
  const image = texture.getImage();
  if (!image) throw new Error("Basecolor ohne Bilddaten");
  const output = await sharp(image)
    // Transparentes Schwarz außerhalb des Etiketts wird Weiß, also blankes Aluminium.
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(BASE_SIZE, BASE_SIZE, { kernel: "lanczos3" })
    .webp({ quality: BASE_QUALITY, smartSubsample: true, effort: 6 })
    .toBuffer();
  texture.setImage(output).setMimeType("image/webp").setURI("");
}

async function prepareMetalRough(texture) {
  const image = texture.getImage();
  if (!image) throw new Error("Metal/Roughness ohne Bilddaten");
  // Erst verkleinern, dann rechnen: die Textur ist fast flächig, Details gehen nicht verloren.
  const { data, info } = await sharp(image)
    .removeAlpha()
    .resize(MR_SIZE, MR_SIZE, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const mask = printMask((y + 0.5) / height);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const o = (y * width + x) * 3;
      // glTF: G = Rauheit, B = Metalness. R bleibt ungenutzt (Okklusion steckt nicht drin).
      const metalRoughness = Math.min(1, (data[i + 1] / 255) * SOURCE_ROUGHNESS_FACTOR);
      const metalMetalness = data[i + 2] / 255;
      const detail = metalRoughness - 0.3;
      const printRoughness = PRINT_ROUGHNESS + detail * PRINT_ROUGHNESS_DETAIL;
      const roughness = metalRoughness + (printRoughness - metalRoughness) * mask;
      const metalness = metalMetalness + (PRINT_METALNESS - metalMetalness) * mask;
      out[o] = 255;
      out[o + 1] = Math.round(Math.min(1, Math.max(0, roughness)) * 255);
      out[o + 2] = Math.round(Math.min(1, Math.max(0, metalness)) * 255);
    }
  }
  const output = await sharp(out, { raw: { width, height, channels: 3 } })
    .webp({ quality: MR_QUALITY, effort: 6 })
    .toBuffer();
  texture.setImage(output).setMimeType("image/webp").setURI("");
}

for (const material of root.listMaterials()) {
  const base = material.getBaseColorTexture();
  const metalRough = material.getMetallicRoughnessTexture();
  if (base) await prepareBaseColor(base);
  if (metalRough) await prepareMetalRough(metalRough);
  // Faktoren stecken jetzt in der Textur. 1 ist zugleich der glTF-Standardwert.
  material.setRoughnessFactor(1).setMetallicFactor(1);
}

await document.transform(
  prune(),
  meshopt({
    encoder: MeshoptEncoder,
    // "medium" quantisiert alle Attribute nach den Werten unten und packt sie mit
    // Meshopt. "high" würde die Normalen auf 8 Bit begrenzen.
    level: "medium",
    quantizePosition: 14,
    quantizeNormal: 12,
    quantizeTexcoord: 16,
  }),
);

await io.write(target, document);
