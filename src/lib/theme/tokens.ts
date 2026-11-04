/**
 * DreamHouse Brand Design Tokens
 *
 * Identity: Minimalist · Architectural · Zen · Sofisticado · Futurista
 * Origin: Colombia — precisión, calma, contraste
 *
 * Palette philosophy:
 *   - Near-black / near-white as canvas (espacio = silencio)
 *   - Acid lime as the sole accent: el detalle que rompe el orden
 *   - Warm stone neutrals: tierra, hormigón, travertino
 *   - Zero decoration; every element earns its space
 */

// ─── Palette ─────────────────────────────────────────────────────────────────

export const palette = {
  // Canvas
  ink: '#050505',       // background dark — casi negro, no muerto
  chalk: '#F7F6F4',     // background light — blanco cálido, como papel trazo

  // Accent — una sola nota de color
  lime: '#D4F200',      // acid yellow-green; futurismo, energía contenida
  limeDim: '#B8D400',   // hover / pressed state

  // Stone neutrals (hormigón, travertino, yeso)
  stone50:  '#FAFAF9',
  stone100: '#F5F4F1',
  stone200: '#E8E6E1',
  stone300: '#D1CEC7',
  stone400: '#A89F94',
  stone500: '#7A7168',
  stone600: '#5C544C',
  stone700: '#3E3830',
  stone800: '#28221C',
  stone900: '#1A1510',

  // Semantic
  error:   '#E53E3E',
  warning: '#D97706',
  success: '#38A169',
  info:    '#3182CE',

  // Transparency
  overlayDark:  'rgba(5, 5, 5, 0.85)',
  overlayLight: 'rgba(247, 246, 244, 0.85)',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const typography = {
  // Font stacks — se definen en layout.tsx via next/font
  fontSans:  'var(--font-instrument), "Helvetica Neue", Arial, sans-serif',
  fontMono:  'var(--font-jetbrains), "JetBrains Mono", "Courier New", monospace',

  // Scale — minor third (1.200) + arquitectura de tamaños
  size: {
    '2xs': '0.75rem',    // 12px  — labels, caps (mínimo legible: nada por debajo de 12px)
    xs:    '0.75rem',    // 12px  — captions, meta
    sm:    '0.875rem',   // 14px  — body small
    base:  '1rem',       // 16px  — body
    md:    '1.125rem',   // 18px  — body large
    lg:    '1.25rem',    // 20px  — lead
    xl:    '1.5rem',     // 24px  — h4
    '2xl': '2rem',       // 32px  — h3
    '3xl': '2.5rem',     // 40px  — h2
    '4xl': '3.5rem',     // 56px  — h1
    '5xl': '5rem',       // 80px  — display
    '6xl': '7.5rem',     // 120px — hero
  },

  weight: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
    black:    900,
  },

  tracking: {
    tightest: '-0.05em',
    tighter:  '-0.03em',
    tight:    '-0.02em',
    normal:   '0em',
    wide:     '0.08em',
    wider:    '0.15em',
    widest:   '0.3em',
    caps:     '0.4em',
  },

  leading: {
    none:    1,
    tight:   1.1,
    snug:    1.25,
    normal:  1.5,
    relaxed: 1.7,
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

/** 8-point grid. All spacing is a multiple of 8px. */
export const spacing = {
  unit: 8,
  // rem values (÷16)
  1:  '0.25rem',  // 4px  — fine gap
  2:  '0.5rem',   // 8px
  3:  '0.75rem',  // 12px
  4:  '1rem',     // 16px
  5:  '1.25rem',  // 20px
  6:  '1.5rem',   // 24px
  8:  '2rem',     // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
  40: '10rem',    // 160px
  48: '12rem',    // 192px
} as const;

// ─── Shape ───────────────────────────────────────────────────────────────────

/** Sharp edges, architectural precision. Zero radius everywhere. */
export const shape = {
  radius: 0,
} as const;

// ─── Elevation / Shadow ──────────────────────────────────────────────────────

/**
 * Flat elevation model — no soft shadows.
 * Depth is expressed through borders and layered offsets.
 */
export const elevation = {
  none:   'none',
  // Architectural offset shadow (hard edge, not diffused)
  xs:     '2px 2px 0px rgba(5,5,5,0.12)',
  sm:     '4px 4px 0px rgba(5,5,5,0.12)',
  md:     '8px 8px 0px rgba(5,5,5,0.10)',
  lg:     '16px 16px 0px rgba(5,5,5,0.08)',
  xl:     '24px 24px 0px rgba(5,5,5,0.06)',
  // Dark mode — subtler
  xsDark: '2px 2px 0px rgba(212,242,0,0.06)',
  smDark: '4px 4px 0px rgba(212,242,0,0.06)',
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────

/** Minimal, deliberate transitions. Zen principle: less movement = more presence. */
export const motion = {
  duration: {
    instant: '0ms',
    fast:    '150ms',
    normal:  '250ms',
    slow:    '400ms',
    slower:  '700ms',
    reveal:  '1200ms',
  },
  easing: {
    standard:    'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate:  'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate:  'cubic-bezier(0.4, 0.0, 1, 1)',
    sharp:       'cubic-bezier(0.4, 0, 0.6, 1)',
    architectural: 'cubic-bezier(0.16, 1, 0.3, 1)', // expo ease-out
  },
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────────────

export const breakpoints = {
  xs:  0,
  sm:  640,
  md:  768,
  lg:  1024,
  xl:  1280,
  '2xl': 1440,
} as const;

// ─── Z-index ─────────────────────────────────────────────────────────────────

export const zIndex = {
  base:    0,
  raised:  10,
  sticky:  100,
  overlay: 200,
  modal:   300,
  toast:   400,
  tooltip: 500,
} as const;

// ─── Brand Meta ──────────────────────────────────────────────────────────────

export const brand = {
  name:    'DreamHouse',
  tagline: 'Where Vision Meets Structure',
  sub:     'Architectural AI Studio',
  origin:  'Bogotá, Colombia',
  year:    '2025',
} as const;
