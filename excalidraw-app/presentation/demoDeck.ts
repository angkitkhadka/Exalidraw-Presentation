import { FONT_FAMILY, FRAME_STYLE, ROUNDNESS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/element";

import { getNormalizedZoom } from "@excalidraw/excalidraw/scene/normalize";

import { Fonts } from "@excalidraw/excalidraw";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { FontFamilyValues, TextAlign } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { LocalPoint } from "@excalidraw/math";

import { DEMO_SLIDES, DEMO_TITLE } from "./demoContent";
import { SLIDE_TRANSITIONS } from "./slides";

import type { DemoSlideSpec } from "./demoContent";
import type { SlidePresentationData, SlideTransition } from "./slides";

/**
 * The built-in demo deck.
 *
 * It is a real scene: one frame per slide, laid out in a grid, each frame
 * carrying its own transition, notes and reveal steps. Opening it loads the
 * scene into the editor, so it can be presented like any other deck, and it
 * can be downloaded as a normal `.excalidraw` file.
 *
 * The design follows `DECK-RULES.md`:
 *
 * - One type treatment. Nunito carries every label, Cascadia is reserved
 *   for code, because a protocol transcript is a different kind of text.
 * - No accent bars under titles and no capitalised eyebrow labels. A title
 *   sits on the page and the whitespace below it does the separating.
 * - No rounded cards, no numbered circles, no grid of statistics. Content
 *   is set as text, and where a shape is needed it is a hairline rule or a
 *   square block.
 * - The slides take different forms: a statement, a diagram, a table, a
 *   chart, a comparison, a quote, a number, code. Consecutive slides rarely
 *   use the same one.
 */

const SLIDE_W = 1280;
const SLIDE_H = 720;
const MARGIN = 88;
const CONTENT_W = SLIDE_W - MARGIN * 2;

/**
 * The colour scheme the whole project uses, from `excalidraw-app/colors.md`.
 *
 * - the dark blue backs the cover, the dividers and the closing slide
 * - white backs the content slides, and is the text colour on the dark ones
 * - the logo blue is the colour of the slide titles
 * - the bright blue is for emphasis and for the marks in a diagram
 * - near-black is the body colour
 * - the light grey fills code blocks and table headers
 * - the border grey draws rules, axes and dividers
 * - orange and teal are the second and third diagram colours
 * - red is only used for errors
 */
const DARK = "#142636";
const WHITE = "#ffffff";
const LOGO = "#00549f";
const ACCENT = "#00a1de";
const INK = "#121619";
const SURFACE = "#f8f9fb";
const BORDER = "#c1c7cd";
const ORANGE = "#ffab87";
const TEAL = "#6ec0c0";
const RED = "#d85a77";

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
  /** the dark blue, for the cover, divider and closing slides */
  dark: DARK,
  white: WHITE,
  /** the logo blue, for the slide titles */
  title: LOGO,
  /** the bright blue, for emphasis and diagram marks */
  accent: ACCENT,
  /** the body colour */
  ink: INK,
  /** secondary text */
  muted: mix(INK, 0.45),
  /** the faintest text, the footer and the source line */
  faint: mix(INK, 0.32),
  /** code and table header fills */
  surface: SURFACE,
  /** rules, axes and dividers */
  border: BORDER,
  /** the second diagram colour */
  orange: ORANGE,
  /** the third diagram colour */
  teal: TEAL,
  /** only for errors */
  red: RED,
  /** a pale accent, for diagram fills */
  accentTint: mix(ACCENT, 0.12),
  /** the light text used on the dark slides */
  onDark: mix(WHITE, 0.8),
  /** the faintest text on the dark slides */
  onDarkFaint: mix(WHITE, 0.55),
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
  96: 118,
};

const lh = (size: number) => LINE_HEIGHT[size] ?? Math.round(size * 1.26);

/**
 * Average glyph width as a fraction of the font size, per family. Used to
 * turn a pixel budget into a character budget, so text is wrapped against
 * the space it actually has.
 */
