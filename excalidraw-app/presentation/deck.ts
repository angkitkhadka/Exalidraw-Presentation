import { FONT_FAMILY, FRAME_STYLE, ROUNDNESS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  syncInvalidIndices,
} from "@excalidraw/element";

import type {
  FontFamilyValues,
  OrderedExcalidrawElement,
  TextAlign,
} from "@excalidraw/element/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { SLIDE_TRANSITIONS } from "./slides";

import type { SlidePresentationData, SlideTransition } from "./slides";

/**
 * A small, AI-friendly deck format.
 *
 * The point of this module is to let an assistant (or a script) describe a
 * presentation with plain text + a layout name, instead of hand-writing
 * Excalidraw element JSON. `buildDeck` expands the spec into frames (slides)
 * and elements using the real element factories, so text is measured with the
 * actual fonts and everything behaves like hand-drawn content.
 *
 * ```json
 * {
 *   "slides": [
 *     { "layout": "title", "title": "Hello", "subtitle": "World" },
 *     { "layout": "bullets", "title": "Three things", "bullets": ["One", "Two", "Three"] }
 *   ]
 * }
 * ```
 */

export type DeckLayout =
  | "title"
  | "section"
  | "bullets"
  | "split"
  | "stat"
  | "quote"
  | "flow"
  | "end";

export type DeckStat = { value: string; label: string };

export type DeckSlideSpec = {
  layout?: DeckLayout;
  /** small label above the title (also the big number on `section`) */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  /** right-hand card used by `split` */
  panel?: { title?: string; bullets?: string[] };
  /** big numbers used by `stat` */
  stats?: DeckStat[];
  quote?: string;
  cite?: string;
  /** boxes connected by arrows, used by `flow` */
  steps?: string[];
  /** text of the call-to-action pill on `title` / `end` */
  badge?: string;
  /** CSS hex color (#4c6ef5); tints are derived automatically */
  accent?: string;
  transition?: SlideTransition;
  animate?: boolean;
  animateDuration?: number;
  notes?: string;
  /** reveal bullets/steps one by one while presenting */
  reveal?: boolean;
};

export type DeckSpec = {
  title?: string;
  slides: DeckSlideSpec[];
};

const SLIDE_W = 1280;
const SLIDE_H = 720;
const MARGIN = 96;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const COLS = 2;
const COL_GAP = 160;
const ROW_GAP = 140;

const INK = "#111827";
const MUTED = "#4b5563";
const WHITE = "#ffffff";
const LILITA = FONT_FAMILY["Lilita One"];
const NUNITO = FONT_FAMILY.Nunito;

const DEFAULT_ACCENTS = [
  "#4c6ef5",
  "#0ca678",
  "#f76707",
  "#e64980",
  "#7048e8",
  "#1c7ed6",
  "#f59f00",
  "#e03131",
];

const HEX = /^#[0-9a-f]{6}$/i;

