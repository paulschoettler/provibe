import fs from "node:fs";
import path from "node:path";
import { Eyebrow } from "./Decor";
import { FounderVideoPlayer, type VideoSource } from "./FounderVideoPlayer";

/**
 * Video-Slot auf "Über uns". Rendert nur, wenn die Datei im Repo liegt, sonst nichts.
 *
 * Ablage (siehe docs/handbuch.md, Abschnitt "Video auf Über uns"):
 *   public/videos/ueber-uns.mp4   H.264 (MP4), AAC-Ton, höchstens 1080p, unter 15 MB
 *   public/videos/ueber-uns.webm  optional zusätzlich (VP9), wird dann zuerst angeboten
 * Eine .mov vom Telefon vorher umwandeln, zum Beispiel:
 *   ffmpeg -i celine.mov -vf "scale='min(1080,iw)':-2" -c:v libx264 -crf 24 -preset slow \
 *     -profile:v high -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ueber-uns.mp4
 *
 * Die Prüfung läuft beim Rendern auf dem Server, also im Build und bei jeder stündlichen
 * Erneuerung. Die Pfade sind feste Zeichenketten, damit das Build-Tracing die Datei mit in die
 * Server-Funktion übernimmt; so sieht auch die Erneuerung auf Netlify dieselbe Datei.
 */

/** Seitenverhältnis des gelieferten Videos. Hochkant vom Telefon ist am wahrscheinlichsten. */
const FORMAT: "hoch" | "quer" = "hoch";
const POSTER = "/images/team/celine.jpg";

function videoSources(): VideoSource[] {
  const list: VideoSource[] = [];
  if (fs.existsSync(path.join(process.cwd(), "public/videos/ueber-uns.webm"))) {
    list.push({ src: "/videos/ueber-uns.webm", type: "video/webm" });
  }
  if (fs.existsSync(path.join(process.cwd(), "public/videos/ueber-uns.mp4"))) {
    list.push({ src: "/videos/ueber-uns.mp4", type: "video/mp4" });
  }
  return list;
}

export function FounderVideo({ founder }: { founder: string }) {
  const sources = videoSources();
  if (sources.length === 0) return null;
  return (
    <section
      className={`pv-container pv-founder-video pv-founder-video--${FORMAT}`}
      aria-labelledby="video-titel"
    >
      <div className="pv-founder-video-head" data-pv-reveal="">
        <Eyebrow>Im Video</Eyebrow>
        <h2 id="video-titel" className="pv-h2">
          {founder} und provibe
        </h2>
      </div>
      <div data-pv-reveal="">
        <FounderVideoPlayer
          sources={sources}
          poster={POSTER}
          label={`Video mit ${founder}, Gründerin von provibe`}
        />
      </div>
    </section>
  );
}

export default FounderVideo;