const CHAR_FACTOR: Record<number, number> = {
  [NUNITO]: 0.475,
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
  /** true on the dark slides, where the text colours flip */
  dark: boolean;
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
  label?: string;
  labelSize?: number;
  labelFont?: FontFamilyValues;
  labelColor?: string;
  step?: number;
  /** square corners, for the blocks that are not cards */
  square?: boolean;
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
    roundness: opts.square ? null : { type: ROUNDNESS.ADAPTIVE_RADIUS },
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

/** A hairline rule, the only kind of divider the deck uses. */
const rule = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  width: number,
  color: string = palette.border,
  strokeWidth: number = 1,
) =>
  add(ctx, {
    type: "line",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    width,
    height: 0,
    strokeColor: color,
    strokeWidth,
    roughness: 0,
    points: [
      [0, 0],
      [width, 0],
    ] as LocalPoint[],
  });

/** A vertical hairline, for separating two columns. */
const vrule = (
  ctx: Ctx,
  name: string,
  x: number,
  y: number,
  height: number,
  color: string = palette.border,
  strokeWidth: number = 1,
) =>
  add(ctx, {
    type: "line",
    id: idFor(ctx, name),
    x: ctx.ox + x,
    y: ctx.oy + y,
    width: 0,
    height,
    strokeColor: color,
    strokeWidth,
    roughness: 0,
    points: [
      [0, 0],
      [0, height],
    ] as LocalPoint[],
  });

// ---------------------------------------------------------------------------
// shared furniture
// ---------------------------------------------------------------------------

/**
 * The slide title. It sits alone at the top of the slide, with no rule
 * under it and no label above it, and the space below it does the
 * separating.
 */
const header = (ctx: Ctx, title: string) => {
  const value = fit(title, CONTENT_W, 44);
  text(ctx, "title", MARGIN, 76, value, {
    size: 44,
    color: palette.title,
  });
  return 76 + textBlockHeight(value, 44) + 30;
};

/** The footer: the deck name, the part, and the page number. */
const footer = (ctx: Ctx) => {
  const faint = ctx.dark ? palette.onDarkFaint : palette.faint;
  rule(
    ctx,
    "footer-rule",
    MARGIN,
    646,
    CONTENT_W,
    ctx.dark ? mix(WHITE, 0.22) : palette.border,
  );
  text(ctx, "footer-left", MARGIN, 660, `${DEMO_TITLE}  |  ${ctx.section}`, {
    size: 16,
    color: faint,
  });
  text(ctx, "footer-right", SLIDE_W - MARGIN, 660, String(ctx.index + 1), {
    size: 16,
    color: faint,
    align: "right",
  });
};

/** The source line, under a slide that carries a number. */
const source = (ctx: Ctx, value: string) => {
  text(ctx, "source", MARGIN, 606, fit(`Source: ${value}`, CONTENT_W, 16), {
    size: 16,
    color: ctx.dark ? palette.onDarkFaint : palette.faint,
  });
};

/** The dark blue that backs the cover, divider and closing slides. */
const darkBackdrop = (ctx: Ctx) => {
  rect(ctx, "backdrop", 0, 0, SLIDE_W, SLIDE_H, {
    fill: palette.dark,
    stroke: palette.dark,
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

  darkBackdrop(ctx);

  const title = fit(slide.title, CONTENT_W - 120, 72);
  text(ctx, "cover-title", MARGIN, 220, title, {
    size: 72,
    color: palette.white,
  });

  const subtitleY = 220 + textBlockHeight(title, 72) + 40;
  const subtitle = fit(slide.subtitle, CONTENT_W - 200, 28);
  text(ctx, "cover-subtitle", MARGIN, subtitleY, subtitle, {
    size: 28,
    color: palette.onDark,
  });
};

/**
 * A single claim, set large, with nothing else on the slide. The form the
 * rules call a plain sentence.
 */
const layoutStatement = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "statement") {
    return;
  }

  const value = fit(slide.text, CONTENT_W - 60, 44);
  const height = textBlockHeight(value, 44);

  text(ctx, "statement-text", MARGIN, 250, value, {
    size: 44,
    color: palette.ink,
  });

  if (slide.detail) {
    const detail = fit(slide.detail, CONTENT_W - 200, 24);
    text(ctx, "statement-detail", MARGIN, 250 + height + 44, detail, {
      size: 24,
      color: palette.muted,
    });
  }
};

