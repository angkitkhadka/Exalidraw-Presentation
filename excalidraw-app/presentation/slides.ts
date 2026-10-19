import { FRAME_STYLE } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  duplicateElements,
  getFrameChildren,
  getFrameLikeElements,
  getNonDeletedElements,
  isFrameLikeElement,
  newElementWith,
  newFrameElement,
  syncInvalidIndices,
} from "@excalidraw/element";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

/** default slide (frame) size — 16:9, matches a typical deck */
export const DEFAULT_SLIDE_WIDTH = 1280;
export const DEFAULT_SLIDE_HEIGHT = 720;
/** gap between auto-generated slides, in scene units */
export const SLIDE_GAP = 100;

/**
 * How a slide is entered while presenting.
 *
 * - `glide` — the camera pans/zooms from the previous slide (default)
 * - `cut`   — instant, no animation
 * - `flash` — instant cut with a white flash
 * - `fade`  — cross-fade between the two slides
 * - `dissolve` — cross-fade with blur
 * - `push` / `push-up` — the new slide pushes the old one out
 * - `cover` / `uncover` — the new slide slides over / reveals the old one
 * - `wipe` / `wipe-up` — the new slide is revealed by a wipe
 * - `split` / `split-vertical` — the new slide opens from the center
 * - `zoom` / `zoom-out` — the new slide zooms in / out
 * - `flip` — 3D card flip
 * - `rotate` — rotate + scale
 * - `pop` — a small overshoot scale
 */
export const SLIDE_TRANSITIONS = [
  "glide",
  "cut",
  "flash",
  "fade",
  "dissolve",
  "push",
  "push-up",
  "cover",
  "uncover",
  "wipe",
  "wipe-up",
  "split",
  "split-vertical",
  "zoom",
  "zoom-out",
  "flip",
  "rotate",
  "pop",
] as const;

export type SlideTransition = typeof SLIDE_TRANSITIONS[number];

export type SlidePresentationData = {
  /** speaker notes, shown in the presenter HUD */
  notes?: string;
  /** transition used when navigating *into* this slide */
  transition?: SlideTransition;
  /** auto-advance delay in ms (0/undefined = off) */
  autoAdvance?: number;
  /**
   * Replay the slide's content with a hand-drawn "sketch" animation when the
   * slide is entered. Defaults to *on*; set to `false` to disable it for a
   * slide.
   */
  animate?: boolean;
  /** how long each element takes to draw, in ms (default 450) */
  animateDuration?: number;
};

/** default per-element duration of the draw-in animation, in ms */
export const DEFAULT_ANIMATE_DURATION = 450;

/** Whether a slide should play the draw-in animation when it is entered. */
export const slideAnimates = (frame: ExcalidrawFrameLikeElement): boolean =>
  getSlidePresentationData(frame).animate !== false;

/** Per-element duration of a slide's draw-in animation, in ms. */
export const getSlideAnimateDuration = (
  frame: ExcalidrawFrameLikeElement,
): number => {
  const value = getSlidePresentationData(frame).animateDuration;
  return Number.isFinite(value) && (value as number) > 0
    ? (value as number)
    : DEFAULT_ANIMATE_DURATION;
};

/** key we store slide settings under on the frame's `customData` */
export const PRESENTATION_CUSTOM_DATA_KEY = "presentation";

export type Slide = {
  /** the frame backing this slide */
  frame: NonDeleted<ExcalidrawFrameLikeElement>;
  /** elements belonging to the slide (frame children + bound labels) */
  elements: NonDeletedExcalidrawElement[];
  /** display title (frame name, falling back to "Slide N") */
  title: string;
};

type ElementsInput = readonly ExcalidrawElement[];

/**
 * Frames are slides. Orders them in "reading order" — rows from top to
 * bottom, and left to right within a row — which is what you'd expect when
 * laying a deck out on the canvas.
 */
export const sortSlidesReadingOrder = <T extends ExcalidrawFrameLikeElement>(
  frames: readonly T[],
): T[] => {
  const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: T[][] = [];

  for (const frame of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const rowY = row[0].y;
      const rowRefHeight = Math.min(row[0].height, frame.height) || 0;
      // same row when the vertical centers roughly line up
      if (Math.abs(frame.y - rowY) < rowRefHeight * 0.5) {
        row.push(frame);
        continue;
      }
    }
    rows.push([frame]);
  }

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }

  return rows.flat();
};

