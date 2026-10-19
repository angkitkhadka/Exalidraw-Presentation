import { describe, expect, it } from "vitest";

import { DEMO_SLIDES, DEMO_TITLE } from "./demoContent";
import { buildDemo } from "./demoDeck";

describe("demo deck", () => {
  it("has a hundred slides", () => {
    expect(DEMO_SLIDES).toHaveLength(100);
  });

  it("uses a small set of layouts, so the deck reads as one deck", () => {
    const kinds = new Set(DEMO_SLIDES.map((slide) => slide.kind));
    expect(kinds.size).toBeGreaterThan(8);
    expect(kinds.size).toBeLessThan(20);
  });

  it("has no emoji and no em dashes", () => {
    const text = JSON.stringify(DEMO_SLIDES);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("gives every slide a title", () => {
    for (const slide of DEMO_SLIDES) {
      if (slide.kind === "quote") {
        expect(slide.quote.length).toBeGreaterThan(10);
      } else {
        expect("title" in slide && slide.title?.length).toBeTruthy();
      }
    }
  });

  it("builds one frame per slide", () => {
    const { skeletons, count } = buildDemo();
    expect(count).toBe(100);

    const frames = skeletons.filter((skeleton) => skeleton.type === "frame");
    expect(frames).toHaveLength(100);

    for (const frame of frames) {
      expect(frame.name).toBeTruthy();
      expect(frame.type).toBe("frame");
    }
  });

  it("gives every slide a transition", () => {
    const { skeletons } = buildDemo();
    const frames = skeletons.filter(
      (skeleton) => skeleton.type === "frame",
    ) as any[];

    for (const frame of frames) {
      expect(frame.customData?.presentation?.transition).toBeTruthy();
    }
  });

  it("has speaker notes on most slides", () => {
    const withNotes = DEMO_SLIDES.filter((slide) => slide.notes).length;
    expect(withNotes).toBeGreaterThan(50);
  });

  it("is titled", () => {
    expect(DEMO_TITLE).toBe("How the Web Works");
  });
});