/**
 * A divider. The part number is set in the accent colour, the title in
 * white, and the summary underneath. Nothing else, and no ornament.
 */
const layoutSection = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "section") {
    return;
  }

  darkBackdrop(ctx);

  text(ctx, "section-marker", MARGIN, 250, slide.marker, {
    size: 20,
    color: palette.accent,
  });

  const title = fit(slide.title, CONTENT_W, 56);
  const titleHeight = textBlockHeight(title, 56);

  text(ctx, "section-title", MARGIN, 292, title, {
    size: 56,
    color: palette.white,
  });
  text(
    ctx,
    "section-summary",
    MARGIN,
    292 + titleHeight + 32,
    fit(slide.summary, CONTENT_W - 200, 24),
    {
      size: 24,
      color: palette.onDark,
    },
  );
};

/**
 * Bullets, set as a list of sentences with a small square marker. The
 * marker is a square rather than a circle, and there is no box around the
 * list.
 */
const layoutBullets = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "bullets") {
    return;
  }

  let y = header(ctx, slide.title);

  slide.bullets.forEach((bullet, index) => {
    const step = slide.reveal ? index + 2 : 1;
    const value = fit(bullet, CONTENT_W - 44, 26);
    const height = textBlockHeight(value, 26);

    rect(ctx, `bullet-mark-${index}`, MARGIN + 2, y + 10, 10, 10, {
      fill: palette.accent,
      stroke: palette.accent,
      strokeWidth: 1,
      step,
    });
    text(ctx, `bullet-text-${index}`, MARGIN + 44, y, value, {
      size: 26,
      color: palette.ink,
      step,
    });

    y += height + 26;
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/**
 * A chain of stages, drawn as a diagram: a rule with a marker on each stage,
 * the stage name above it and what it does below. It is not a row of cards.
 */
const layoutDiagram = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "diagram") {
    return;
  }

  const top = header(ctx, slide.title);

  const count = slide.nodes.length;
  const slot = CONTENT_W / count;
  const axisY = top + 74;

  // the line the stages sit on
  rule(ctx, "stage-axis", MARGIN, axisY, CONTENT_W, palette.border, 1);

  slide.nodes.forEach((node, index) => {
    const centre = MARGIN + slot * index + slot / 2;

    // a square marker on the line, and a stem up to the name
    rect(ctx, `stage-mark-${index}`, centre - 7, axisY - 7, 14, 14, {
      fill: index === 0 ? palette.accent : palette.title,
      stroke: index === 0 ? palette.accent : palette.title,
      strokeWidth: 1,
      square: true,
    });
    rule(ctx, `stage-stem-${index}`, centre, axisY - 34, 0, palette.border, 1);

    text(
      ctx,
      `stage-label-${index}`,
      centre - slot / 2 + 12,
      axisY - 76,
      fit(node.label, slot - 24, 26),
      {
        size: 26,
        color: palette.ink,
        align: "center",
      },
    );
    text(
      ctx,
      `stage-body-${index}`,
      centre - slot / 2 + 12,
      axisY + 28,
      fit(node.body, slot - 24, 19),
      {
        size: 19,
        color: palette.muted,
        align: "center",
      },
    );
  });

  footer(ctx);
};