/** Derives the deck (slides) from the current scene elements. */
export const getSlides = (elements: ElementsInput): Slide[] => {
  const nonDeleted = getNonDeletedElements(elements);
  const frames = sortSlidesReadingOrder(
    getNonDeletedElements(getFrameLikeElements(nonDeleted)),
  );
  const byId = new Map<string, NonDeletedExcalidrawElement>();
  for (const el of nonDeleted) {
    byId.set(el.id, el);
  }

  return frames.map((frame, index) => {
    const children = getNonDeletedElements(
      getFrameChildren(nonDeleted, frame.id),
    );

    // bound labels (text bound to a container) may or may not carry the
    // frameId themselves, so pull them in explicitly
    const slideElements: NonDeletedExcalidrawElement[] = [...children];
    const seen = new Set(children.map((c) => c.id));
    for (const child of children) {
      for (const bound of child.boundElements ?? []) {
        if (bound.type === "text" && !seen.has(bound.id)) {
          const label = byId.get(bound.id);
          if (label) {
            seen.add(label.id);
            slideElements.push(label);
          }
        }
      }
    }

    // a bound label without its own step follows its container, so a build
    // (reveal steps) shows the shape and its text together
    const withInheritedSteps = slideElements.map((element) => {
      if (
        element.type !== "text" ||
        !element.containerId ||
        element.customData?.presentationStep !== undefined
      ) {
        return element;
      }
      const container = byId.get(element.containerId);
      const containerStep = container ? getElementStep(container) : 1;
      return containerStep > 1
        ? {
            ...element,
            customData: {
              ...element.customData,
              presentationStep: containerStep,
            },
          }
        : element;
    });

    return {
      frame,
      elements: withInheritedSteps,
      title: frame.name?.trim() || `Slide ${index + 1}`,
    };
  });
};

/** Reads the presentation settings stored on a frame. */
export const getSlidePresentationData = (
  frame: ExcalidrawFrameLikeElement,
): SlidePresentationData => {
  const data = frame.customData?.[PRESENTATION_CUSTOM_DATA_KEY];
  return data && typeof data === "object" ? data : {};
};

/**
 * Cheap signature of everything the slide panel renders. Used to skip panel
 * re-renders while the user draws (element versions change, the deck doesn't).
 */
export const getSlidesSignature = (elements: ElementsInput): string => {
  const nonDeleted = getNonDeletedElements(elements);
  const frames = getNonDeletedElements(getFrameLikeElements(nonDeleted));

  return frames
    .map((frame) => {
      const data = getSlidePresentationData(frame);
      const children = getFrameChildren(nonDeleted, frame.id);
      const steps = children
        .map((child) => `${child.id}:${getElementStep(child)}`)
        .join(",");
      return [
        frame.id,
        frame.name ?? "",
        data.transition ?? "",
        data.animate === false ? "0" : "1",
        data.animateDuration ?? "",
        data.autoAdvance ?? "",
        data.notes ?? "",
        steps,
      ].join(":");
    })
    .join("|");
};

export const getSlideTitle = (
  frame: ExcalidrawFrameLikeElement,
  index: number,
) => frame.name?.trim() || `Slide ${index + 1}`;

// mutation helpers (all go through the imperative API so edits are undoable)

const replaceElements = (
  api: ExcalidrawImperativeAPI,
  elements: readonly ExcalidrawElement[],
  { undoable = true }: { undoable?: boolean } = {},
) => {
  api.updateScene({
    elements: syncInvalidIndices(elements) as OrderedExcalidrawElement[],
    captureUpdate: undoable
      ? CaptureUpdateAction.IMMEDIATELY
      : CaptureUpdateAction.EVENTUALLY,
  });
};

/** Patches the presentation settings stored on a slide's frame. */
export const updateSlidePresentationData = (
  api: ExcalidrawImperativeAPI,
  frame: ExcalidrawFrameLikeElement,
  patch: SlidePresentationData,
) => {
  const elements = api.getSceneElementsIncludingDeleted();
  const current = getSlidePresentationData(frame);
  const next = newElementWith(frame, {
    customData: {
      ...frame.customData,
      [PRESENTATION_CUSTOM_DATA_KEY]: { ...current, ...patch },
    },
  });

  replaceElements(
    api,
    elements.map((el) => (el.id === frame.id ? next : el)),
  );
};

export const renameSlide = (
  api: ExcalidrawImperativeAPI,
  frame: ExcalidrawFrameLikeElement,
  name: string,
) => {
  const elements = api.getSceneElementsIncludingDeleted();
  replaceElements(
    api,
    elements.map((el) =>
      el.id === frame.id && isFrameLikeElement(el)
        ? newElementWith(el, { name: name || null })
        : el,
    ),
  );
};

const focusFrame = (
  api: ExcalidrawImperativeAPI,
  frame: ExcalidrawFrameLikeElement,
) => {
  api.selection.clear();
  api.updateScene({
    appState: {
      selectedElementIds: { [frame.id]: true },
      selectedGroupIds: {},
      editingGroupId: null,
    },
  });
  api.setViewport({
    target: [frame.x, frame.y, frame.x + frame.width, frame.y + frame.height],
    fit: "scale-down",
    animation: { duration: 260 },
  });
};

