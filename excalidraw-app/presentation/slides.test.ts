import { newElementWith } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getElementStep,
  getSlideMaxStep,
  getSlidePresentationData,
  getSlides,
  moveSlide,
  sortSlidesReadingOrder,
} from "./slides";

const createFrame = (opts: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  name?: string;
}) =>
  API.createElement({
    type: "frame",
    x: opts.x,
    y: opts.y,
    width: opts.width ?? 800,
    height: opts.height ?? 450,
    ...(opts.name ? { name: opts.name } : {}),
  });

describe("presentation slides", () => {
  it("orders frames in reading order (rows top→bottom, then left→right)", () => {
    const topLeft = createFrame({ x: 0, y: 0 });
    const topRight = createFrame({ x: 1000, y: 0 });
    const bottom = createFrame({ x: 0, y: 600 });
    const lowerRow = createFrame({ x: 1000, y: 600 });

    const sorted = sortSlidesReadingOrder([
      bottom,
      topRight,
      lowerRow,
      topLeft,
    ]);

    expect(sorted.map((frame) => frame.id)).toEqual([
      topLeft.id,
      topRight.id,
      bottom.id,
      lowerRow.id,
    ]);
  });

  it("groups frame children into slides", () => {
    const frame = newElementWith(createFrame({ x: 0, y: 0 }), {
      name: "Intro",
    });
    const other = createFrame({ x: 1000, y: 0 });
    const inside = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      frameId: frame.id,
    });
    const alsoInside = API.createElement({
      type: "ellipse",
      x: 20,
      y: 20,
      frameId: frame.id,
    });
    const outside = API.createElement({ type: "rectangle", x: 5000, y: 5000 });

    const slides = getSlides([frame, other, inside, alsoInside, outside]);

    expect(slides).toHaveLength(2);
    expect(slides[0].frame.id).toBe(frame.id);
    expect(slides[0].title).toBe("Intro");
    expect(new Set(slides[0].elements.map((el) => el.id))).toEqual(
      new Set([inside.id, alsoInside.id]),
    );
    expect(slides[1].elements).toHaveLength(0);
  });

  it("derives reveal steps from element customData", () => {
    const frame = createFrame({ x: 0, y: 0 });
    const base = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      frameId: frame.id,
    });
    const stepped = newElementWith(
      API.createElement({ type: "rectangle", x: 100, y: 0, frameId: frame.id }),
      { customData: { presentationStep: 3 } },
    );

    const slides = getSlides([frame, base, stepped]);

    expect(getElementStep(base)).toBe(1);
    expect(getElementStep(stepped)).toBe(3);
    expect(getSlideMaxStep(slides[0])).toBe(3);
  });

  it("makes bound labels inherit their container's reveal step", () => {
    const frame = createFrame({ x: 0, y: 0 });
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      frameId: frame.id,
    });
    // labels created inside a frame carry the frameId themselves (this used to
    // make them skip the inheritance below)
    const label = API.createElement({
      type: "text",
      text: "Hello",
      x: 10,
      y: 10,
      width: 60,
      height: 20,
      containerId: container.id,
      frameId: frame.id,
    });

    const boundContainer = newElementWith(container, {
      boundElements: [{ type: "text", id: label.id }],
      customData: { presentationStep: 2 },
    });

    const slides = getSlides([frame, boundContainer, label]);
    const slideLabel = slides[0].elements.find((el) => el.id === label.id);

    expect(slideLabel).toBeDefined();
    expect(getElementStep(slideLabel!)).toBe(2);
    expect(getSlideMaxStep(slides[0])).toBe(2);
  });

  it("reads per-slide settings from the frame's customData", () => {
    const frame = createFrame({ x: 0, y: 0 });
    const configured = newElementWith(frame, {
      customData: {
        presentation: {
          notes: "say hi",
          transition: "fade",
          autoAdvance: 5000,
        },
      },
    });

    expect(getSlidePresentationData(configured)).toEqual({
      notes: "say hi",
      transition: "fade",
      autoAdvance: 5000,
    });
    expect(getSlidePresentationData(frame)).toEqual({});
  });

  it("moves a slide together with its contents", () => {
    let scene: ExcalidrawElement[] = [];
    const api = {
      getSceneElementsIncludingDeleted: () => scene,
      updateScene: ({ elements }: { elements: ExcalidrawElement[] }) => {
        scene = elements;
      },
    } as unknown as ExcalidrawImperativeAPI;

    const first = newElementWith(createFrame({ x: 0, y: 0 }), {
      name: "First",
    });
    const second = newElementWith(createFrame({ x: 1000, y: 0 }), {
      name: "Second",
    });
    const firstChild = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      frameId: first.id,
    });
    const secondChild = API.createElement({
      type: "rectangle",
      x: 1050,
      y: 50,
      frameId: second.id,
    });

    scene = [first, firstChild, second, secondChild];

    moveSlide(api, getSlides(scene), 0, 1);

    const byId = new Map(scene.map((el) => [el.id, el]));
    expect(byId.get(first.id)!.x).toBe(1000);
    expect(byId.get(firstChild.id)!.x).toBe(1050);
    expect(byId.get(second.id)!.x).toBe(0);
    expect(byId.get(secondChild.id)!.x).toBe(50);

    // and the deck order reflects the new positions
    expect(getSlides(scene).map((slide) => slide.title)).toEqual([
      "Second",
      "First",
    ]);
  });
});