/** A number, large, with a caption under it. */
const layoutNumber = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "number") {
    return;
  }

  header(ctx, slide.title);

  text(ctx, "number-value", MARGIN, 240, slide.value, {
    size: 168,
    color: palette.accent,
  });

  const caption = fit(slide.caption, CONTENT_W - 120, 26);
  text(ctx, "number-caption", MARGIN, 470, caption, {
    size: 26,
    color: palette.ink,
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/**
 * A chart drawn from native shapes, so it can be edited in the editor like
 * anything else on the canvas. The axis starts at zero and the bars are
 * labelled, so the shape of the data is not exaggerated.
 */
const layoutChart = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "chart") {
    return;
  }

  const top = header(ctx, slide.title);

  const plotLeft = MARGIN + 70;
  const plotRight = SLIDE_W - MARGIN;
  const plotWidth = plotRight - plotLeft;
  const plotTop = top + 40;
  const plotBottom = 520;
  const plotHeight = plotBottom - plotTop;

  const max = Math.max(...slide.bars.map((bar) => bar.value));
  // a round maximum, so the gridlines land on readable numbers
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const axisMax = Math.ceil(max / magnitude) * magnitude;

  // the axis and its gridlines
  rule(ctx, "chart-axis", plotLeft, plotTop, 0, palette.border);
  for (let i = 0; i <= 4; i++) {
    const y = plotBottom - (plotHeight * i) / 4;
    rule(ctx, `chart-grid-${i}`, plotLeft, y, plotWidth, palette.border, 1);
    const value = Math.round((axisMax * i) / 4);
    text(ctx, `chart-tick-${i}`, MARGIN, y - 10, String(value), {
      size: 16,
      color: palette.faint,
      align: "right",
    });
  }

  const count = slide.bars.length;
  const slot = plotWidth / count;
  const barWidth = Math.min(150, slot * 0.4);

  slide.bars.forEach((bar, index) => {
    const height = (bar.value / axisMax) * plotHeight;
    const x = plotLeft + slot * index + (slot - barWidth) / 2;
    const y = plotBottom - height;

    rect(ctx, `chart-bar-${index}`, x, y, barWidth, height, {
      fill: index === count - 1 ? palette.accent : palette.title,
      stroke: index === count - 1 ? palette.accent : palette.title,
      strokeWidth: 1,
      square: true,
    });

    text(ctx, `chart-value-${index}`, x, y - 34, String(bar.value), {
      size: 22,
      color: palette.ink,
      align: "center",
    });
    text(
      ctx,
      `chart-label-${index}`,
      plotLeft + slot * index,
      plotBottom + 18,
      fit(bar.label, slot - 20, 18),
      {
        size: 18,
        color: palette.ink,
        align: "center",
      },
    );
    if (bar.note) {
      text(
        ctx,
        `chart-note-${index}`,
        plotLeft + slot * index,
        plotBottom + 44,
        fit(bar.note, slot - 20, 16),
        {
          size: 16,
          color: palette.faint,
          align: "center",
        },
      );
    }
  });

  text(ctx, "chart-axis-label", plotLeft, plotTop - 34, slide.axis, {
    size: 16,
    color: palette.faint,
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/** A table, set with rules rather than a filled header band. */
const layoutTable = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "table") {
    return;
  }

  let y = header(ctx, slide.title);

  const columns = slide.headers.length;
  const firstWidth = 150;
  const rest = (CONTENT_W - firstWidth) / (columns - 1);

  const columnX = (index: number) =>
    index === 0 ? MARGIN : MARGIN + firstWidth + rest * (index - 1);
  const columnWidth = (index: number) => (index === 0 ? firstWidth : rest);

  slide.headers.forEach((headerText, index) => {
    text(
      ctx,
      `table-head-${index}`,
      columnX(index),
      y,
      fit(headerText, columnWidth(index) - 24, 18),
      {
        size: 18,
        color: palette.muted,
      },
    );
  });

  y += 30;
  rule(ctx, "table-rule", MARGIN, y, CONTENT_W, palette.border, 1);
  y += 24;

  slide.rows.forEach((row, rowIndex) => {
    // the row is as tall as its tallest cell, so a cell that wraps does not
    // run into the row below it
    const cells = row.map((cell, index) =>
      fit(cell, columnWidth(index) - 24, 20),
    );
    const height = Math.max(...cells.map((cell) => textBlockHeight(cell, 20)));

    cells.forEach((cell, index) => {
      text(ctx, `table-cell-${rowIndex}-${index}`, columnX(index), y, cell, {
        size: 20,
        color: index === 0 ? palette.ink : palette.muted,
      });
    });

    y += height + 22;
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/** A protocol transcript, in the monospace face. */
const layoutCode = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "code") {
    return;
  }

  const top = header(ctx, slide.title);

  const lines = slide.code.split("\n");
  const lineHeight = 30;
  const panelHeight = lines.length * lineHeight + 56;

  rect(ctx, "code-panel", MARGIN, top + 24, CONTENT_W, panelHeight, {
    fill: palette.surface,
    stroke: palette.border,
    strokeWidth: 1,
    square: true,
  });

  text(ctx, "code-language", MARGIN + 28, top + 44, slide.language, {
    size: 16,
    color: palette.faint,
  });

  lines.forEach((line, index) => {
    text(
      ctx,
      `code-line-${index}`,
      MARGIN + 28,
      top + 78 + index * lineHeight,
      line,
      {
        size: 20,
        font: CASCADIA,
        color: palette.ink,
      },
    );
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/** A quotation, with the source under it. */
const layoutQuote = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "quote") {
    return;
  }

  const value = fit(slide.quote, CONTENT_W - 120, 40);
  const height = textBlockHeight(value, 40);

  text(ctx, "quote-text", MARGIN, 240, value, {
    size: 40,
    color: palette.ink,
  });
  text(ctx, "quote-cite", MARGIN, 240 + height + 40, slide.cite, {
    size: 20,
    color: palette.muted,
  });
};

/** Two columns of text, separated by a rule. */
const layoutCompare = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "compare") {
    return;
  }

  const top = header(ctx, slide.title);

  const columnWidth = (CONTENT_W - 90) / 2;
  const columns = [
    { key: "left", panel: slide.left, x: MARGIN },
    { key: "right", panel: slide.right, x: MARGIN + columnWidth + 90 },
  ];

  columns.forEach(({ key, panel, x }) => {
    text(ctx, `compare-heading-${key}`, x, top, panel.heading, {
      size: 28,
      color: palette.title,
    });

    let y = top + 48;
    panel.lines.forEach((line, index) => {
      const value = fit(line, columnWidth - 28, 22);
      const height = textBlockHeight(value, 22);

      rect(ctx, `compare-mark-${key}-${index}`, x, y + 9, 8, 8, {
        fill: key === "left" ? palette.border : palette.accent,
        stroke: key === "left" ? palette.border : palette.accent,
        strokeWidth: 1,
      });
      text(ctx, `compare-text-${key}-${index}`, x + 28, y, value, {
        size: 22,
        color: palette.ink,
      });

      y += height + 20;
    });
  });

  vrule(ctx, "compare-rule", MARGIN + columnWidth + 45, top, 300);

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/** Numbered steps, set as a list with the number in the margin. */
const layoutSteps = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "steps") {
    return;
  }

  let y = header(ctx, slide.title);

  slide.steps.forEach((step, index) => {
    const label = fit(step.label, 180, 24);
    const body = fit(step.body, CONTENT_W - 260, 22);
    const height = Math.max(
      textBlockHeight(label, 24),
      textBlockHeight(body, 22),
    );

    text(ctx, `step-number-${index}`, MARGIN, y, `${index + 1}.`, {
      size: 24,
      color: palette.accent,
    });
    text(ctx, `step-label-${index}`, MARGIN + 60, y, label, {
      size: 24,
      color: palette.ink,
    });
    text(ctx, `step-body-${index}`, MARGIN + 250, y, body, {
      size: 22,
      color: palette.muted,
    });

    y += height + 28;
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/**
 * The point of a part, set as a sentence with a short list under it. The
 * list is set as text, without a box.
 */
const layoutTakeaway = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "takeaway") {
    return;
  }

  let y = header(ctx, slide.title);

  const body = fit(slide.body, CONTENT_W - 80, 30);
  const bodyHeight = textBlockHeight(body, 30);

  text(ctx, "takeaway-body", MARGIN, y, body, {
    size: 30,
    color: palette.ink,
  });
  y += bodyHeight + 44;

  rule(ctx, "takeaway-rule", MARGIN, y, 160, palette.accent, 3);
  y += 34;

  slide.points.forEach((point, index) => {
    const value = fit(point, CONTENT_W - 44, 24);
    const height = textBlockHeight(value, 24);

    rect(ctx, `takeaway-mark-${index}`, MARGIN + 2, y + 9, 10, 10, {
      fill: palette.accent,
      stroke: palette.accent,
      strokeWidth: 1,
    });
    text(ctx, `takeaway-text-${index}`, MARGIN + 44, y, value, {
      size: 24,
      color: palette.muted,
    });

    y += height + 22;
  });

  if (slide.source) {
    source(ctx, slide.source);
  }
  footer(ctx);
};

/** The closing slide, with the ask and the sources behind the deck. */
const layoutEnd = (ctx: Ctx, slide: DemoSlideSpec) => {
  if (slide.kind !== "end") {
    return;
  }

  darkBackdrop(ctx);

  const title = fit(slide.title, CONTENT_W - 120, 56);
  const titleHeight = textBlockHeight(title, 56);

  text(ctx, "end-title", MARGIN, 150, title, {
    size: 56,
    color: palette.white,
  });

  const bodyTop = 150 + titleHeight + 30;
  const body = fit(slide.body, CONTENT_W - 220, 26);
  const bodyHeight = textBlockHeight(body, 26);

  text(ctx, "end-body", MARGIN, bodyTop, body, {
    size: 26,
    color: palette.onDark,
  });

  const listTop = bodyTop + bodyHeight + 60;
  rule(ctx, "end-rule", MARGIN, listTop - 34, CONTENT_W, mix(WHITE, 0.24));

  slide.links.forEach((link, index) => {
    const x = MARGIN + index * 280;
    text(ctx, `end-link-${index}`, x, listTop, link.label, {
      size: 22,
      color: palette.accent,
    });
    text(ctx, `end-detail-${index}`, x, listTop + 32, link.detail, {
      size: 18,
      color: palette.onDarkFaint,
    });
  });
};

const LAYOUTS: Record<string, (ctx: Ctx, slide: DemoSlideSpec) => void> = {
  cover: layoutCover,
  statement: layoutStatement,
  section: layoutSection,
  bullets: layoutBullets,
  diagram: layoutDiagram,
  number: layoutNumber,
  chart: layoutChart,
  table: layoutTable,
  code: layoutCode,
  quote: layoutQuote,
  compare: layoutCompare,
  steps: layoutSteps,
  takeaway: layoutTakeaway,
  end: layoutEnd,
};

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

const COLS = 2;
const COL_GAP = 140;
const ROW_GAP = 120;

/** the slides that are backed by the dark blue */
const DARK_SLIDE_KINDS = new Set(["cover", "section", "end"]);

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
      dark: DARK_SLIDE_KINDS.has(slide.kind),
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
      backgroundColor: ctx.dark ? palette.dark : FRAME_STYLE.backgroundColor,
      customData: { presentation },
    });
  });

  return { skeletons, count: DEMO_SLIDES.length };
};