/**
 * Adds a new, empty slide. When there are elements selected, wraps the
 * selection instead (so you can turn a sketch into a slide in one click).
 */
export const addSlide = (api: ExcalidrawImperativeAPI) => {
  const elements = api.getSceneElementsIncludingDeleted();
  const slides = getSlides(elements);
  const appState = api.getAppState();

  const selection = getNonDeletedElements(elements).filter(
    (el) => appState.selectedElementIds[el.id] && !isFrameLikeElement(el),
  );

  let frame: NonDeleted<ExcalidrawFrameLikeElement>;

  if (selection.length) {
    const minX = Math.min(...selection.map((el) => el.x));
    const minY = Math.min(...selection.map((el) => el.y));
    const maxX = Math.max(...selection.map((el) => el.x + el.width));
    const maxY = Math.max(...selection.map((el) => el.y + el.height));
    const padding = 60;

    frame = newFrameElement({
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      name: `Slide ${slides.length + 1}`,
      ...frameStyle(),
    });
  } else {
    const last = slides[slides.length - 1]?.frame;
    const width = last?.width || DEFAULT_SLIDE_WIDTH;
    const height = last?.height || DEFAULT_SLIDE_HEIGHT;
    // place to the right of the last slide, otherwise centered in view
    const x = last
      ? last.x + last.width + SLIDE_GAP
      : (appState.width / 2 - appState.scrollX * appState.zoom.value) /
          appState.zoom.value -
        width / 2;
    const y = last
      ? last.y
      : (appState.height / 2 - appState.scrollY * appState.zoom.value) /
          appState.zoom.value -
        height / 2;

    frame = newFrameElement({
      x,
      y,
      width,
      height,
      name: `Slide ${slides.length + 1}`,
      ...frameStyle(),
    });
  }

  const selectedIds = new Set(selection.map((el) => el.id));
  // the frame "steals" its new children (the selection, when wrapping)
  const nextElements = [
    ...elements.map((el) =>
      el.id !== frame.id && selectedIds.has(el.id)
        ? newElementWith(el, { frameId: frame.id })
        : el,
    ),
    frame,
  ];

  replaceElements(api, nextElements);
  focusFrame(api, frame);
  return frame;
};

export const duplicateSlide = (api: ExcalidrawImperativeAPI, slide: Slide) => {
  const elements = api.getSceneElementsIncludingDeleted();
  const slides = getSlides(elements);

  // duplicate the frame together with its contents — `duplicateElements`
  // remaps ids/bindings (including the frameId of the children) for us
  const duplicates = duplicateElements({
    type: "everything",
    elements: [slide.frame, ...slide.elements],
    preserveFrameChildrenOrder: true,
  }).duplicatedElements;

  const offsetX = (slide.frame.width || DEFAULT_SLIDE_WIDTH) + SLIDE_GAP;
  const moved = duplicates.map((el) =>
    newElementWith(el, { x: el.x + offsetX, y: el.y }),
  );

  const createdFrame = moved.find((el) => isFrameLikeElement(el)) as
    | NonDeleted<ExcalidrawFrameLikeElement>
    | undefined;

  if (!createdFrame) {
    return;
  }

  const named = newElementWith(createdFrame, {
    name: `Slide ${slides.length + 1}`,
  });

  replaceElements(api, [
    ...elements,
    ...moved.map((el) => (el.id === createdFrame.id ? named : el)),
  ]);

  focusFrame(api, named);
};

export const deleteSlides = (
  api: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
) => {
  const ids = new Set(
    slides.flatMap((slide) => [
      slide.frame.id,
      ...slide.elements.map((el) => el.id),
    ]),
  );
  const elements = api.getSceneElementsIncludingDeleted();
  replaceElements(
    api,
    elements.map((el) =>
      ids.has(el.id) ? newElementWith(el, { isDeleted: true }) : el,
    ),
  );
};

/**
 * Moves a slide within the deck by physically swapping its frame with a
 * neighbour — the canvas layout stays the source of truth for slide order.
 */
export const moveSlide = (
  api: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
  index: number,
  delta: -1 | 1,
) => {
  const target = index + delta;
  if (target < 0 || target >= slides.length) {
    return;
  }
  const source = slides[index];
  const neighbour = slides[target];
  const elements = api.getSceneElementsIncludingDeleted();

  // swap the frames *and* their contents, otherwise children would be left
  // behind at the old coordinates
  const move = (
    from: Slide,
    to: Slide,
  ): { ids: Set<string>; dx: number; dy: number } => ({
    ids: new Set([from.frame.id, ...from.elements.map((el) => el.id)]),
    dx: to.frame.x - from.frame.x,
    dy: to.frame.y - from.frame.y,
  });

  const sourceMove = move(source, neighbour);
  const neighbourMove = move(neighbour, source);

  replaceElements(
    api,
    elements.map((el) => {
      if (sourceMove.ids.has(el.id)) {
        return newElementWith(el, {
          x: el.x + sourceMove.dx,
          y: el.y + sourceMove.dy,
        });
      }
      if (neighbourMove.ids.has(el.id)) {
        return newElementWith(el, {
          x: el.x + neighbourMove.dx,
          y: el.y + neighbourMove.dy,
        });
      }
      return el;
    }),
  );
};

