import Image from "next/image";
import { LogoZoomMotion } from "./LogoZoomMotion";

/**
 * Logo-Zoom (#pvlogo) mit einfliegenden Dosen, Bewegungsidee aus ballaurent.com.
 *
 * 160vh hohe Sektion, innen ein sticky Container über die volle Viewporthöhe.
 * Das Logo wächst mit dem Scrollfortschritt, die beiden Dosen kommen von links und
 * rechts herein. Die PNG-Dosen stehen immer im Server-HTML; sobald die 3D-Szene läuft
 * (html[data-tier="3d"]), werden sie ausgeblendet und die Szene übernimmt.
 */
export function LogoZoom() {
  return (
    <section id="pvlogo" className="pvlogo">
      <div className="pvlogo-sticky">
        <Image
          src="/images/cans/wildberry.webp"
          alt=""
          aria-hidden="true"
          width={750}
          height={1400}
          sizes="(min-width: 861px) 18vw, 28vw"
          className="pvlogo-can pvlogo-can--left"
        />

        <Image
          src="/images/brand/logo-wine.png"
          alt="provibe"
          width={1000}
          height={297}
          sizes="(min-width: 1100px) 680px, 62vw"
          className="pvlogo-img"
        />

        <Image
          src="/images/cans/peach.webp"
          alt=""
          aria-hidden="true"
          width={405}
          height={760}
          sizes="(min-width: 861px) 18vw, 28vw"
          className="pvlogo-can pvlogo-can--right"
        />
      </div>

      <LogoZoomMotion />
    </section>
  );
}

export default LogoZoom;