const mix = (hex: string, whiteRatio: number) => {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
  return `#${channels
    .map((channel) =>
      Math.round(255 + (channel - 255) * whiteRatio)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

type Palette = { accent: string; soft: string; tint: string };

const paletteFor = (accent: string): Palette => ({
  accent,
  // light stroke, so decorations sketch in without shouting
  soft: mix(accent, 0.45),
  // very light fill
  tint: mix(accent, 0.09),
});

// skeleton helpers

type Ctx = {
  ox: number;
  oy: number;
  index: number;
  palette: Palette;
  prefix: string;
  els: ExcalidrawElementSkeleton[];
  ids: string[];
};

const idFor = (ctx: Ctx, name: string) => `${ctx.prefix}-${name}`;

const add = (ctx: Ctx, element: ExcalidrawElementSkeleton) => {
  ctx.els.push(element);
  const id = (element as { id?: string }).id;
  if (id) {
    ctx.ids.push(id);
  }
  return element;
};

const stepData = (step?: number) =>
  step && step > 1 ? { customData: { presentationStep: step } } : {};

type TextOpts = {
  size?: number;
  font?: FontFamilyValues;
  color?: string;
  align?: TextAlign;
  step?: number;
};

const text = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  value: string,
  opts: TextOpts = {},
) =>
  add(ctx, {
    type: "text",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    text: value,
    fontSize: opts.size ?? 28,
    fontFamily: opts.font ?? NUNITO,
    strokeColor: opts.color ?? INK,
    textAlign: opts.align ?? "left",
    verticalAlign: "top",
    opacity: 100,
    ...stepData(opts.step),
  });

type RectOpts = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  rounded?: boolean;
  label?: string;
  labelSize?: number;
  labelFont?: FontFamilyValues;
  labelColor?: string;
  step?: number;
};

const rect = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: RectOpts = {},
) =>
  add(ctx, {
    type: "rectangle",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    width,
    height,
    strokeColor: opts.stroke ?? "transparent",
    backgroundColor: opts.fill ?? "transparent",
    fillStyle: "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    roughness: 0,
    roundness:
      opts.rounded === false ? null : { type: ROUNDNESS.ADAPTIVE_RADIUS },
    opacity: 100,
    ...(opts.label
      ? {
          label: {
            text: opts.label,
            fontSize: opts.labelSize ?? 24,
            fontFamily: opts.labelFont ?? NUNITO,
            strokeColor: opts.labelColor ?? INK,
          },
        }
      : {}),
    ...stepData(opts.step),
  });

type EllipseOpts = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  step?: number;
};

const ellipse = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: EllipseOpts = {},
) =>
  add(ctx, {
    type: "ellipse",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    width,
    height,
    strokeColor: opts.stroke ?? "transparent",
    backgroundColor: opts.fill ?? "transparent",
    fillStyle: "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    roughness: 0,
    opacity: 100,
    ...stepData(opts.step),
  });

const arrow = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
  step?: number,
) =>
  add(ctx, {
    type: "arrow",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    width: dx,
    height: dy,
    strokeColor: color,
    strokeWidth: 2,
    roughness: 0,
    endArrowhead: "arrow",
    ...stepData(step),
  });

// text helpers

/** Greedy word wrap. Excalidraw text elements have no automatic wrapping. */
const wrap = (value: string, maxChars: number) => {
  const lines: string[] = [];
  for (const paragraph of `${value}`.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= maxChars) {
        line += ` ${word}`;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
};

const lineCount = (value: string) => value.split("\n").length;

/** Vertical rhythm for the text sizes used by the templates. */
const LINE_HEIGHT: Record<number, number> = {
  18: 24,
  20: 26,
  22: 28,
  24: 30,
  26: 34,
  28: 36,
  30: 38,
  34: 44,
  36: 46,
  46: 58,
  56: 70,
  64: 80,
  72: 90,
  96: 118,
  110: 134,
  180: 216,
};

const lh = (size: number) => LINE_HEIGHT[size] ?? Math.round(size * 1.25);

const textBlockHeight = (value: string, size: number) =>
  lineCount(value) * lh(size);

// shared pieces

const slideNumber = (ctx: Ctx) => {
  const p = ctx.palette;
  rect(ctx, "footer-rule", MARGIN, 654, 30, 4, {
    fill: p.soft,
    stroke: p.soft,
    strokeWidth: 1,
  });
  text(
    ctx,
    "footer-number",
    SLIDE_W - MARGIN - 24,
    640,
    String(ctx.index + 1),
    {
      size: 18,
      color: MUTED,
    },
  );
};

const contentDeco = (ctx: Ctx) =>
  ellipse(ctx, "deco", 1080, 520, 280, 280, {
    fill: ctx.palette.tint,
    stroke: ctx.palette.soft,
    strokeWidth: 2,
  });

/** Eyebrow + title + accent rule. Returns the Y coordinate below the rule. */
const header = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;
  let y = 92;

  if (slide.eyebrow) {
    text(ctx, "eyebrow", MARGIN, y, slide.eyebrow.toUpperCase(), {
      size: 24,
      color: p.accent,
      font: LILITA,
    });
    y += 38;
  }

  if (slide.title) {
    const title = wrap(slide.title, 38);
    text(ctx, "title", MARGIN, y, title, {
      size: 56,
      font: LILITA,
      color: INK,
    });
    y += textBlockHeight(title, 56) + 12;
  }

  rect(ctx, "rule", MARGIN, y, 110, 8, {
    fill: p.accent,
    stroke: p.accent,
    strokeWidth: 1,
  });

  return y + 36;
};

const pill = (
  ctx: Ctx,
  x: number,
  y: number,
  label: string,
  accent: string,
) => {
  // size the pill roughly to the label; the label is centered by Excalidraw
  const width = Math.max(220, label.length * 13 + 88);
  rect(ctx, "pill", x, y, width, 64, {
    fill: accent,
    stroke: accent,
    strokeWidth: 1,
    label,
    labelSize: 26,
    labelFont: NUNITO,
    labelColor: WHITE,
  });
};

// layouts

const layoutTitle = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;

  ellipse(ctx, "deco-a", 900, -150, 540, 540, {
    fill: p.tint,
    stroke: p.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "deco-b", 1080, 480, 220, 220, {
    stroke: p.accent,
    strokeWidth: 3,
  });

  if (slide.eyebrow) {
    text(ctx, "eyebrow", MARGIN, 150, slide.eyebrow.toUpperCase(), {
      size: 26,
      font: LILITA,
      color: p.accent,
    });
  }

  const title = wrap(slide.title ?? "Untitled deck", 20);
  text(ctx, "title", MARGIN, 200, title, {
    size: 96,
    font: LILITA,
    color: INK,
  });

  let y = 200 + textBlockHeight(title, 96) + 30;

  if (slide.subtitle) {
    const subtitle = wrap(slide.subtitle, 46);
    text(ctx, "subtitle", MARGIN, y, subtitle, {
      size: 34,
      color: MUTED,
    });
    y += textBlockHeight(subtitle, 34) + 36;
  }

  if (slide.badge) {
    pill(ctx, MARGIN, Math.min(y, 580), slide.badge, p.accent);
  }
};

const layoutSection = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;

  rect(ctx, "card", 64, 64, SLIDE_W - 128, SLIDE_H - 128, {
    fill: p.tint,
    stroke: p.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "deco-a", 930, 130, 240, 240, {
    stroke: p.accent,
    strokeWidth: 3,
  });
  ellipse(ctx, "deco-b", 1030, 320, 120, 120, {
    fill: WHITE,
    stroke: p.soft,
    strokeWidth: 2,
  });

  text(ctx, "number", 120, 120, slide.eyebrow ?? "01", {
    size: 180,
    font: LILITA,
    color: p.accent,
  });
  text(ctx, "label", 130, 372, "SECTION", {
    size: 22,
    font: LILITA,
    color: p.accent,
  });
  text(ctx, "title", 130, 404, wrap(slide.title ?? "", 32), {
    size: 64,
    font: LILITA,
    color: INK,
  });
  if (slide.subtitle) {
    text(ctx, "subtitle", 130, 500, wrap(slide.subtitle, 54), {
      size: 26,
      color: MUTED,
    });
  }
};

const layoutBullets = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;
  contentDeco(ctx);
  let y = header(ctx, slide);

  (slide.bullets ?? []).slice(0, 6).forEach((raw, i) => {
    const step = slide.reveal ? i + 2 : 1;
    const value = wrap(raw, 74);
    const rowHeight = Math.max(56, textBlockHeight(value, 28) + 18);

    rect(ctx, `chip-${i}`, MARGIN, y + 2, 44, 44, {
      fill: p.accent,
      stroke: p.accent,
      strokeWidth: 1,
      label: String(i + 1),
      labelSize: 22,
      labelFont: LILITA,
      labelColor: WHITE,
      step,
    });
    text(ctx, `bullet-${i}`, MARGIN + 68, y + 4, value, {
      size: 28,
      step,
    });

    y += rowHeight + 14;
  });

  slideNumber(ctx);
};

const layoutSplit = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;
  contentDeco(ctx);
  let y = header(ctx, slide);

  (slide.bullets ?? []).slice(0, 5).forEach((raw, i) => {
    const step = slide.reveal ? i + 2 : 1;
    const value = wrap(raw, 42);
    text(ctx, `bullet-${i}`, MARGIN, y, value, { size: 26, step });
    y += textBlockHeight(value, 26) + 22;
  });

  rect(ctx, "panel", 704, 252, 480, 382, {
    fill: p.tint,
    stroke: p.soft,
    strokeWidth: 2,
  });

  if (slide.panel?.title) {
    text(ctx, "panel-title", 744, 288, wrap(slide.panel.title, 28), {
      size: 30,
      font: LILITA,
      color: p.accent,
    });
  }

  let panelY = slide.panel?.title ? 348 : 300;
  (slide.panel?.bullets ?? []).slice(0, 5).forEach((raw, i) => {
    const value = wrap(`•  ${raw}`, 36);
    text(ctx, `panel-bullet-${i}`, 744, panelY, value, {
      size: 22,
      color: INK,
    });
    panelY += textBlockHeight(value, 22) + 18;
  });

  slideNumber(ctx);
};

const layoutStat = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;
  contentDeco(ctx);
  header(ctx, slide);

  const stats = (slide.stats ?? []).slice(0, 3);
  const count = Math.max(stats.length, 1);
  const gap = 28;
  const cardWidth = (CONTENT_W - gap * (count - 1)) / count;

  stats.forEach((stat, i) => {
    const x = MARGIN + i * (cardWidth + gap);
    rect(ctx, `card-${i}`, x, 300, cardWidth, 250, {
      fill: p.tint,
      stroke: p.soft,
      strokeWidth: 2,
    });
    text(ctx, `value-${i}`, x + 32, 336, stat.value, {
      size: stat.value.length > 4 ? 54 : 72,
      font: LILITA,
      color: p.accent,
    });
    text(ctx, `label-${i}`, x + 32, 452, wrap(stat.label, 22), {
      size: 24,
      color: INK,
    });
  });

  if (slide.subtitle) {
    text(ctx, "subtitle", MARGIN, 600, wrap(slide.subtitle, 90), {
      size: 24,
      color: MUTED,
    });
  }

  slideNumber(ctx);
};

const layoutQuote = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;

  ellipse(ctx, "deco-a", 960, -140, 480, 480, {
    fill: p.tint,
    stroke: p.soft,
    strokeWidth: 2,
  });

  text(ctx, "mark", MARGIN, 96, "“", {
    size: 200,
    font: LILITA,
    color: p.soft,
  });

  const quote = wrap(slide.quote ?? "", 44);
  text(ctx, "quote", MARGIN + 40, 280, quote, { size: 46, color: INK });

  if (slide.cite) {
    text(
      ctx,
      "cite",
      MARGIN + 40,
      280 + textBlockHeight(quote, 46) + 34,
      `— ${slide.cite}`,
      { size: 26, color: MUTED },
    );
  }

  slideNumber(ctx);
};

const layoutFlow = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;
  contentDeco(ctx);
  header(ctx, slide);

  const steps = (slide.steps ?? []).slice(0, 5);
  if (!steps.length) {
    return;
  }

  const gap = 46;
  const boxWidth = Math.min(
    206,
    (CONTENT_W - gap * (steps.length - 1)) / steps.length,
  );
  const total = boxWidth * steps.length + gap * (steps.length - 1);
  const startX = MARGIN + (CONTENT_W - total) / 2;
  const boxY = 320;
  const boxHeight = 132;

  steps.forEach((label, i) => {
    const step = slide.reveal ? i + 1 : 1;
    const x = startX + i * (boxWidth + gap);

    rect(ctx, `box-${i}`, x, boxY, boxWidth, boxHeight, {
      fill: p.tint,
      stroke: p.accent,
      strokeWidth: 2,
      label: wrap(label, 16),
      labelSize: 22,
      labelColor: INK,
      step,
    });

    if (i > 0) {
      // a plain straight arrow filling the gap left of this box
      arrow(
        ctx,
        `arrow-${i}`,
        x - gap + 10,
        boxY + boxHeight / 2,
        gap - 20,
        0,
        p.accent,
        step,
      );
    }
  });

  if (slide.subtitle) {
    text(ctx, "subtitle", MARGIN, 540, wrap(slide.subtitle, 88), {
      size: 24,
      color: MUTED,
    });
  }

  slideNumber(ctx);
};

const layoutEnd = (ctx: Ctx, slide: DeckSlideSpec) => {
  const p = ctx.palette;

  ellipse(ctx, "deco-a", 880, 200, 380, 380, {
    fill: p.tint,
    stroke: p.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "deco-b", 1040, 60, 160, 160, {
    stroke: p.accent,
    strokeWidth: 3,
  });

  text(ctx, "title", 140, 220, wrap(slide.title ?? "Thanks!", 18), {
    size: 110,
    font: LILITA,
    color: INK,
  });
  if (slide.subtitle) {
    text(ctx, "subtitle", 140, 400, wrap(slide.subtitle, 48), {
      size: 34,
      color: MUTED,
    });
  }
  if (slide.badge) {
    pill(ctx, 140, 540, slide.badge, p.accent);
  }
};

const LAYOUTS: Record<DeckLayout, (ctx: Ctx, slide: DeckSlideSpec) => void> = {
  title: layoutTitle,
  section: layoutSection,
  bullets: layoutBullets,
  split: layoutSplit,
  stat: layoutStat,
  quote: layoutQuote,
  flow: layoutFlow,
  end: layoutEnd,
};

// spec parsing

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.map(asString).filter((item) => item.length > 0)
    : [];

const asBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : undefined;

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asStats = (value: unknown): DeckStat[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const entry = asObject(item);
        const statValue = asString(entry?.value);
        if (!statValue) {
          return [];
        }
        return [{ value: statValue, label: asString(entry?.label) }];
      })
    : [];

const asPanel = (value: unknown) => {
  const entry = asObject(value);
  if (!entry) {
    return undefined;
  }
  return {
    title: asString(entry.title),
    bullets: asStrings(entry.bullets),
  };
};

const LAYOUT_NAMES = new Set(Object.keys(LAYOUTS));

/**
 * Validates + normalizes a deck spec. Throws a user-facing error when the
 * shape is unusable, so the UI can show it directly.
 */
export const parseDeckSpec = (input: unknown): DeckSpec => {
  const root = asObject(input);
  if (!root) {
    throw new Error("Deck JSON must be an object");
  }
  const rawSlides = root.slides;
  if (!Array.isArray(rawSlides) || !rawSlides.length) {
    throw new Error('Deck JSON needs a non-empty "slides" array');
  }

  const slides = rawSlides.map((raw, index): DeckSlideSpec => {
    const slide = asObject(raw);
    if (!slide) {
      throw new Error(`slides[${index}] must be an object`);
    }
    const layoutName = asString(slide.layout);
    if (layoutName && !LAYOUT_NAMES.has(layoutName)) {
      throw new Error(
        `slides[${index}].layout "${layoutName}" is unknown (use one of: ${[
          ...LAYOUT_NAMES,
        ].join(", ")})`,
      );
    }
    const transition = asString(slide.transition);
    if (
      transition &&
      !SLIDE_TRANSITIONS.includes(transition as SlideTransition)
    ) {
      throw new Error(
        `slides[${index}].transition "${transition}" is unknown (use one of: ${SLIDE_TRANSITIONS.join(
          ", ",
        )})`,
      );
    }

    return {
      layout: (layoutName || "bullets") as DeckLayout,
      eyebrow: asString(slide.eyebrow) || undefined,
      title: asString(slide.title) || undefined,
      subtitle: asString(slide.subtitle) || undefined,
      bullets: asStrings(slide.bullets),
      panel: asPanel(slide.panel),
      stats: asStats(slide.stats),
      quote: asString(slide.quote) || undefined,
      cite: asString(slide.cite) || undefined,
      steps: asStrings(slide.steps),
      badge: asString(slide.badge) || undefined,
      accent: HEX.test(asString(slide.accent))
        ? asString(slide.accent)
        : undefined,
      transition: transition ? (transition as SlideTransition) : undefined,
      animate: asBoolean(slide.animate),
      animateDuration: asNumber(slide.animateDuration),
      notes: asString(slide.notes) || undefined,
      reveal: asBoolean(slide.reveal),
    };
  });

  return {
    title: asString(root.title) || undefined,
    slides,
  };
};

// build

export type BuiltDeck = {
  skeletons: ExcalidrawElementSkeleton[];
  count: number;
};

/**
 * Expands a deck spec into frames + elements. Coordinates are absolute; the
 * deck starts at (`originX`, `originY`) and flows in a 2-column grid so the
 * canvas stays navigable. Reading order (the slide order) is rows then columns.
 */
export const buildDeck = (
  spec: DeckSpec,
  originX = 120,
  originY = 120,
): BuiltDeck => {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const run = Date.now().toString(36);
  const deckPrefix = `deck${run}`;

  spec.slides.forEach((slide, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const ox = originX + col * (SLIDE_W + COL_GAP);
    const oy = originY + row * (SLIDE_H + ROW_GAP);

    const accent =
      slide.accent ?? DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length];
    const ctx: Ctx = {
      ox,
      oy,
      index,
      palette: paletteFor(accent),
      prefix: `${deckPrefix}-s${index}`,
      els: [],
      ids: [],
    };

    (LAYOUTS[slide.layout ?? "bullets"] ?? layoutBullets)(ctx, slide);

    const presentation: SlidePresentationData = {
      ...(slide.transition ? { transition: slide.transition } : {}),
      ...(slide.animate === false ? { animate: false } : {}),
      ...(slide.animateDuration
        ? { animateDuration: slide.animateDuration }
        : {}),
      ...(slide.notes ? { notes: slide.notes } : {}),
    };

    skeletons.push(...ctx.els, {
      type: "frame",
      id: `${deckPrefix}-frame-${index}`,
      x: ox,
      y: oy,
      width: SLIDE_W,
      height: SLIDE_H,
      name: (
        slide.title?.trim() ||
        slide.quote?.trim().slice(0, 48) ||
        `Slide ${index + 1}`
      ).replace(/\s+/g, " "),
      children: ctx.ids,
      strokeColor: FRAME_STYLE.strokeColor,
      strokeWidth: FRAME_STYLE.strokeWidth,
      strokeStyle: FRAME_STYLE.strokeStyle,
      fillStyle: FRAME_STYLE.fillStyle,
      roughness: FRAME_STYLE.roughness,
      roundness: FRAME_STYLE.roundness,
      backgroundColor: FRAME_STYLE.backgroundColor,
      customData: { presentation },
    });
  });

  return { skeletons, count: spec.slides.length };
};

/**
 * Waits for the fonts used by the deck templates before text is measured.
 * Excalidraw stores text dimensions at creation time, so measuring against a
 * fallback font would give wrong widths (clipped bound labels, a too-short
 * typing path in the draw-in).
 */
export const ensureDeckFonts = async (doc?: Document | null) => {
  if (!doc?.fonts) {
    return;
  }
  await doc.fonts.ready;
  await Promise.all([
    doc.fonts.load('32px "Lilita One"'),
    doc.fonts.load("32px Nunito"),
  ]).catch(() => {});
};

/**
 * Compiles the spec and appends the deck below the current scene, then scrolls
 * to the first new slide. Safe to call repeatedly (ids are regenerated).
 */
export const importDeck = (
  api: ExcalidrawImperativeAPI,
  spec: DeckSpec,
): { count: number; frameId: string | null } => {
  const existing = api.getSceneElementsIncludingDeleted();
  const maxY = existing.length
    ? Math.max(...existing.map((element) => element.y + element.height))
    : 0;

  const { skeletons, count } = buildDeck(
    spec,
    120,
    existing.length ? maxY + 260 : 120,
  );
  const created = convertToExcalidrawElements(skeletons);
  const merged = syncInvalidIndices([...existing, ...created]);

  api.updateScene({
    elements: merged as OrderedExcalidrawElement[],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.updateScene({
    appState: {
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    },
  });

  const firstFrame = created.find((element) => element.type === "frame");
  if (firstFrame && firstFrame.type === "frame") {
    api.setViewport({
      target: [
        firstFrame.x,
        firstFrame.y,
        firstFrame.x + firstFrame.width,
        firstFrame.y + firstFrame.height,
      ],
      fit: "scale-down",
      animation: { duration: 420 },
    });
  }

  return { count, frameId: firstFrame?.id ?? null };
};
