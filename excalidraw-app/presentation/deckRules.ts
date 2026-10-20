/**
 * The mechanical half of `DECK-RULES.md`.
 *
 * The rules there are mostly editorial, and a machine cannot judge an
 * argument. It can, however, catch the things that are easy to miss on a
 * long deck: a banned word on slide twenty, a title in the wrong case, two
 * slides in a row using the same form, a number with no source.
 *
 * `checkDeck` returns the problems it finds. `deckRules.test.ts` runs it
 * over the built-in demo, so a deck that breaks a rule fails the build.
 */

import type { DemoSlideSpec } from "./demoContent";

/**
 * Vocabulary that reads as machine written. Matched as whole words, so
 * "navigates" is caught but "navigation" is not, and "showcases" is caught
 * but "show" is not.
 */
export const BANNED_VOCABULARY = [
  "delve",
  "tapestry",
  "landscape",
  "pivotal",
  "crucial",
  "underscore",
  "testament",
  "foster",
  "showcase",
  "unlock",
  "harness",
  "navigate",
  "journey",
  "realm",
];

/** Phrases that read as a template wrote them. */
export const BANNED_PHRASES = [
  "leverage synergies",
  "move the needle",
  "paradigm shift",
  "in today's fast-paced",
  "in the realm of",
  "a testament to",
  "at the end of the day",
  "think outside the box",
  "best of both worlds",
  "the sky is the limit",
  "game changer",
  "seamless integration",
  "unlock the potential",
  "foster a culture",
  "navigate the complexities",
  "journey to",
];

/** Openings that say nothing. */
export const BANNED_OPENERS = [
  "in today's",
  "in a world where",
  "imagine a world",
  "picture this",
  "let me paint you a picture",
  "welcome to",
  "hello everyone",
  "good morning everyone",
  "in the ever-evolving",
  "in the fast-paced",
];

/** Words that are fine in a sentence and wrong in a title. */
const TITLE_CASE_EXCEPTIONS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "over",
  "the",
  "to",
  "with",
]);

export type RuleViolation = {
  /** the index of the slide, or -1 for the deck as a whole */
  slide: number;
  /** which rule it breaks */
  rule: string;
  /** what to change */
  message: string;
};

/** every string on a slide, joined, for the text checks */
const slideText = (slide: DemoSlideSpec): string => {
  const parts: string[] = [];

  switch (slide.kind) {
    case "cover":
      parts.push(slide.title, slide.subtitle);
      break;
    case "statement":
      parts.push(slide.text, slide.detail ?? "");
      break;
    case "section":
      parts.push(slide.marker, slide.title, slide.summary);
      break;
    case "bullets":
      parts.push(slide.title, ...slide.bullets);
      break;
    case "steps":
      parts.push(
        slide.title,
        ...slide.steps.flatMap((step) => [step.label, step.body]),
      );
      break;
    case "quote":
      parts.push(slide.quote, slide.cite);
      break;
    case "table":
      parts.push(slide.title, ...slide.headers, ...slide.rows.flat());
      break;
    case "code":
      parts.push(slide.title, slide.code);
      break;
    case "chart":
      parts.push(
        slide.title,
        slide.axis,
        ...slide.bars.flatMap((bar) => [bar.label, bar.note ?? ""]),
      );
      break;
    case "diagram":
      parts.push(
        slide.title,
        ...slide.nodes.flatMap((node) => [node.label, node.body]),
      );
      break;
    case "number":
      parts.push(slide.title, slide.value, slide.caption);
      break;
    case "compare":
      parts.push(
        slide.title,
        slide.left.heading,
        ...slide.left.lines,
        slide.right.heading,
        ...slide.right.lines,
      );
      break;
    case "takeaway":
      parts.push(slide.title, slide.body, ...slide.points);
      break;
    case "end":
      parts.push(
        slide.title,
        slide.body,
        ...slide.links.flatMap((link) => [link.label, link.detail]),
      );
      break;
  }

  if (slide.notes) {
    parts.push(slide.notes);
  }

  return parts.filter(Boolean).join(" \n ");
};

/** the title of a slide, whatever form it takes */
const titleOf = (slide: DemoSlideSpec): string => {
  switch (slide.kind) {
    case "statement":
      return slide.text;
    case "quote":
      return slide.quote;
    default:
      return slide.title;
  }
};

/**
 * A title is a conclusion, so it reads as a sentence. A title whose words
 * are all capitalised is a label, not a claim, which is what the rules mean
 * by one case convention.
 */
export const isTitleCase = (title: string): boolean => {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    return false;
  }

  const significant = words.filter(
    (word) => !TITLE_CASE_EXCEPTIONS.has(word.toLowerCase()),
  );
  if (significant.length < 2) {
    return false;
  }

  // a word counts as capitalised when it starts with an upper case letter
  // and is not an acronym, which is all upper case
  const capitalised = significant.filter((word) => {
    const first = word[0];
    if (!/[A-Z]/.test(first)) {
      return false;
    }
    return !/^[A-Z0-9./+-]+$/.test(word);
  });

  return capitalised.length >= 2;
};

/**
 * Whether a slide makes a claim. A title that is a bare noun phrase names
 * a topic rather than stating a conclusion.
 */
