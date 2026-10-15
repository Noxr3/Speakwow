import type { PersonaSummary, TeacherMotif } from '@speakwow/shared';

/**
 * A teacher's card as an animated SVG: two slow glows in the teacher's
 * colours, and in the middle a moving voiceprint that is theirs alone (Frank's
 * equaliser, Nora's vibrating strings, Max's ripples). Name and one tag, no
 * other text. No photos: a teacher is an AI and never poses as a real person.
 *
 * SVG animations keep playing inside an <img>, so the React Bits carousel
 * shows them unchanged. Pure string building: no canvas, no fonts to wait for.
 */

export const CARD_WIDTH = 460;
export const CARD_HEIGHT = 640;
const CX = CARD_WIDTH / 2;
const CY = 262;

/** Deterministic PRNG so a teacher's card never changes between visits. */
function seeded(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function xml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Draw = (rand: () => number) => { css: string; svg: string };

const MOTIFS: Record<TeacherMotif, Draw> = {
  // Frank: a mirrored equaliser, bars talking over each other.
  bars: (rand) => {
    const n = 17;
    const svg = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const h = 40 + 150 * Math.sin(Math.PI * t) ** 1.2 * (0.6 + rand() * 0.4);
      const x = CX + (i - (n - 1) / 2) * 17 - 4.5;
      const style = `transform-origin:${r1(x + 4.5)}px ${CY}px;animation:eq ${r1(0.7 + rand() * 0.7)}s ease-in-out ${r1(-rand())}s infinite alternate`;
      return `<rect x="${r1(x)}" y="${r1(CY - h / 2)}" width="9" height="${r1(h)}" rx="4.5" fill="url(#ink)" style="${style}"/>`;
    }).join('');
    return { css: '@keyframes eq{from{transform:scaleY(.22)}to{transform:scaleY(1)}}', svg };
  },
  // Lucy: one precise, elegant line.
  wave: (rand) => {
    const path = (amp: number, phase: number) => {
      const pts = Array.from({ length: 41 }, (_, i) => {
        const x = 60 + i * 8.5;
        const env = Math.sin((Math.PI * i) / 40);
        return `${i ? 'L' : 'M'}${r1(x)},${r1(CY + Math.sin(i * 0.42 + phase) * amp * env)}`;
      });
      return pts.join(' ');
    };
    const p0 = rand() * 6;
    const values = [path(70, p0), path(30, p0 + 1.8), path(80, p0 + 3.4), path(70, p0)].join(';');
    const values2 = [path(35, p0 + 1), path(60, p0 + 2.6), path(20, p0 + 4), path(35, p0 + 1)].join(
      ';'
    );
    return {
      css: '',
      svg: `<path fill="none" stroke="url(#inkH)" stroke-width="5" stroke-linecap="round"><animate attributeName="d" dur="3.2s" repeatCount="indefinite" values="${values}" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/></path><path fill="none" stroke="url(#inkH)" stroke-width="2" opacity=".55"><animate attributeName="d" dur="4.1s" repeatCount="indefinite" values="${values2}"/></path>`,
    };
  },
  // Lily: soft rings breathing out, gentle and slow.
  rings: () => ({
    css: '@keyframes ring{0%,100%{transform:scale(.88);opacity:.35}50%{transform:scale(1.06);opacity:1}}',
    svg: [28, 52, 76, 100, 124]
      .map(
        (r, i) =>
          `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="url(#ink)" stroke-width="${6 - i}" style="transform-origin:${CX}px ${CY}px;animation:ring 3.6s ease-in-out ${r1(-i * 0.45)}s infinite"/>`
      )
      .join(''),
  }),
  // Leo: a calm dot matrix, a wave passing through it.
  dots: () => {
    const cols = 13;
    const rows = 7;
    let svg = '';
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = CX + (c - (cols - 1) / 2) * 24;
        const y = CY + (r - (rows - 1) / 2) * 24;
        const delay = -(c * 0.12 + Math.abs(r - 3) * 0.08);
        svg += `<circle cx="${x}" cy="${y}" r="5" fill="url(#ink)" style="transform-origin:${x}px ${y}px;animation:dot 1.8s ease-in-out ${r1(delay)}s infinite"/>`;
      }
    }
    return {
      css: '@keyframes dot{0%,100%{transform:scale(.35);opacity:.25}50%{transform:scale(1);opacity:1}}',
      svg,
    };
  },
  // Kai: chunky game-console pixels, an 8-bit equaliser.
  pixels: (rand) => {
    const cols = 9;
    const rows = 8;
    let svg = '';
    for (let c = 0; c < cols; c++) {
      const speed = r1(0.6 + rand() * 0.8);
      const offset = r1(-rand() * 2);
      for (let r = 0; r < rows; r++) {
        const x = CX + (c - (cols - 1) / 2) * 26 - 10;
        const y = CY + 100 - r * 26;
        svg += `<rect x="${x}" y="${y}" width="20" height="20" rx="3" fill="${r > 5 ? 'url(#hot)' : 'url(#ink)'}" style="animation:px ${speed}s steps(1) ${r1(offset - r * 0.07)}s infinite alternate;opacity:${r < 2 ? 1 : 0.2}"/>`;
      }
    }
    return { css: '@keyframes px{0%{opacity:.15}50%{opacity:1}100%{opacity:.3}}', svg };
  },
  // Grace: a sunburst, light sweeping slowly round like a lighthouse.
  radial: () => {
    const n = 36;
    const svg = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const [x1, y1] = [CX + Math.cos(a) * 46, CY + Math.sin(a) * 46];
      const [x2, y2] = [
        CX + Math.cos(a) * (i % 2 ? 104 : 124),
        CY + Math.sin(a) * (i % 2 ? 104 : 124),
      ];
      return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="url(#ink)" stroke-width="5" stroke-linecap="round" style="animation:sweep 4.5s linear ${r1((-4.5 * i) / n)}s infinite"/>`;
    }).join('');
    return {
      css: '@keyframes sweep{0%{opacity:1}60%{opacity:.15}100%{opacity:1}}',
      svg: `${svg}<circle cx="${CX}" cy="${CY}" r="18" fill="url(#ink)"/>`,
    };
  },
  // Diego: a flame of heat and colour, always moving.
  flame: (rand) => {
    const blob = (scale: number, jitter: number) => {
      const n = 8;
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = (95 + (rand() - 0.5) * jitter) * scale;
        return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * 1.15];
      });
      // Catmull-Rom to cubic Bezier, closed.
      let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
      for (let i = 0; i < n; i++) {
        const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
      }
      return `${d} Z`;
    };
    const outer = [blob(1, 60), blob(1, 60), blob(1, 60)];
    const inner = [blob(0.55, 50), blob(0.55, 50), blob(0.55, 50)];
    return {
      css: '',
      svg: `<path fill="url(#core)" opacity=".85"><animate attributeName="d" dur="3s" repeatCount="indefinite" values="${[...outer, outer[0]].join(';')}"/></path><path fill="#fff" opacity=".75"><animate attributeName="d" dur="2.2s" repeatCount="indefinite" values="${[...inner, inner[0]].join(';')}"/></path>`,
    };
  },
  // Priya: an atom, electrons on three orbits.
  orbit: () => {
    const orbit = `M${CX - 130},${CY} a130,46 0 1,0 260,0 a130,46 0 1,0 -260,0`;
    const svg = [0, 60, 120]
      .map(
        (deg, i) =>
          `<g transform="rotate(${deg} ${CX} ${CY})"><path d="${orbit}" fill="none" stroke="url(#inkH)" stroke-width="2.5" opacity=".7"/><circle r="9" fill="#fff"><animateMotion dur="${2.4 + i * 0.7}s" repeatCount="indefinite" path="${orbit}"/></circle></g>`
      )
      .join('');
    return {
      css: '@keyframes nuc{0%,100%{transform:scale(.85)}50%{transform:scale(1.15)}}',
      svg: `${svg}<circle cx="${CX}" cy="${CY}" r="22" fill="url(#ink)" style="transform-origin:${CX}px ${CY}px;animation:nuc 1.6s ease-in-out infinite"/>`,
    };
  },
  // Nora: guitar strings, each ringing at its own pitch.
  strings: (rand) => {
    const svg = [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const y = CY - 100 + i * 40;
        const a = 26 - i * 2.5;
        const d = (amp: number) => `M50,${y} Q${CX},${r1(y + amp)} ${CARD_WIDTH - 50},${y}`;
        const values = [d(a), d(-a), d(a * 0.6), d(-a * 0.6), d(a)].join(';');
        return `<path fill="none" stroke="url(#inkH)" stroke-width="${2 + (5 - i) * 0.6}" stroke-linecap="round"><animate attributeName="d" dur="${r1(0.5 + i * 0.12 + rand() * 0.2)}s" repeatCount="indefinite" values="${values}"/></path>`;
      })
      .join('');
    return { css: '', svg };
  },
  // Max: ripples spreading across calm water.
  ripple: () => ({
    css: '@keyframes rip{0%{transform:scale(.15);opacity:1}100%{transform:scale(1);opacity:0}}',
    svg:
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<circle cx="${CX}" cy="${CY}" r="140" fill="none" stroke="url(#ink)" stroke-width="5" style="transform-origin:${CX}px ${CY}px;animation:rip 4s ease-out ${-i}s infinite"/>`
        )
        .join('') + `<circle cx="${CX}" cy="${CY}" r="12" fill="#fff"/>`,
  }),
};

