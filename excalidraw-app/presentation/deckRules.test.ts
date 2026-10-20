import { describe, expect, it } from "vitest";

import { DEMO_SLIDES } from "./demoContent";
import { buildDemo } from "./demoDeck";
import {
  BANNED_OPENERS,
  BANNED_PHRASES,
  BANNED_VOCABULARY,
  checkDeck,
  isActionTitle,
  isTitleCase,
} from "./deckRules";

describe("the deck rules", () => {
  it("the built-in demo breaks none of them", () => {
    expect(checkDeck(DEMO_SLIDES)).toEqual([]);
  });

  it("has no emoji and no em dashes", () => {
    const text = JSON.stringify(DEMO_SLIDES);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("uses one case convention for titles", () => {
    for (const slide of DEMO_SLIDES) {
      const title =
        slide.kind === "statement"
          ? slide.text
          : slide.kind === "quote"
          ? slide.quote
          : slide.title;
      expect(isTitleCase(title)).toBe(false);
    }
  });

  it("keeps the slide count low", () => {
    expect(DEMO_SLIDES.length).toBeLessThanOrEqual(30);
  });

  it("gives every slide a title", () => {
    for (const slide of DEMO_SLIDES) {
      if (slide.kind === "quote") {
        expect(slide.quote.length).toBeGreaterThan(10);
      } else if (slide.kind === "statement") {
        expect(slide.text.length).toBeGreaterThan(10);
      } else {
        expect("title" in slide && slide.title?.length).toBeTruthy();
      }
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

  it("writes speaker notes that add something", () => {
    const withNotes = DEMO_SLIDES.filter((slide) => slide.notes).length;
    expect(withNotes).toBeGreaterThan(DEMO_SLIDES.length * 0.8);
  });

  it("puts a source on every slide that carries a number", () => {
    for (const slide of DEMO_SLIDES) {
      if (slide.source) {
        continue;
      }
      const text = JSON.stringify(slide);
      // a number in a code sample or a URL is not a claim that needs a source
      const hasFigure = /\b\d+(\.\d+)?\s*(octets|bytes|ms|s\b|%)/.test(text);
      expect(hasFigure).toBe(false);
    }
  });

  it("builds one frame per slide", () => {
    const { skeletons, count } = buildDemo();
    expect(count).toBe(DEMO_SLIDES.length);

    const frames = skeletons.filter((skeleton) => skeleton.type === "frame");
    expect(frames).toHaveLength(DEMO_SLIDES.length);

    for (const frame of frames) {
      expect(frame.name).toBeTruthy();
    }
  });
});

describe("the checks", () => {
  it("catches a banned word", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The resolver navigates the tree of names",
        bullets: ["A short note"],
      },
    ]);
    expect(problems.some((p) => p.rule === "banned-vocabulary")).toBe(true);
  });

  it("catches a banned phrase", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The team will move the needle this quarter",
        bullets: ["A short note"],
      },
    ]);
    expect(problems.some((p) => p.rule === "banned-phrase")).toBe(true);
  });

  it("catches a generic opener", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "In today's world, pages load slowly",
        bullets: ["A short note"],
      },
    ]);
    expect(problems.some((p) => p.rule === "banned-opener")).toBe(true);
  });

  it("catches a title in title case", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The Resolver Walks Down A Tree Of Names",
        bullets: ["A short note"],
      },
    ]);
    expect(problems.some((p) => p.rule === "title-case")).toBe(true);
  });

  it("catches a title that names a topic rather than a conclusion", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "Name resolution in the domain system",
        bullets: ["A short note"],
      },
    ]);
    expect(problems.some((p) => p.rule === "action-title")).toBe(true);
  });

  it("catches a number with no source", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The resolver walks down a tree of names",
        bullets: ["Each answer is cached for 300 seconds"],
      },
    ]);
    expect(problems.some((p) => p.rule === "source")).toBe(true);
  });

  it("catches the same form twice in a row", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The resolver walks down a tree of names",
        bullets: ["Each answer is cached"],
      },
      {
        kind: "bullets",
        title: "The connection costs a handshake to complete",
        bullets: ["Each request reuses it"],
      },
    ]);
    expect(problems.some((p) => p.rule === "repeated-form")).toBe(true);
  });

  it("catches a closing slide that only says thank you", () => {
    const problems = checkDeck([
      {
        kind: "bullets",
        title: "The resolver walks down a tree of names",
        bullets: ["Each answer is cached"],
      },
      {
        kind: "end",
        title: "Thank you for listening",
        body: "Any questions?",
        links: [],
      },
    ]);
    expect(problems.some((p) => p.rule === "closing")).toBe(true);
  });
});

describe("the helpers", () => {
  it("knows a conclusion from a label", () => {
    expect(isActionTitle("The resolver walks down a tree of names")).toBe(true);
    expect(isActionTitle("Name resolution")).toBe(false);
    expect(isActionTitle("Overview")).toBe(false);
  });

  it("knows title case from sentence case", () => {
    expect(isTitleCase("The Resolver Walks Down A Tree")).toBe(true);
    expect(isTitleCase("The resolver walks down a tree")).toBe(false);
    expect(isTitleCase("HTTP caching")).toBe(false);
  });

  it("lists the words it rejects", () => {
    expect(BANNED_VOCABULARY).toContain("showcase");
    expect(BANNED_PHRASES.length).toBeGreaterThan(5);
    expect(BANNED_OPENERS.length).toBeGreaterThan(5);
  });
});