export const isActionTitle = (title: string): boolean => {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  // a conclusion carries a verb, so the title is checked for one
  return words.some((word) => isVerb(word.toLowerCase()));
};

/**
 * The verbs a conclusion is usually built on, as their stem. A word counts
 * as one of them when it is the stem itself, or the stem with a usual
 * ending on it.
 */
const VERB_STEMS = [
  // auxiliaries
  "is",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "does",
  "do",
  "did",
  "can",
  "cannot",
  "will",
  "would",
  "should",
  "must",
  "may",
  "might",
  // the verbs a conclusion is usually built on
  "add",
  "answer",
  "arrive",
  "ask",
  "become",
  "beat",
  "block",
  "break",
  "bring",
  "carry",
  "change",
  "come",
  "cost",
  "count",
  "decide",
  "depend",
  "end",
  "fall",
  "fit",
  "get",
  "give",
  "go",
  "grow",
  "happen",
  "hold",
  "keep",
  "land",
  "leave",
  "lie",
  "lose",
  "make",
  "mean",
  "measure",
  "move",
  "need",
  "pay",
  "prove",
  "read",
  "remain",
  "require",
  "return",
  "rise",
  "run",
  "save",
  "send",
  "set",
  "show",
  "sit",
  "spend",
  "stand",
  "start",
  "take",
  "tell",
  "track",
  "turn",
  "wait",
  "walk",
  "waste",
  "win",
  "write",
];

/** the endings a verb takes in a title */
const VERB_ENDINGS = ["s", "es", "ed", "ing"];

const isVerb = (word: string): boolean => {
  if (VERB_STEMS.includes(word)) {
    return true;
  }
  return VERB_STEMS.some(
    (stem) =>
      word.length > stem.length &&
      word.startsWith(stem) &&
      VERB_ENDINGS.includes(word.slice(stem.length)),
  );
};

/**
 * Checks a deck against the rules that can be checked mechanically.
 *
 * The returned list is empty when the deck is clean.
 */
export const checkDeck = (slides: DemoSlideSpec[]): RuleViolation[] => {
  const problems: RuleViolation[] = [];

  slides.forEach((slide, index) => {
    const text = slideText(slide);
    const lower = text.toLowerCase();

    for (const word of BANNED_VOCABULARY) {
      const pattern = new RegExp(`\\b${word}\\w*\\b`, "i");
      if (pattern.test(text)) {
        problems.push({
          slide: index,
          rule: "banned-vocabulary",
          message: `uses "${word}", which reads as machine written`,
        });
      }
    }

    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) {
        problems.push({
          slide: index,
          rule: "banned-phrase",
          message: `uses the phrase "${phrase}"`,
        });
      }
    }

    const title = titleOf(slide);
    const opening = title.trim().toLowerCase();
    for (const opener of BANNED_OPENERS) {
      if (opening.startsWith(opener)) {
        problems.push({
          slide: index,
          rule: "banned-opener",
          message: `opens with "${opener}", which says nothing`,
        });
      }
    }

    if (isTitleCase(title)) {
      problems.push({
        slide: index,
        rule: "title-case",
        message:
          "the title is in title case; the deck uses one case convention, which is sentence case",
      });
    }

    // a title that names a topic rather than stating a conclusion
    if (
      slide.kind !== "quote" &&
      slide.kind !== "cover" &&
      slide.kind !== "section" &&
      !isActionTitle(title)
    ) {
      problems.push({
        slide: index,
        rule: "action-title",
        message:
          "the title names a topic; it should state what the slide establishes",
      });
    }

    // a slide with a number on it needs a source
    if (hasNumber(slide) && !slide.source) {
      problems.push({
        slide: index,
        rule: "source",
        message: "carries a number but has no source line",
      });
    }
  });

  // the same form twice in a row reads as a template
  for (let i = 1; i < slides.length; i++) {
    if (slides[i].kind === slides[i - 1].kind) {
      problems.push({
        slide: i,
        rule: "repeated-form",
        message: `uses the same form as the slide before it (${slides[i].kind})`,
      });
    }
  }

  // the deck should not open with a table of contents, and it should not
  // end on a thank you
  const last = slides[slides.length - 1];
  if (last && last.kind === "end") {
    const text = slideText(last).toLowerCase();
    if (text.includes("thank you") || text.includes("questions?")) {
      problems.push({
        slide: slides.length - 1,
        rule: "closing",
        message:
          "the closing slide should ask for a specific next step, not thank the audience",
      });
    }
  }

  return problems;
};

/** whether a slide shows a figure that would need a source */
const hasNumber = (slide: DemoSlideSpec): boolean => {
  switch (slide.kind) {
    case "number":
    case "chart":
    case "table":
      return true;
    case "bullets":
      return slide.bullets.some((bullet) => /\d/.test(bullet));
    case "steps":
      return slide.steps.some((step) => /\d/.test(step.body + step.label));
    case "compare":
      return [...slide.left.lines, ...slide.right.lines].some((line) =>
        /\d/.test(line),
      );
    case "takeaway":
      return slide.points.some((point) => /\d/.test(point));
    case "statement":
      return /\d/.test(slide.text + (slide.detail ?? ""));
    default:
      return false;
  }
};