export function teacherCardSvg(persona: PersonaSummary): string {
  const [a, b] = persona.colors;
  const rand = seeded(persona.id);
  const motif = (MOTIFS[persona.motif] ?? MOTIFS.bars)(rand);
  const name = xml(persona.display_name.toUpperCase());
  const tag = xml(persona.specialty_en.toUpperCase());

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
<defs>
<radialGradient id="ga"><stop offset="0" stop-color="${a}" stop-opacity=".9"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
<radialGradient id="gb"><stop offset="0" stop-color="${b}" stop-opacity=".8"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>
<radialGradient id="core"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient>
<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="inkH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${b}"/></linearGradient>
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<style>
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(36px,-28px)}}
@keyframes breathe{0%,100%{opacity:.5}50%{opacity:1}}
.g1{animation:drift 9s ease-in-out infinite,breathe 5s ease-in-out infinite}
.g2{animation:drift 12s ease-in-out -4s infinite reverse,breathe 7s ease-in-out -2s infinite}
${motif.css}
text{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#050607"/>
<circle class="g1" cx="120" cy="190" r="250" fill="url(#ga)"/>
<circle class="g2" cx="350" cy="430" r="270" fill="url(#gb)"/>
<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#050607" opacity=".35"/>
<g filter="url(#glow)">${motif.svg}</g>
<text x="36" y="548" font-size="56" font-weight="700" fill="#fff" letter-spacing="3">${name}</text>
<text x="38" y="588" font-size="16" fill="${a}" letter-spacing="3">${tag}</text>
</svg>`;
}

export function teacherCardUrl(persona: PersonaSummary): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(teacherCardSvg(persona))}`;
}
