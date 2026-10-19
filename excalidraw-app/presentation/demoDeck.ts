import { FONT_FAMILY, FRAME_STYLE, ROUNDNESS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/element";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import { Fonts } from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { FontFamilyValues, TextAlign } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { DEMO_SLIDES, DEMO_TITLE } from "./demoContent";
import { SLIDE_TRANSITIONS } from "./slides";

import type { DemoSlideSpec } from "./demoContent";
import type { SlidePresentationData, SlideTransition } from "./slides";

/**
 * The built-in demo deck.
 *
 * It is a real scene: 100 frames laid out in a grid, each one a slide with
 * its own transition, notes and build steps. Opening it loads the scene into
 * the editor, so it can be presented like any other deck (and it can be
 * copied into a canvas of your own).
 *
 * The design is deliberately restrained: one accent colour, a small type
 * scale and a handful of layouts, so the hundred slides read as one deck.
 */

const SLIDE_W = 1280;
const SLIDE_H = 720;
const MARGIN = 88;
const CONTENT_W = SLIDE_W - MARGIN * 2;

const INK = "#0f172a";
const MUTED = "#5b6b83";
const FAINT = "#9aa8bd";
const ACCENT = "#4f46e5";
const ACCENT_DEEP = "#3730a3";
const SKY = "#0ea5e9";
const SURFACE = "#f6f7fb";
const BORDER = "#e3e8f0";
const WHITE = "#ffffff";

const LILITA = FONT_FAMILY["Lilita One"];
const NUNITO = FONT_FAMILY.Nunito;
const CASCADIA = FONT_FAMILY.Cascadia;

/**
 * Mixes a colour with white. `amount` is how much of the colour is kept, so
 * 0.1 is a very pale tint and 1 is the colour itself.
 */
const mix = (hex: string, amount: number) => {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) =>
    parseInt(value.slice(offset, offset + 2), 16),
  );
  return `#${channels
    .map((channel) =>
      Math.round(255 + (channel - 255) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const palette = {
  accent: ACCENT,
  deep: ACCENT_DEEP,
  sky: SKY,
  ink: INK,
  muted: MUTED,
  faint: FAINT,
  surface: SURFACE,
  border: BORDER,
  white: WHITE,
  /** light stroke, so decorations sketch in without shouting */
  soft: mix(ACCENT, 0.34),
  /** very light fill */
  tint: mix(ACCENT, 0.07),
  /** a slightly stronger fill for cards */
  wash: mix(ACCENT, 0.14),
  skyTint: mix(SKY, 0.07),
};

// ---------------------------------------------------------------------------
// text metrics
// ---------------------------------------------------------------------------

/** Vertical rhythm for the sizes used by the layouts. */
const LINE_HEIGHT: Record<number, number> = {
  16: 22,
  18: 24,
  20: 26,
  22: 28,
  24: 30,
  26: 33,
  28: 36,
  30: 38,
  34: 43,
  36: 46,
  40: 50,
  44: 55,
  48: 60,
  56: 70,
  64: 80,
  72: 90,
  84: 104,
  96: 118,
  120: 146,
  180: 216,
};

const lh = (size: number) => LINE_HEIGHT[size] ?? Math.round(size * 1.26);

/**
 * Wraps `value` so that it fits into `maxWidth` pixels at the given size.
 */
const fit = (
  value: string,
  maxWidth: number,
  size: number,
  font: number = NUNITO,
) => {
  const factor = CHAR_FACTOR[font] ?? 0.5;
  const maxChars = Math.max(8, Math.floor((maxWidth * 0.96) / (size * factor)));
  return wrap(value, maxChars);
};

const lineCount = (value: string) => value.split("\n").length;

const textBlockHeight = (value: string, size: number) =>
  lineCount(value) * lh(size);

/**
 * Average glyph width as a fraction of the font size, per family. Used to
 * turn a pixel budget into a character budget, so text is wrapped against the
 * space it actually has.
 */
const CHAR_FACTOR: Record<number, number> = {
  [NUNITO]: 0.475,
  [LILITA]: 0.505,
  [CASCADIA]: 0.6,
};

/**
 * Greedy word wrap. Excalidraw text elements have no automatic wrapping.
 *
 * The character budget is derived from the pixel width that is available, and
 * a small safety margin is kept, because the exported SVG measures text a
 * fraction of a pixel wider than the canvas does.
 */
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

// ---------------------------------------------------------------------------
// drawing context
// ---------------------------------------------------------------------------

type Ctx = {
  ox: number;
  oy: number;
  index: number;
  section: string;
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
    fontSize: opts.size ?? 26,
    fontFamily: opts.font ?? NUNITO,
    strokeColor: opts.color ?? palette.ink,
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
            strokeColor: opts.labelColor ?? palette.ink,
          },
        }
      : {}),
    ...stepData(opts.step),
  });

type EllipseOpts = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  label?: string;
  labelSize?: number;
  labelFont?: FontFamilyValues;
  labelColor?: string;
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
    ...(opts.label
      ? {
          label: {
            text: opts.label,
            fontSize: opts.labelSize ?? 24,
            fontFamily: opts.labelFont ?? NUNITO,
            strokeColor: opts.labelColor ?? palette.ink,
          },
        }
      : {}),
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

// ---------------------------------------------------------------------------
// shared furniture
// ---------------------------------------------------------------------------

/** Eyebrow + title + accent rule. Returns the Y coordinate below the rule. */
const header = (ctx: Ctx, slide: DemoSlideSpec) => {
  let y = 76;

  if ("eyebrow" in slide && slide.eyebrow) {
    text(ctx, "eyebrow", MARGIN, y, slide.eyebrow.toUpperCase(), {
      size: 20,
      color: palette.accent,
      font: LILITA,
    });
    y += 30;
  }

  if ("title" in slide && slide.title) {
    const title = fit(slide.title, CONTENT_W, 48, LILITA);
    text(ctx, "title", MARGIN, y, title, {
      size: 48,
      font: LILITA,
      color: palette.ink,
    });
    y += textBlockHeight(title, 48) + 14;
  }

  rect(ctx, "rule", MARGIN, y, 88, 6, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });

  return y + 34;
};

const footer = (ctx: Ctx) => {
  rect(ctx, "footer-rule", MARGIN, 646, CONTENT_W, 2, {
    fill: palette.border,
    stroke: palette.border,
    strokeWidth: 1,
  });
  text(ctx, "footer-left", MARGIN, 660, `${DEMO_TITLE}  |  ${ctx.section}`, {
    size: 16,
    color: palette.faint,
  });
  text(ctx, "footer-right", SLIDE_W - MARGIN, 660, String(ctx.index + 1), {
    size: 16,
    color: palette.faint,
    align: "right",
  });
};

/** A soft shape in the corner, so every slide has the same visual anchor. */
const cornerDeco = (ctx: Ctx) => {
  ellipse(ctx, "deco-ring", 1104, -120, 300, 300, {
    stroke: palette.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "deco-dot", 1216, 596, 44, 44, {
    fill: palette.tint,
    stroke: palette.tint,
    strokeWidth: 1,
  });
};

// ---------------------------------------------------------------------------
// layouts
// ---------------------------------------------------------------------------

const layoutCover = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "cover") {
    return;
  }

  ellipse(ctx, "cover-blob", 880, -170, 560, 560, {
    fill: palette.tint,
    stroke: palette.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "cover-ring", 1010, 430, 260, 260, {
    stroke: palette.accent,
    strokeWidth: 3,
  });
  ellipse(ctx, "cover-dot", 1082, 502, 116, 116, {
    fill: palette.wash,
    stroke: palette.soft,
    strokeWidth: 2,
  });

  rect(ctx, "cover-bar", MARGIN, 168, 72, 8, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });

  text(ctx, "cover-eyebrow", MARGIN, 200, "A FIELD GUIDE", {
    size: 22,
    color: palette.accent,
    font: LILITA,
  });

  const title = fit(slide.title, 880, 96, LILITA);
  text(ctx, "cover-title", MARGIN, 246, title, {
    size: 96,
    font: LILITA,
    color: palette.ink,
  });

  const subtitle = fit(slide.subtitle, 820, 30);
  text(
    ctx,
    "cover-subtitle",
    MARGIN,
    246 + textBlockHeight(title, 96) + 26,
    subtitle,
    {
      size: 30,
      color: palette.muted,
    },
  );

  if (slide.badge) {
    const width = Math.max(240, slide.badge.length * 13 + 80);
    rect(ctx, "cover-badge", MARGIN, 552, width, 60, {
      fill: palette.accent,
      stroke: palette.accent,
      strokeWidth: 1,
      label: slide.badge,
      labelSize: 24,
      labelFont: NUNITO,
      labelColor: palette.white,
    });
  }

  text(ctx, "cover-meta", MARGIN, 632, `${DEMO_SLIDES.length} slides`, {
    size: 22,
    color: palette.faint,
  });
};

const layoutAgenda = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "agenda") {
    return;
  }

  const y0 = header(ctx, slide);
  const columnWidth = (CONTENT_W - 56) / 2;
  const perColumn = Math.ceil(slide.items.length / 2);

  slide.items.forEach((item, index) => {
    const column = index < perColumn ? 0 : 1;
    const row = index % perColumn;
    const x = MARGIN + column * (columnWidth + 56);
    const y = y0 + row * 66;

    rect(ctx, `agenda-dot-${index}`, x, y + 4, 34, 34, {
      fill: index % 2 === 0 ? palette.accent : palette.sky,
      stroke: index % 2 === 0 ? palette.accent : palette.sky,
      strokeWidth: 1,
      label: String(index + 1),
      labelSize: 18,
      labelFont: LILITA,
      labelColor: palette.white,
    });

    text(ctx, `agenda-label-${index}`, x + 50, y, item.label, {
      size: 26,
      font: LILITA,
      color: palette.ink,
    });
    text(
      ctx,
      `agenda-detail-${index}`,
      x + 50,
      y + 32,
      fit(item.detail, columnWidth - 50, 18),
      {
        size: 18,
        color: palette.muted,
      },
    );
  });

  footer(ctx);
};

const layoutSection = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "section") {
    return;
  }

  rect(ctx, "section-card", 56, 56, SLIDE_W - 112, SLIDE_H - 112, {
    fill: palette.tint,
    stroke: palette.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "section-ring", 940, 120, 250, 250, {
    stroke: palette.accent,
    strokeWidth: 3,
  });
  ellipse(ctx, "section-dot", 1010, 300, 110, 110, {
    fill: palette.white,
    stroke: palette.soft,
    strokeWidth: 2,
  });

  text(ctx, "section-number", 118, 118, slide.number, {
    size: 150,
    font: LILITA,
    color: palette.accent,
  });
  text(ctx, "section-kicker", 126, 344, "PART", {
    size: 20,
    font: LILITA,
    color: palette.accent,
  });
  text(ctx, "section-title", 126, 372, fit(slide.title, 780, 56, LILITA), {
    size: 56,
    font: LILITA,
    color: palette.ink,
  });
  text(ctx, "section-summary", 126, 452, fit(slide.summary, 860, 24), {
    size: 24,
    color: palette.muted,
  });
};

const layoutBullets = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "bullets") {
    return;
  }

  cornerDeco(ctx);
  let y = header(ctx, slide);

  slide.bullets.forEach((bullet, index) => {
    const step = slide.reveal ? index + 2 : 1;
    const value = fit(bullet.text, CONTENT_W - 36, 26);
    const detail = bullet.detail
      ? fit(bullet.detail, CONTENT_W - 36, 19)
      : null;
    const height =
      textBlockHeight(value, 26) +
      (detail ? textBlockHeight(detail, 19) + 6 : 0);

    ellipse(ctx, `bullet-dot-${index}`, MARGIN + 4, y + 9, 12, 12, {
      fill: palette.accent,
      stroke: palette.accent,
      strokeWidth: 1,
      step,
    });
    text(ctx, `bullet-text-${index}`, MARGIN + 36, y, value, {
      size: 26,
      color: palette.ink,
      step,
    });
    if (detail) {
      text(ctx, `bullet-detail-${index}`, MARGIN + 36, y + lh(26) + 2, detail, {
        size: 19,
        color: palette.muted,
        step,
      });
    }

    y += Math.max(46, height) + 16;
  });

  if (slide.note) {
    rect(ctx, "note-box", MARGIN, 566, CONTENT_W, 56, {
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
    });
    text(
      ctx,
      "note-text",
      MARGIN + 22,
      582,
      fit(slide.note, CONTENT_W - 44, 19),
      {
        size: 19,
        color: palette.muted,
      },
    );
  }

  footer(ctx);
};

const layoutColumns = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "columns") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const gap = 44;
  const columnWidth =
    (CONTENT_W - gap * (slide.columns.length - 1)) / slide.columns.length;

  slide.columns.forEach((column, index) => {
    const x = MARGIN + index * (columnWidth + gap);
    rect(ctx, `column-card-${index}`, x, y0, columnWidth, 380, {
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
    });
    rect(ctx, `column-bar-${index}`, x, y0, columnWidth, 6, {
      fill: index === 0 ? palette.accent : palette.sky,
      stroke: index === 0 ? palette.accent : palette.sky,
      strokeWidth: 1,
    });
    text(
      ctx,
      `column-heading-${index}`,
      x + 24,
      y0 + 28,
      fit(column.heading, columnWidth - 48, 26, LILITA),
      {
        size: 26,
        font: LILITA,
        color: palette.ink,
      },
    );

    let y = y0 + 78;
    column.bullets.forEach((bullet, bulletIndex) => {
      const value = fit(bullet, columnWidth - 72, 21);
      ellipse(ctx, `column-dot-${index}-${bulletIndex}`, x + 26, y + 8, 9, 9, {
        fill: index === 0 ? palette.accent : palette.sky,
        stroke: index === 0 ? palette.accent : palette.sky,
        strokeWidth: 1,
      });
      text(ctx, `column-text-${index}-${bulletIndex}`, x + 48, y, value, {
        size: 21,
        color: palette.muted,
      });
      y += textBlockHeight(value, 21) + 14;
    });
  });

  footer(ctx);
};

const layoutCards = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "cards") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const gap = 32;
  const cardWidth =
    (CONTENT_W - gap * (slide.cards.length - 1)) / slide.cards.length;

  slide.cards.forEach((card, index) => {
    const x = MARGIN + index * (cardWidth + gap);
    rect(ctx, `card-bg-${index}`, x, y0, cardWidth, 360, {
      fill: palette.white,
      stroke: palette.border,
      strokeWidth: 1,
    });
    rect(ctx, `card-accent-${index}`, x, y0, cardWidth, 8, {
      fill: index === 1 ? palette.sky : palette.accent,
      stroke: index === 1 ? palette.sky : palette.accent,
      strokeWidth: 1,
    });
    ellipse(ctx, `card-badge-${index}`, x + 26, y0 + 40, 44, 44, {
      fill: palette.tint,
      stroke: palette.tint,
      strokeWidth: 1,
      label: String(index + 1),
      labelSize: 20,
      labelFont: LILITA,
      labelColor: palette.accent,
    });
    text(
      ctx,
      `card-title-${index}`,
      x + 26,
      y0 + 108,
      fit(card.title, cardWidth - 52, 27, LILITA),
      {
        size: 27,
        font: LILITA,
        color: palette.ink,
      },
    );
    text(
      ctx,
      `card-body-${index}`,
      x + 26,
      y0 + 168,
      fit(card.body, cardWidth - 52, 20),
      {
        size: 20,
        color: palette.muted,
      },
    );
  });

  footer(ctx);
};

const layoutStats = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "stats") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const gap = 36;
  const columnWidth =
    (CONTENT_W - gap * (slide.stats.length - 1)) / slide.stats.length;

  slide.stats.forEach((stat, index) => {
    const x = MARGIN + index * (columnWidth + gap);
    rect(ctx, `stat-card-${index}`, x, y0, columnWidth, 260, {
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
    });
    text(ctx, `stat-value-${index}`, x + columnWidth / 2, y0 + 46, stat.value, {
      size: 72,
      font: LILITA,
      color: index === 1 ? palette.sky : palette.accent,
      align: "center",
    });
    text(
      ctx,
      `stat-label-${index}`,
      x + columnWidth / 2,
      y0 + 150,
      fit(stat.label, columnWidth - 40, 20),
      {
        size: 20,
        color: palette.muted,
        align: "center",
      },
    );
  });

  if (slide.note) {
    text(ctx, "stat-note", MARGIN, y0 + 300, fit(slide.note, CONTENT_W, 20), {
      size: 20,
      color: palette.muted,
    });
  }

  footer(ctx);
};

const layoutFlow = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "flow") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const count = slide.steps.length;
  const arrowSpace = 42;
  const boxWidth = (CONTENT_W - arrowSpace * (count - 1)) / Math.max(1, count);
  const boxHeight = 200;
  const boxY = y0 + 70;

  slide.steps.forEach((step, index) => {
    const x = MARGIN + index * (boxWidth + arrowSpace);
    rect(ctx, `flow-box-${index}`, x, boxY, boxWidth, boxHeight, {
      fill: index % 2 === 0 ? palette.tint : palette.skyTint,
      stroke: index % 2 === 0 ? palette.soft : palette.sky,
      strokeWidth: 2,
    });
    rect(ctx, `flow-chip-${index}`, x + 20, boxY + 22, 34, 34, {
      fill: index % 2 === 0 ? palette.accent : palette.sky,
      stroke: index % 2 === 0 ? palette.accent : palette.sky,
      strokeWidth: 1,
      label: String(index + 1),
      labelSize: 18,
      labelFont: LILITA,
      labelColor: palette.white,
    });
    text(
      ctx,
      `flow-text-${index}`,
      x + 20,
      boxY + 78,
      fit(step, boxWidth - 40, 21),
      {
        size: 21,
        color: palette.ink,
      },
    );

    if (index < count - 1) {
      arrow(
        ctx,
        `flow-arrow-${index}`,
        x + boxWidth + 8,
        boxY + boxHeight / 2,
        arrowSpace - 16,
        0,
        palette.soft,
      );
    }
  });

  if (slide.note) {
    text(
      ctx,
      "flow-note",
      MARGIN,
      boxY + boxHeight + 40,
      fit(slide.note, CONTENT_W, 20),
      {
        size: 20,
        color: palette.muted,
      },
    );
  }

  footer(ctx);
};

const layoutSteps = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "steps") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const columnWidth = (CONTENT_W - 48) / 2;
  const perColumn = Math.ceil(slide.steps.length / 2);

  slide.steps.forEach((step, index) => {
    const column = index < perColumn ? 0 : 1;
    const row = index % perColumn;
    const x = MARGIN + column * (columnWidth + 48);
    const y = y0 + row * 104;

    rect(ctx, `step-num-${index}`, x, y, 40, 40, {
      fill: palette.accent,
      stroke: palette.accent,
      strokeWidth: 1,
      label: String(index + 1),
      labelSize: 20,
      labelFont: LILITA,
      labelColor: palette.white,
    });
    text(
      ctx,
      `step-title-${index}`,
      x + 58,
      y + 1,
      fit(step.title, columnWidth - 58, 24, LILITA),
      {
        size: 24,
        font: LILITA,
        color: palette.ink,
      },
    );
    text(
      ctx,
      `step-body-${index}`,
      x + 58,
      y + 34,
      fit(step.body, columnWidth - 58, 19),
      {
        size: 19,
        color: palette.muted,
      },
    );
  });

  footer(ctx);
};

const layoutQuote = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "quote") {
    return;
  }

  rect(ctx, "quote-panel", 120, 150, SLIDE_W - 240, 420, {
    fill: palette.tint,
    stroke: palette.soft,
    strokeWidth: 2,
  });
  rect(ctx, "quote-bar", 120, 150, 10, 420, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });
  text(ctx, "quote-text", SLIDE_W / 2, 236, fit(slide.quote, 880, 44, LILITA), {
    size: 44,
    font: LILITA,
    color: palette.ink,
    align: "center",
  });
  text(ctx, "quote-cite", SLIDE_W / 2, 480, slide.cite, {
    size: 22,
    color: palette.accent,
    align: "center",
  });
};

const layoutCompare = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "compare") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const gap = 48;
  const columnWidth = (CONTENT_W - gap) / 2;

  [
    { key: "left" as const, panel: slide.left, color: palette.accent },
    { key: "right" as const, panel: slide.right, color: palette.sky },
  ].forEach(({ key, panel, color }, index) => {
    const x = MARGIN + index * (columnWidth + gap);
    rect(ctx, `compare-card-${key}`, x, y0, columnWidth, 330, {
      fill: palette.white,
      stroke: palette.border,
      strokeWidth: 1,
    });
    rect(ctx, `compare-bar-${key}`, x, y0, columnWidth, 8, {
      fill: color,
      stroke: color,
      strokeWidth: 1,
    });
    text(
      ctx,
      `compare-heading-${key}`,
      x + 26,
      y0 + 30,
      fit(panel.heading, columnWidth - 52, 27, LILITA),
      {
        size: 27,
        font: LILITA,
        color,
      },
    );

    let y = y0 + 86;
    panel.bullets.forEach((bullet, bulletIndex) => {
      const value = fit(bullet, columnWidth - 76, 21);
      rect(ctx, `compare-mark-${key}-${bulletIndex}`, x + 26, y + 8, 10, 10, {
        fill: color,
        stroke: color,
        strokeWidth: 1,
      });
      text(ctx, `compare-text-${key}-${bulletIndex}`, x + 50, y, value, {
        size: 21,
        color: palette.muted,
      });
      y += textBlockHeight(value, 21) + 16;
    });
  });

  footer(ctx);
};

const layoutCode = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "code") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const panelHeight = 400;

  rect(ctx, "code-panel", MARGIN, y0, CONTENT_W, panelHeight, {
    fill: palette.surface,
    stroke: palette.border,
    strokeWidth: 1,
  });
  rect(ctx, "code-bar", MARGIN, y0, CONTENT_W, 44, {
    fill: palette.tint,
    stroke: palette.tint,
    strokeWidth: 1,
  });
  ellipse(ctx, "code-dot-a", MARGIN + 22, y0 + 17, 10, 10, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });
  ellipse(ctx, "code-dot-b", MARGIN + 40, y0 + 17, 10, 10, {
    fill: palette.sky,
    stroke: palette.sky,
    strokeWidth: 1,
  });
  text(ctx, "code-lang", MARGIN + CONTENT_W - 24, y0 + 14, slide.language, {
    size: 17,
    color: palette.muted,
    align: "right",
  });

  text(ctx, "code-body", MARGIN + 28, y0 + 68, slide.code, {
    size: 20,
    font: CASCADIA,
    color: palette.ink,
  });

  footer(ctx);
};

const layoutTable = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "table") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);
  const columns = slide.headers.length;
  const columnWidth = CONTENT_W / columns;
  const rowHeight = 58;

  rect(ctx, "table-head", MARGIN, y0, CONTENT_W, 48, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });
  slide.headers.forEach((header, index) => {
    text(
      ctx,
      `table-head-${index}`,
      MARGIN + index * columnWidth + 22,
      y0 + 14,
      header,
      {
        size: 20,
        font: LILITA,
        color: palette.white,
      },
    );
  });

  slide.rows.forEach((row, rowIndex) => {
    const y = y0 + 48 + rowIndex * rowHeight;
    if (rowIndex % 2 === 0) {
      rect(ctx, `table-zebra-${rowIndex}`, MARGIN, y, CONTENT_W, rowHeight, {
        fill: palette.surface,
        stroke: palette.surface,
        strokeWidth: 1,
      });
    }
    rect(
      ctx,
      `table-line-${rowIndex}`,
      MARGIN,
      y + rowHeight - 2,
      CONTENT_W,
      1,
      {
        fill: palette.border,
        stroke: palette.border,
        strokeWidth: 1,
      },
    );
    row.forEach((cell, index) => {
      text(
        ctx,
        `table-cell-${rowIndex}-${index}`,
        MARGIN + index * columnWidth + 22,
        y + 17,
        fit(cell, CONTENT_W / columns - 44, 19),
        {
          size: 19,
          color: index === 0 ? palette.ink : palette.muted,
        },
      );
    });
  });

  footer(ctx);
};

const layoutTakeaway = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "takeaway") {
    return;
  }

  cornerDeco(ctx);
  const y0 = header(ctx, slide);

  rect(ctx, "takeaway-box", MARGIN, y0, CONTENT_W, 150, {
    fill: palette.tint,
    stroke: palette.soft,
    strokeWidth: 2,
  });
  rect(ctx, "takeaway-bar", MARGIN, y0, 8, 150, {
    fill: palette.accent,
    stroke: palette.accent,
    strokeWidth: 1,
  });
  text(
    ctx,
    "takeaway-body",
    MARGIN + 34,
    y0 + 30,
    fit(slide.body, CONTENT_W - 68, 27),
    {
      size: 27,
      color: palette.ink,
    },
  );

  if (slide.points?.length) {
    const gap = 34;
    const columnWidth =
      (CONTENT_W - gap * (slide.points.length - 1)) / slide.points.length;
    slide.points.forEach((point, index) => {
      const x = MARGIN + index * (columnWidth + gap);
      rect(ctx, `takeaway-card-${index}`, x, y0 + 190, columnWidth, 220, {
        fill: palette.white,
        stroke: palette.border,
        strokeWidth: 1,
      });
      ellipse(ctx, `takeaway-dot-${index}`, x + 24, y0 + 214, 12, 12, {
        fill: index === 1 ? palette.sky : palette.accent,
        stroke: index === 1 ? palette.sky : palette.accent,
        strokeWidth: 1,
      });
      text(
        ctx,
        `takeaway-text-${index}`,
        x + 24,
        y0 + 244,
        fit(point, columnWidth - 48, 20),
        {
          size: 20,
          color: palette.muted,
        },
      );
    });
  }

  footer(ctx);
};

const layoutEnd = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "end") {
    return;
  }

  ellipse(ctx, "end-blob", 920, -200, 520, 520, {
    fill: palette.tint,
    stroke: palette.soft,
    strokeWidth: 2,
  });
  ellipse(ctx, "end-ring", 1080, 60, 200, 200, {
    stroke: palette.accent,
    strokeWidth: 3,
  });

  text(ctx, "end-kicker", MARGIN, 168, "END OF DECK", {
    size: 22,
    color: palette.accent,
    font: LILITA,
  });
  text(ctx, "end-title", MARGIN, 210, fit(slide.title, 800, 72, LILITA), {
    size: 72,
    font: LILITA,
    color: palette.ink,
  });
  text(ctx, "end-subtitle", MARGIN, 320, fit(slide.subtitle, 840, 26), {
    size: 26,
    color: palette.muted,
  });

  const gap = 32;
  const columnWidth =
    (CONTENT_W - gap * (slide.links.length - 1)) / slide.links.length;
  slide.links.forEach((link, index) => {
    const x = MARGIN + index * (columnWidth + gap);
    rect(ctx, `end-card-${index}`, x, 440, columnWidth, 160, {
      fill: palette.surface,
      stroke: palette.border,
      strokeWidth: 1,
    });
    text(
      ctx,
      `end-link-${index}`,
      x + 24,
      466,
      fit(link.label, columnWidth - 48, 23, LILITA),
      {
        size: 23,
        font: LILITA,
        color: palette.accent,
      },
    );
    text(
      ctx,
      `end-detail-${index}`,
      x + 24,
      508,
      fit(link.detail, columnWidth - 48, 18),
      {
        size: 18,
        color: palette.muted,
      },
    );
  });
};

const LAYOUTS: Record<string, (ctx: Ctx, slide: DemoSlideSpec) => void> = {
  cover: layoutCover,
  agenda: layoutAgenda,
  section: layoutSection,
  bullets: layoutBullets,
  columns: layoutColumns,
  cards: layoutCards,
  stats: layoutStats,
  flow: layoutFlow,
  steps: layoutSteps,
  quote: layoutQuote,
  compare: layoutCompare,
  code: layoutCode,
  table: layoutTable,
  takeaway: layoutTakeaway,
  end: layoutEnd,
};

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

const COLS = 2;
const COL_GAP = 140;
const ROW_GAP = 120;

export type BuiltDemo = {
  skeletons: ExcalidrawElementSkeleton[];
  count: number;
};

/**
 * Expands the demo content into frames and elements, laid out in a grid.
 */
export const buildDemo = (): BuiltDemo => {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const prefix = "demo";

  // the footer shows the part a slide belongs to, which is the most recent
  // section slide before it
  let currentSection = "Overview";

  DEMO_SLIDES.forEach((slide, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const ox = 120 + col * (SLIDE_W + COL_GAP);
    const oy = 120 + row * (SLIDE_H + ROW_GAP);

    if (slide.kind === "section") {
      currentSection = slide.title;
    }

    const ctx: Ctx = {
      ox,
      oy,
      index,
      section: slide.section ?? currentSection,
      prefix: `${prefix}-s${index}`,
      els: [],
      ids: [],
    };

    (LAYOUTS[slide.kind] ?? layoutBullets)(ctx, slide);

    const transition: SlideTransition =
      slide.transition ??
      (slide.kind === "section"
        ? "zoom"
        : slide.kind === "cover" || slide.kind === "end"
        ? "fade"
        : index % 5 === 0
        ? "push"
        : "glide");

    const presentation: SlidePresentationData = {
      transition,
      ...(slide.notes ? { notes: slide.notes } : {}),
    };

    skeletons.push(...ctx.els, {
      type: "frame",
      id: `${prefix}-frame-${index}`,
      x: ox,
      y: oy,
      width: SLIDE_W,
      height: SLIDE_H,
      name: slideTitle(slide),
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

  return { skeletons, count: DEMO_SLIDES.length };
};

const slideTitle = (slide: DemoSlideSpec) => {
  if (slide.kind === "section") {
    return slide.title;
  }
  if ("title" in slide && slide.title) {
    return slide.title;
  }
  if (slide.kind === "quote") {
    return slide.quote.slice(0, 48);
  }
  return `Slide ${DEMO_SLIDES.indexOf(slide) + 1}`;
};

/** Waits for the fonts used by the demo, so text is measured correctly. */
/** the families the demo uses, and a size to probe them with */
const DEMO_FONTS = ['19px "Nunito"', '48px "Lilita One"', '20px "Cascadia"'];

/** the characters the fonts are probed with */
const DEMO_FONT_PROBE = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Waits until a font is actually usable for measuring, so that text boxes are
 * exactly as wide as their content. Resolves to false on timeout, which only
 * means the text is measured with the fallback font.
 */
const waitForFont = async (doc: Document, font: string, timeoutMs = 4000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (doc.fonts.check(font, DEMO_FONT_PROBE)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
};

/**
 * Builds the demo scene and replaces the current one.
 *
 * The scene is never stored, so the demo can neither be deleted nor lost: it
 * is rebuilt from its source every time.
 *
 * Text is measured with the real fonts, which takes two passes. The first
 * pass creates the elements so that the font faces they need can be
 * requested, and the second pass recreates them once the fonts are loaded, so
 * that every text box is exactly as wide as its content.
 */
export const openDemoScene = async (
  api: ExcalidrawImperativeAPI,
  doc?: Document | null,
) => {
  const { skeletons } = buildDemo();
  const ownerDocument = doc ?? null;

  // Text is measured with the fonts that are loaded, so the fonts have to be
  // there before the elements are created. When they already are (which is
  // the case after the first time), one pass is enough.
  const fontsReady = ownerDocument?.fonts
    ? DEMO_FONTS.every((font) =>
        ownerDocument.fonts.check(font, DEMO_FONT_PROBE),
      )
    : false;

  if (!fontsReady && ownerDocument) {
    // The font faces the deck needs are requested from a first pass of the
    // elements. They are not put into the scene: rendering the deck twice
    // would cost more than the measurement does.
    const probe = convertToExcalidrawElements(skeletons);
    try {
      await Fonts.loadElementsFonts(probe, ownerDocument);
      await Promise.all(
        DEMO_FONTS.map((font) => waitForFont(ownerDocument, font)),
      );
    } catch {
      // a font that fails to load only means the text is measured with the
      // fallback font, which is not fatal
    }
  }

  const created = convertToExcalidrawElements(skeletons);

  api.updateScene({
    elements: created,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.updateScene({
    appState: {
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: getNormalizedZoom(1) },
    },
  });

  return created.length;
};

export { DEMO_SLIDES, DEMO_TITLE };
export { SLIDE_TRANSITIONS };
