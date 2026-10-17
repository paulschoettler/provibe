"use client";

import { useEffect, useRef, useState } from "react";

export interface VideoSource {
  src: string;
  type: string;
}

/**
 * Player für das Gründerinnen-Video.
 *
 * Ohne JavaScript: natives <video> mit controls, Poster, nichts startet von selbst.
 * Mit JavaScript: eigene Bedienung statt der nativen Leiste. Das Video läuft stumm in Schleife,
 * sobald es zu gut einem Drittel im Bild ist, und hält außerhalb an (spart Akku und Daten).
 * Bei prefers-reduced-motion startet nichts von selbst, ein Play-Button in der Mitte startet es.
 * "Ton" schaltet den Ton um (aria-pressed), "Anhalten/Abspielen" erfüllt WCAG 2.2.2.
 * preload="metadata": Bis zum Start lädt der Browser nur Kopfdaten, die Datei selbst nicht.
 */
export function FounderVideoPlayer({
  sources,
  poster,
  label,
}: {
  sources: VideoSource[];
  poster: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    setEnhanced(true);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => setMuted(video.muted);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolume);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let observer: IntersectionObserver | null = null;
    if (!reduced && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !userPaused.current) {
            video.play().catch(() => undefined);
          } else if (!entry.isIntersecting && !video.paused) {
            video.pause();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(video);
    }

    return () => {
      observer?.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolume);
    };
  }, []);

  const togglePlay = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => undefined);
    } else {
      userPaused.current = true;
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.paused) {
      userPaused.current = false;
      video.play().catch(() => undefined);
    }
  };

  return (
    <div className="pv-video" data-playing={playing ? "true" : "false"}>
      <video
        ref={ref}
        className="pv-video-el"
        poster={poster}
        preload="metadata"
        loop
        muted
        playsInline
        controls={!enhanced}
        aria-label={label}
      >
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
        <p>
          Dein Browser kann dieses Video nicht abspielen.{" "}
          <a href={sources[sources.length - 1].src}>Video herunterladen</a>
        </p>
      </video>

      {enhanced ? (
        <>
          {!playing ? (
            // Große Fläche zum Antippen; für Tastatur und Screenreader steht "Abspielen" in der Leiste.
            <button
              type="button"
              className="pv-video-play"
              onClick={togglePlay}
              aria-hidden="true"
              tabIndex={-1}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
              </svg>
            </button>
          ) : null}
          <div className="pv-video-bar">
            <button type="button" className="pv-video-btn" onClick={togglePlay}>
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
                </svg>
              )}
              <span>{playing ? "Anhalten" : "Abspielen"}</span>
            </button>
            <button
              type="button"
              className="pv-video-btn"
              onClick={toggleSound}
              aria-pressed={!muted}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
                {muted ? (
                  <path
                    d="M15.5 9.5l5 5m0-5l-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : (
                  <path
                    d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </svg>
              <span>Ton</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default FounderVideoPlayer;