const slideTitle = (slide: DemoSlideSpec) => {
  switch (slide.kind) {
    case "cover":
    case "section":
    case "bullets":
    case "diagram":
    case "number":
    case "chart":
    case "table":
    case "code":
    case "compare":
    case "steps":
    case "takeaway":
    case "end":
      return slide.title;
    case "statement":
      return slide.text;
    case "quote":
      return slide.quote.slice(0, 48);
  }
};

/** Waits for the fonts used by the demo, so text is measured correctly. */
/** the families the demo uses, and a size to probe them with */
const DEMO_FONTS = ['19px "Nunito"', '20px "Cascadia"'];

/** the characters the fonts are probed with */
const DEMO_FONT_PROBE = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Waits until a font is actually usable for measuring, so that text boxes
 * are exactly as wide as their content. Resolves to false on timeout, which
 * only means the text is measured with the fallback font.
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

/**
 * Writes the demo to a `.excalidraw` file: a normal Excalidraw document with
 * one frame per slide, which opens in any editor and can be edited, saved and
 * presented like any other canvas.
 */
export const downloadDemoAsExcalidraw = async (doc?: Document | null) => {
  const { skeletons } = buildDemo();
  const elements = convertToExcalidrawElements(skeletons);

  const json = serializeAsJSON(
    elements,
    { viewBackgroundColor: "#ffffff" },
    {},
    "local",
  );

  const ownerDocument = doc ?? document;
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = ownerDocument.createElement("a");
  link.href = url;
  link.download = `${DEMO_TITLE}.excalidraw`;
  ownerDocument.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return elements.length;
};

export { DEMO_SLIDES, DEMO_TITLE };
export { SLIDE_TRANSITIONS };
