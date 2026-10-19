import {
  convertToExcalidrawElements,
  isFrameLikeElement,
} from "@excalidraw/element";

import { buildDeck, parseDeckSpec } from "./deck";
import { getElementStep, getSlideMaxStep, getSlides } from "./slides";

import demoDeck from "./examples/aws-ec2.deck.json";

const buildElements = (input: unknown) =>
  convertToExcalidrawElements(buildDeck(parseDeckSpec(input)).skeletons);

describe("deck spec", () => {
  it("rejects specs without slides", () => {
    expect(() => parseDeckSpec(null)).toThrow(/object/i);
    expect(() => parseDeckSpec({})).toThrow(/slides/i);
    expect(() => parseDeckSpec({ slides: [] })).toThrow(/slides/i);
  });

  it("rejects unknown layouts and transitions", () => {
    expect(() => parseDeckSpec({ slides: [{ layout: "nope" }] })).toThrow(
      /layout/i,
    );
    expect(() => parseDeckSpec({ slides: [{ transition: "spiral" }] })).toThrow(
      /transition/i,
    );
  });

  it("normalizes and defaults the slide fields", () => {
    const spec = parseDeckSpec({
      slides: [{ title: "  Hello  ", bullets: ["One", "", "Two"] }],
    });

    expect(spec.slides[0].layout).toBe("bullets");
    expect(spec.slides[0].title).toBe("Hello");
    expect(spec.slides[0].bullets).toEqual(["One", "Two"]);
  });

  it("turns each slide into a frame in reading order", () => {
    const elements = buildElements({
      slides: [
        { layout: "title", title: "One" },
        { layout: "bullets", title: "Two", bullets: ["a", "b"] },
        { layout: "end", title: "Three" },
      ],
    });

    const frames = elements.filter(isFrameLikeElement);
    expect(frames).toHaveLength(3);

    const slides = getSlides(elements);
    expect(slides.map((slide) => slide.title)).toEqual(["One", "Two", "Three"]);
    expect(slides[1].elements.length).toBeGreaterThan(1);
    // every element belongs to the frame it was generated for
    for (const slide of slides) {
      expect(slide.elements.length).toBeGreaterThan(0);
    }
  });

  it("positions slides in a two column grid below the origin", () => {
    const { skeletons } = buildDeck(
      parseDeckSpec({
        slides: [{ title: "a" }, { title: "b" }, { title: "c" }],
      }),
      0,
      1000,
    );
    const frames = skeletons.filter((element) => element.type === "frame") as {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];

    expect(frames[0].y).toBe(frames[1].y);
    expect(frames[0].y).toBe(1000);
    expect(frames[1].x).toBeGreaterThan(frames[0].x);
    expect(frames[2].y).toBeGreaterThan(frames[0].y);
    expect(frames[2].x).toBe(frames[0].x);
  });

  it("stores presentation metadata and reveal steps", () => {
    const elements = buildElements({
      slides: [
        {
          layout: "flow",
          title: "Lifecycle",
          steps: ["One", "Two", "Three"],
          reveal: true,
          transition: "fade",
          animate: false,
          notes: "hello",
        },
      ],
    });

    const slides = getSlides(elements);
    expect(slides[0].frame.customData?.presentation).toEqual({
      transition: "fade",
      animate: false,
      notes: "hello",
    });
    expect(getSlideMaxStep(slides[0])).toBe(3);

    const stepped = slides[0].elements.filter(
      (element) => getElementStep(element) === 3,
    );
    // the third box, the arrow leading into it, and its bound label
    expect(stepped.length).toBe(3);
  });

  it("ships a demo deck that compiles cleanly", () => {
    const elements = buildElements(demoDeck);
    const slides = getSlides(elements);

    expect(slides.length).toBeGreaterThanOrEqual(20);
    // every layout produced content and a name
    for (const slide of slides) {
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.elements.length).toBeGreaterThan(1);
    }
  });
});
