import type { ReactElement, ReactNode } from "react";

/**
 * Frucht-Sticker für den Hero (Richtung A): flache Vektorillustrationen mit
 * 2,5 px Aubergine-Kontur, Blätter in Creme. Selbst gezeichnet, keine Bilder.
 * Die Kontur bleibt dank non-scaling-stroke bei jeder Größe 2,5 px breit.
 *
 * Farben sind die Marken-Tokens aus globals.css (@theme). Sie stehen hier als
 * Werte, weil Tailwind ungenutzte Theme-Variablen nicht als CSS-Variablen
 * ausgibt und die SVGs sonst ohne Füllung blieben.
 */

const C = {
  aubergine: "#4a2f39",
  berry: "#702249",
  cream: "#fbf8ee",
  butter: "#f3eda4",
  yellow: "#e4df6a",
  pink: "#e98ab0",
  pinkLight: "#f7dceb",
  magenta: "#d9306e",
  mauve: "#b5578c",
  peach: "#f7ca99",
  peachAccent: "#d97a3a",
} as const;

/** Gemeinsame Kontur aller Formen. */
const line = {
  stroke: C.aubergine,
  strokeWidth: 2.5,
  strokeLinejoin: "round",
  strokeLinecap: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function Drupelets({
  points,
  r,
  fill,
  shine,
}: {
  points: Array<[number, number]>;
  r: number;
  fill: string;
  shine: string;
}) {
  return (
    <>
      {points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={r} fill={fill} {...line} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill={shine} />
        </g>
      ))}
    </>
  );
}

export function Brombeere() {
  return (
    <Frame>
      <path d="M32 18C27 9 18 8.5 13 12.5C20 13.5 26 15.5 32 20Z" fill={C.cream} {...line} />
      <path d="M32 18C37 9 46 8.5 51 12.5C44 13.5 38 15.5 32 20Z" fill={C.cream} {...line} />
      <Drupelets
        r={6}
        fill={C.berry}
        shine={C.pink}
        points={[
          [25, 25],
          [32, 24],
          [39, 25],
          [21.5, 33.5],
          [28.5, 33],
          [35.5, 33],
          [42.5, 33.5],
          [25, 41.5],
          [32, 42],
          [39, 41.5],
          [28.5, 49.5],
          [35.5, 49.5],
        ]}
      />
    </Frame>
  );
}

export function Heidelbeere() {
  return (
    <Frame>
      <circle cx="32" cy="35" r="22" fill={C.mauve} {...line} />
      <path
        d="M32 13L33.8 17.6L38.7 17.8L34.9 20.9L36.1 25.7L32 23L27.9 25.7L29.1 20.9L25.3 17.8L30.2 17.6Z"
        fill={C.berry}
        {...line}
      />
      <ellipse
        cx="20.5"
        cy="41"
        rx="3.4"
        ry="6"
        transform="rotate(20 20.5 41)"
        fill={C.pinkLight}
      />
    </Frame>
  );
}

export function Erdbeere() {
  const seeds: Array<[number, number]> = [
    [21, 29],
    [32, 27],
    [43, 29],
    [26.5, 37.5],
    [37.5, 37.5],
    [32, 46.5],
    [17.5, 37],
    [46.5, 37],
  ];
  return (
    <Frame>
      <path
        d="M32 58C15 50 7 34 10 23C12.5 15 23 13.5 32 18C41 13.5 51.5 15 54 23C57 34 49 50 32 58Z"
        fill={C.magenta}
        {...line}
      />
      {seeds.map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.4" ry="2.2" fill={C.cream} />
      ))}
      <path d="M32 19L21 10L29 12L32 3L35 12L43 10L36 18Z" fill={C.cream} {...line} />
    </Frame>
  );
}

export function Himbeere() {
  return (
    <Frame>
      <path d="M23 17C26 10.5 38 10.5 41 17C36.5 15.5 27.5 15.5 23 17Z" fill={C.cream} {...line} />
      <Drupelets
        r={5.6}
        fill={C.magenta}
        shine={C.pinkLight}
        points={[
          [26, 21.5],
          [32, 20.5],
          [38, 21.5],
          [23, 29.5],
          [29, 29],
          [35, 29],
          [41, 29.5],
          [20.5, 37.5],
          [26.5, 37],
          [32, 37],
          [37.5, 37],
          [43.5, 37.5],
          [23.5, 45],
          [29, 45],
          [35, 45],
          [40.5, 45],
          [29, 52],
          [35, 52],
        ]}
      />
    </Frame>
  );
}

export function Limettenscheibe() {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Frame>
      <circle cx="32" cy="32" r="24" fill={C.yellow} {...line} />
      <circle cx="32" cy="32" r="19" fill={C.butter} />
      {spokes.map((angle) => (
        <path
          key={angle}
          d="M32 32V14.5"
          transform={`rotate(${angle} 32 32)`}
          stroke={C.yellow}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ))}
      <circle cx="32" cy="32" r="3" fill={C.cream} {...line} />
    </Frame>
  );
}

export function Limette() {
  return (
    <Frame>
      <path
        d="M10 37C10 24 21 16 33 16.5C46 17 55 26.5 54 37.5C53 49 42 56 30 55C18 54 10 47 10 37Z"
        fill={C.yellow}
        {...line}
      />
      <path d="M53.5 34.5L58 33" {...line} fill="none" />
      <path
        d="M19 41C18 34 22 27 28.5 24.5"
        stroke={C.cream}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M33 16.5C35 9.5 43 6 50 7.5C47 13.5 40 17.5 33 16.5Z" fill={C.cream} {...line} />
    </Frame>
  );
}

export function Pfirsich() {
  return (
    <Frame>
      <path
        d="M32 19C49 14 59 29 56 42C53 55 41 60 32 57C23 60 11 55 8 42C5 29 15 14 32 19Z"
        fill={C.peach}
        {...line}
      />
      <path
        d="M40 25C49 27 53 36 51 43C45 40 41 34 40 25Z"
        fill={C.peachAccent}
        fillOpacity="0.55"
      />
      <path d="M32 21C27.5 33 28.5 46 32 56" fill="none" {...line} />
      <path d="M32 19C30.5 13 31.3 9.5 33.5 6.5" fill="none" {...line} />
      <path d="M33 12C37 4.5 47.5 3 53.5 6C49 13 40 15 33 12Z" fill={C.cream} {...line} />
    </Frame>
  );
}

export function Pfirsichhaelfte() {
  return (
    <Frame>
      <circle cx="32" cy="33" r="22" fill={C.butter} {...line} />
      <circle cx="32" cy="33" r="17" fill={C.peach} />
      <path
        d="M32 22C38 24 39.5 33 35 40.5C30.5 43.5 26 37.5 26 31.5C26 26.5 28.3 22.8 32 22Z"
        fill={C.peachAccent}
        {...line}
      />
    </Frame>
  );
}

type Fruit = () => ReactElement;

/** Drei Sticker je Sorte: oben links, oben rechts, unten. */
const FRUITS: Record<string, [Fruit, Fruit, Fruit]> = {
  wildberry: [Brombeere, Heidelbeere, Erdbeere],
  "raspberry-lime": [Himbeere, Limettenscheibe, Limette],
  peach: [Pfirsich, Pfirsichhaelfte, Pfirsich],
};

export function fruitsFor(slug: string): [Fruit, Fruit, Fruit] {
  return FRUITS[slug] ?? [Heidelbeere, Erdbeere, Pfirsich];
}