// build steps (progressive element reveal)

export const getElementStep = (element: ExcalidrawElement): number => {
  const step = Number(element.customData?.presentationStep);
  return Number.isFinite(step) && step > 0 ? step : 1;
};

export const getSlideMaxStep = (slide: Slide): number =>
  slide.elements.reduce((max, el) => Math.max(max, getElementStep(el)), 1);

/** True when the element (or any element of the slide) is part of a build. */
export const slideHasSteps = (slide: Slide): boolean =>
  slide.elements.some((el) => getElementStep(el) > 1);

/**
 * Assigns (or clears, with `null`) the reveal step for the currently
 * selected elements. Bound labels follow their container's step.
 */
export const setSelectionStep = (
  api: ExcalidrawImperativeAPI,
  step: number | null,
) => {
  const appState = api.getAppState();
  const elements = api.getSceneElementsIncludingDeleted();
  const selectedIds = new Set(Object.keys(appState.selectedElementIds));

  if (!selectedIds.size) {
    return false;
  }

  // labels bound to selected containers should reveal together with them
  for (const el of elements) {
    if (!selectedIds.has(el.id)) {
      continue;
    }
    for (const bound of el.boundElements ?? []) {
      if (bound.type === "text") {
        selectedIds.add(bound.id);
      }
    }
  }

  replaceElements(
    api,
    elements.map((el) => {
      if (!selectedIds.has(el.id)) {
        return el;
      }
      const customData: Record<string, any> = { ...el.customData };
      if (step === null) {
        delete customData.presentationStep;
      } else {
        customData.presentationStep = step;
      }
      return newElementWith(el, { customData });
    }),
  );

  return true;
};

/**
 * Assigns the reveal step of a single element of a slide. `null` makes the
 * element always visible.
 */
export const setElementStep = (
  api: ExcalidrawImperativeAPI,
  elementId: string,
  step: number | null,
) => {
  const elements = api.getSceneElementsIncludingDeleted();
  replaceElements(
    api,
    elements.map((el) => {
      if (el.id !== elementId) {
        return el;
      }
      const customData: Record<string, any> = { ...el.customData };
      if (step === null) {
        delete customData.presentationStep;
      } else {
        customData.presentationStep = step;
      }
      return newElementWith(el, { customData });
    }),
  );
};

/** Applies the same presentation settings to every slide of the deck. */
export const updateSlidesPresentationData = (
  api: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
  patch: SlidePresentationData,
) => {
  if (!slides.length) {
    return;
  }
  const byId = new Map(slides.map((slide) => [slide.frame.id, slide.frame]));
  const elements = api.getSceneElementsIncludingDeleted();

  replaceElements(
    api,
    elements.map((el) => {
      const frame = byId.get(el.id);
      if (!frame) {
        return el;
      }
      return newElementWith(el, {
        customData: {
          ...el.customData,
          [PRESENTATION_CUSTOM_DATA_KEY]: {
            ...getSlidePresentationData(el as ExcalidrawFrameLikeElement),
            ...patch,
          },
        },
      });
    }),
  );
};

const frameStyle = () => ({
  strokeColor: FRAME_STYLE.strokeColor,
  strokeWidth: FRAME_STYLE.strokeWidth,
  strokeStyle: FRAME_STYLE.strokeStyle,
  fillStyle: FRAME_STYLE.fillStyle,
  roughness: FRAME_STYLE.roughness,
  roundness: FRAME_STYLE.roundness,
  backgroundColor: FRAME_STYLE.backgroundColor,
});

/** Index of the slide whose frame contains the current viewport center. */
export const getSlideIndexAtViewportCenter = (
  api: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
): number => {
  const { scrollX, scrollY, zoom, width, height } = api.getAppState();
  const centerX = width / 2 / zoom.value - scrollX;
  const centerY = height / 2 / zoom.value - scrollY;

  const index = slides.findIndex(
    (slide) =>
      centerX >= slide.frame.x &&
      centerX <= slide.frame.x + slide.frame.width &&
      centerY >= slide.frame.y &&
      centerY <= slide.frame.y + slide.frame.height,
  );

  return index === -1 ? 0 : index;
};
