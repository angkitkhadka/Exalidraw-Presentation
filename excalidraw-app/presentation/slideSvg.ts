import { exportScene } from "@excalidraw/excalidraw";
import { cleanAppStateForExport } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  NonDeletedExcalidrawElement,
  Theme,
} from "@excalidraw/element/types";

import { orderElementsForRender } from "./animate";
import { getElementStep } from "./slides";

import type { Slide } from "./slides";

export type ExportedSlide = {
  /** the exported, still-pristine SVG (no SMIL injected) */
  svg: SVGSVGElement;
  /** the elements in the exact order the exporter rendered them */
  ordered: NonDeletedExcalidrawElement[];
  hash: string;
};

/** the color the slide is painted on (matches the canvas/letterboxing) */
export const getSlideBackground = (viewBackgroundColor: string, theme: Theme) =>
  viewBackgroundColor === "transparent"
    ? theme === "dark"
      ? "#121212"
      : "#ffffff"
    : viewBackgroundColor;

/**
 * Cache key for a slide snapshot. Changes whenever anything that affects the
 * rendered output changes (scene content, reveal step, theme, background), so
 * an annotation drawn during the presentation invalidates the snapshot.
 */
export const getSlideContentHash = (
  api: ExcalidrawImperativeAPI,
  slide: Slide,
  step: number,
  theme: Theme,
) => {
  const appState = api.getAppState();
  return [
    slide.frame.id,
    slide.frame.version,
    slide.frame.versionNonce,
    step,
    theme,
    appState.viewBackgroundColor,
    ...slide.elements
      .filter((element) => getElementStep(element) <= step)
      .map(
        (element) => `${element.id}:${element.version}:${element.versionNonce}`,
      ),
  ].join("|");
};

/**
 * Renders one slide to a plain SVG, cropped exactly to its frame.
 *
 * A cropped export (instead of `exportingFrame`) keeps the SVG tree flat — one
 * top-level `<g>` per element — which the draw-in animation relies on.
 */
export const exportSlideSvg = async (
  api: ExcalidrawImperativeAPI,
  slide: Slide,
  step: number,
  theme: Theme,
): Promise<ExportedSlide> => {
  const appState = api.getAppState();
  const { frame } = slide;
  const visible = slide.elements.filter(
    (element) => getElementStep(element) <= step && element.opacity !== 0,
  );
  const ordered = orderElementsForRender(visible);

  const svg = (await exportScene({
    type: "svg",
    data: {
      elements: ordered,
      appState: cleanAppStateForExport({
        viewBackgroundColor: appState.viewBackgroundColor,
      }),
      files: api.getFiles(),
    },
    config: {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      padding: 0,
      canvasBackgroundColor: getSlideBackground(
        appState.viewBackgroundColor,
        theme,
      ),
      theme,
    },
  })) as SVGSVGElement;

  return {
    svg,
    ordered,
    hash: getSlideContentHash(api, slide, step, theme),
  };
};

const cache = new Map<
  string,
  { hash: string; promise: Promise<ExportedSlide> }
>();

/**
 * Returns the slide's snapshot, reusing an in-flight/finished render when the
 * slide content hasn't changed. This is what makes re-entry and prefetched
 * navigation instant.
 */
export const getSlideSvg = (
  api: ExcalidrawImperativeAPI,
  slide: Slide,
  step: number,
  theme: Theme,
): Promise<ExportedSlide> => {
  const key = slide.frame.id;
  const hash = getSlideContentHash(api, slide, step, theme);
  const cached = cache.get(key);
  if (cached?.hash === hash) {
    return cached.promise;
  }
  const promise = exportSlideSvg(api, slide, step, theme);
  cache.set(key, { hash, promise });
  // a prefetch may never be awaited; don't turn that into an unhandled rejection
  promise.catch(() => {});
  return promise;
};

/** Warms the cache for a slide without blocking the caller. */
export const prefetchSlideSvg = (
  api: ExcalidrawImperativeAPI,
  slide: Slide,
  step: number,
  theme: Theme,
) => {
  void getSlideSvg(api, slide, step, theme).catch(() => {});
};

/** Drops every cached snapshot (on presentation start/end). */
export const clearSlideSvgCache = () => {
  cache.clear();
};
