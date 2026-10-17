import fs from "node:fs";
import path from "node:path";
import { FruitSticker } from "@/components/brand/FruitSticker";
import { Blob, Eyebrow } from "./Decor";
import { FounderVideoPlayer, type VideoSource } from "./FounderVideoPlayer";

/**
 * Video von Celine auf "Über uns", gestaltet wie das Porträt darüber: organischer Rahmen mit
 * Blob dahinter, Sticker, schwebende Bedienleiste an der Stelle der Bildunterschrift.
 *
 * Quelle (siehe docs/handbuch.md, Abschnitt "Video auf Über uns"):
 *   1. REMOTE_VIDEO_URL: öffentliche Datei im Supabase-Speicher (Bucket product-media, Ordner
 *      videos). So liegt das Video heute, große Dateien gehören nicht ins Git.
 *   2. Sonst public/videos/ueber-uns.mp4 (H.264, AAC) und optional ueber-uns.webm im Repo.
 * Ohne Quelle rendert die Sektion nichts.
 *
 * Eine .mov vom Telefon vorher umwandeln, zum Beispiel:
 *   ffmpeg -i celine.mov -vf "scale='min(1080,iw)':-2" -c:v libx264 -crf 24 -preset slow \
 *     -profile:v high -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ueber-uns.mp4
 *
 * Die Dateiprüfung läuft beim Rendern auf dem Server, also im Build und bei jeder stündlichen
 * Erneuerung. Die Pfade sind feste Zeichenketten, damit das Build-Tracing die Datei mit in die
 * Server-Funktion übernimmt.
 */

/** Seitenverhältnis des gelieferten Videos: about_video.mp4 ist 1080 × 1920, also hochkant. */
const FORMAT: "hoch" | "quer" = "hoch";
const REMOTE_VIDEO_URL: string =
  "https://ajscwnbgaijknmdrtihn.supabase.co/storage/v1/object/public/product-media/videos/about_video.mp4";
const POSTER = "/images/team/celine.jpg";

function videoSources(): VideoSource[] {
  const list: VideoSource[] = [];
  if (REMOTE_VIDEO_URL) {
    list.push({
      src: REMOTE_VIDEO_URL,
      type: REMOTE_VIDEO_URL.endsWith(".webm") ? "video/webm" : "video/mp4",
    });
    return list;
  }
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
  const firstName = founder.split(" ")[0] || founder;
  return (
    <section
      className={`pv-founder-video pv-founder-video--${FORMAT}`}
      aria-labelledby="video-titel"
    >
      <div className="pv-container pv-founder-video-grid">
        <figure className="pv-founder-video-figure" data-pv-reveal="">
          <Blob name="bild-a" parallax={-18} className="pv-founder-video-blob" />
          <Blob name="zitat" parallax={14} className="pv-founder-video-blob-2" />
          <FounderVideoPlayer
            sources={sources}
            poster={POSTER}
            label={`Video mit ${founder}, Gründerin von provibe`}
          />
          <span className="pv-founder-badge pv-founder-video-badge" aria-hidden="true">
            Im Video
          </span>
          <FruitSticker
            kind="himbeere"
            rotate={14}
            parallax={-16}
            className="right-[-10px] bottom-[48px] w-[60px] lg:right-[-30px] lg:bottom-[60px] lg:w-[80px]"
          />
          <figcaption className="sr-only">{founder}, Gründerin von provibe, im Video</figcaption>
        </figure>
        <div className="pv-founder-video-copy">
          <Eyebrow>Im Video</Eyebrow>
          <h2 id="video-titel" className="pv-h2" data-pv-reveal="">
            {firstName} erzählt, warum es provibe gibt.
          </h2>
          <p className="pv-lead" data-pv-reveal="">
            Ein kurzer Blick hinter die Dose: wie aus der Idee im Studium ein Eistee mit 15 g
            Protein wurde.
          </p>
        </div>
      </div>
    </section>
  );
}

export default FounderVideo;
