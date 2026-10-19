import { getFreedrawOutlinePoints } from "@excalidraw/element";

import type {
  ExcalidrawFreeDrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

/**
 * Hand-drawn "sketch" animation for a slide.
 *
 * This is a port of the technique used by
 * [dai-shi/excalidraw-animate](https://github.com/dai-shi/excalidraw-animate):
 * the scene is exported to a plain SVG and then SMIL `<animate>` elements are
 * injected into it so every shape draws itself stroke-first, fills fade in
 * after the outline, and text is "typed" along an animated path. The result
 * looks like the slide is being sketched live.
 *
 * The animation only works on the *exported* SVG (the canvas renderer has no
 * notion of per-element drawing progress), which is why the presenter overlays
 * an animated SVG snapshot for the duration of the effect.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export type AnimateOptions = {
  /** delay before the first element starts drawing, in ms */
  startMs?: number;
  /** how long a single element takes to draw, in ms (upper bound) */
  elementDuration?: number;
  /** total budget shared by the members of a grouped set, in ms */
  groupDuration?: number;
  /**
   * Upper bound on the whole sequence, in ms — busy slides shorten their
   * per-element time so the animation never drags.
   */
  maxTotalDuration?: number;
  /** prefix for ids generated for the text reveal paths */
  idPrefix?: string;
};

const DEFAULTS = {
  startMs: 150,
  elementDuration: 450,
  groupDuration: 3600,
  maxTotalDuration: 2400,
  minElementDuration: 60,
  idPrefix: "exc-typo",
};

// freedraw outline → svg path (mirrors the exporter, which isn't a public API)

const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

const med = (a: number[], b: number[]) => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

const getSvgPathFromStroke = (points: number[][]): string => {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc: (string | number[])[], point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};

const getFreeDrawSvgPath = (element: ExcalidrawFreeDrawElement) =>
  getSvgPathFromStroke(getFreedrawOutlinePoints(element));

// SMIL helpers

const findNode = (element: SVGElement, name: string) => {
  const childNodes = element.childNodes as NodeListOf<SVGElement>;
  for (let i = 0; i < childNodes.length; ++i) {
    if (childNodes[i].tagName === name) {
      return childNodes[i];
    }
  }
  return null;
};

/** hides the element, then re-shows it at `currentMs` (used to sequence). */
const hideBeforeAnimation = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
  freeze?: boolean,
) => {
  element.setAttribute("opacity", "0");
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "opacity");
  animate.setAttribute("from", "1");
  animate.setAttribute("to", "1");
  animate.setAttribute("begin", `${currentMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  if (freeze) {
    animate.setAttribute("fill", "freeze");
  }
  element.appendChild(animate);
};

const animateOpacity = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
  from = "0",
  to?: string,
) => {
  const target = to ?? element.getAttribute("opacity") ?? "1";
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "opacity");
  animate.setAttribute("from", from);
  animate.setAttribute("to", target);
  animate.setAttribute("begin", `${currentMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  animate.setAttribute("fill", "freeze");
  element.appendChild(animate);
  element.setAttribute("opacity", from);
};

const createAnimator = (
  svg: SVGSVGElement,
  attributeName: string,
  from: string,
  to: string,
  beginMs: number,
  durationMs: number,
) => {
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", attributeName);
  animate.setAttribute("from", from);
  animate.setAttribute("to", to);
  animate.setAttribute("begin", `${beginMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  animate.setAttribute("fill", "freeze");
  return animate;
};

const animatePath = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  const dTo = element.getAttribute("d") || "";
  const mCount = dTo.match(/M/g)?.length || 0;
  const cCount = dTo.match(/C/g)?.length || 0;
  const repeat = mCount ? cCount / mCount : 1;
  let dLast = dTo;

  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          "M(\\S+) (\\S+)",
          "((?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){",
          `${i}`, // skip count
          "})",
          "(?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){1,}",
        ].join(""),
        "g",
      ),
      (...a) => {
        const [x, y] = a[3]
          ? a[3].match(/.* (\S+) (\S+)$/).slice(1, 3)
          : [a[1], a[2]];
        return `M${a[1]} ${a[2]}${
          a[3]
        }${` C${x} ${y}, ${x} ${y}, ${x} ${y}`.repeat(repeat - i)}`;
      },
    );
    if (i === 0) {
      element.setAttribute("d", dFrom);
    }
    element.appendChild(
      createAnimator(
        svg,
        "d",
        dFrom,
        dLast,
        currentMs + i * (durationMs / repeat),
        durationMs / repeat,
      ),
    );
    dLast = dFrom;
  }
  hideBeforeAnimation(svg, element, currentMs, durationMs, true);
};

const animateFillPath = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  const dTo = element.getAttribute("d") || "";
  if (dTo.includes("C")) {
    animatePath(svg, element, currentMs, durationMs);
    return;
  }
  const dFrom = dTo.replace(
    new RegExp(["M(\\S+) (\\S+)", "((?: L\\S+ \\S+){1,})"].join("")),
    (...a) => {
      return `M${a[1]} ${a[2]}${a[3].replace(/L\S+ \S+/g, `L${a[1]} ${a[2]}`)}`;
    },
  );
  element.setAttribute("d", dFrom);
  element.appendChild(
    createAnimator(svg, "d", dFrom, dTo, currentMs, durationMs),
  );
};

const animatePolygon = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  let dTo = element.getAttribute("d") || "";
  let mCount = dTo.match(/M/g)?.length || 0;
  let cCount = dTo.match(/C/g)?.length || 0;
  if (mCount === cCount + 1) {
    // workaround for round rect
    dTo = dTo.replace(/^M\S+ \S+ M/, "M");
    mCount = dTo.match(/M/g)?.length || 0;
    cCount = dTo.match(/C/g)?.length || 0;
  }
  if (mCount !== cCount) {
    throw new Error("unexpected m/c counts");
  }
  const dups = element.getAttribute("stroke-dasharray")
    ? 1
    : Math.min(2, mCount);
  const repeat = mCount / dups;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          "((?:",
          "M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?".repeat(dups),
          "){",
          `${i}`, // skip count
          "})",
          "M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?".repeat(dups),
          ".*",
        ].join(""),
        "g",
      ),
      (...a) => {
        return `${a[1]}${[...Array(dups).keys()]
          .map((d) => {
            const [x, y] = a.slice(2 + dups * 2 + d * 2);
            return `M${x} ${y} C${x} ${y}, ${x} ${y}, ${x} ${y} `;
          })
          .join("")
          .repeat(repeat - i)}`;
      },
    );
    if (i === 0) {
      element.setAttribute("d", dFrom);
    }
    element.appendChild(
      createAnimator(
        svg,
        "d",
        dFrom,
        dLast,
        currentMs + i * (durationMs / repeat),
        durationMs / repeat,
      ),
    );
    dLast = dFrom;
  }
  hideBeforeAnimation(svg, element, currentMs, durationMs, true);
};

const animateText = (
  svg: SVGSVGElement,
  width: number,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
  idPrefix: string,
) => {
  const anchor = element.getAttribute("text-anchor") || "start";
  if (anchor !== "start") {
    // centers/end-aligned text can't be typed along a straight path
    animateOpacity(svg, element, currentMs, durationMs, "0");
    return;
  }
  const x = Number(element.getAttribute("x") || 0);
  const y = Number(element.getAttribute("y") || 0);
  const id = `${idPrefix}-${currentMs}-${Math.round(x)}-${Math.round(y)}`;
  const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("id", id);
  path.appendChild(
    createAnimator(
      svg,
      "d",
      `m${x} ${y} h0`,
      `m${x} ${y} h${width}`,
      currentMs,
      durationMs,
    ),
  );
  const textPath = svg.ownerDocument.createElementNS(SVG_NS, "textPath");
  textPath.setAttribute("href", `#${id}`);
  textPath.textContent = element.textContent;
  element.textContent = " "; // HACK for Firefox as `null` does not work
  findNode(svg, "defs")?.appendChild(path);
  element.appendChild(textPath);
};

const animateFromToPath = (
  svg: SVGSVGElement,
  element: SVGElement,
  dFrom: string,
  dTo: string,
  currentMs: number,
  durationMs: number,
) => {
  const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
  path.appendChild(createAnimator(svg, "d", dFrom, dTo, currentMs, durationMs));
  element.appendChild(path);
};

const patchSvgLine = (
  svg: SVGSVGElement,
  element: SVGElement,
  isRounded: boolean,
  currentMs: number,
  durationMs: number,
) => {
  const animateLine = isRounded ? animatePath : animatePolygon;
  const childNodes = element.childNodes as NodeListOf<SVGElement>;
  const wrapper = childNodes[0];
  if (wrapper?.getAttribute("fill-rule")) {
    animateLine(
      svg,
      wrapper.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
    );
    animateFillPath(
      svg,
      wrapper.childNodes[0] as SVGElement,
      currentMs + durationMs * 0.75,
      durationMs * 0.25,
    );
  } else {
    animateLine(
      svg,
      wrapper.childNodes[0] as SVGElement,
      currentMs,
      durationMs,
    );
  }
};

const patchSvgArrow = (
  svg: SVGSVGElement,
  element: SVGElement,
  isRounded: boolean,
  currentMs: number,
  durationMs: number,
) => {
  const animateLine = isRounded ? animatePath : animatePolygon;
  const numParts = element.childNodes.length;
  animateLine(
    svg,
    element.childNodes[0].childNodes[0] as SVGElement,
    currentMs,
    (durationMs / (numParts + 2)) * 3,
  );
  currentMs += (durationMs / (numParts + 2)) * 3;
  for (let i = 1; i < numParts; i += 1) {
    const numChildren = element.childNodes[i].childNodes.length;
    for (let j = 0; j < numChildren; j += 1) {
      animatePath(
        svg,
        element.childNodes[i].childNodes[j] as SVGElement,
        currentMs,
        durationMs / (numParts + 2) / numChildren,
      );
      currentMs += durationMs / (numParts + 2) / numChildren;
    }
  }
};

const patchSvgRectangle = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  if (element.childNodes[1]) {
    animatePolygon(
      svg,
      element.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
    );
    animateFillPath(
      svg,
      element.childNodes[0] as SVGElement,
      currentMs + durationMs * 0.75,
      durationMs * 0.25,
    );
  } else {
    animatePolygon(
      svg,
      element.childNodes[0] as SVGElement,
      currentMs,
      durationMs,
    );
  }
};

const patchSvgEllipse = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  if (element.childNodes[1]) {
    animatePath(
      svg,
      element.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
    );
    animateFillPath(
      svg,
      element.childNodes[0] as SVGElement,
      currentMs + durationMs * 0.75,
      durationMs * 0.25,
    );
  } else {
    animatePath(
      svg,
      element.childNodes[0] as SVGElement,
      currentMs,
      durationMs,
    );
  }
};

const patchSvgText = (
  svg: SVGSVGElement,
  element: SVGElement,
  width: number,
  currentMs: number,
  durationMs: number,
  idPrefix: string,
) => {
  const childNodes = element.childNodes as NodeListOf<SVGElement>;
  const len = childNodes.length || 1;
  let cursor = currentMs;
  childNodes.forEach((child) => {
    animateText(svg, width, child, cursor, durationMs / len, idPrefix);
    cursor += durationMs / len;
  });
};

const patchSvgFreedraw = (
  svg: SVGSVGElement,
  element: SVGElement,
  freeDrawElement: NonDeleted<ExcalidrawFreeDrawElement>,
  currentMs: number,
  durationMs: number,
) => {
  const childNode = element.childNodes[0] as SVGPathElement;
  if (!childNode) {
    animateOpacity(svg, element, currentMs, durationMs, "0");
    return;
  }
  childNode.setAttribute("opacity", "0");
  const reveal = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  reveal.setAttribute("attributeName", "opacity");
  reveal.setAttribute("from", "0");
  reveal.setAttribute("to", "1");
  reveal.setAttribute("calcMode", "discrete");
  reveal.setAttribute("begin", `${currentMs + durationMs - 1}ms`);
  reveal.setAttribute("dur", "1ms");
  reveal.setAttribute("fill", "freeze");
  childNode.appendChild(reveal);

  // interpolate the outline as the stroke is "drawn": oldest→newest points
  const repeat = freeDrawElement.points.length;
  let dTo = childNode.getAttribute("d") as string;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom =
      i > 0
        ? getFreeDrawSvgPath({
            ...freeDrawElement,
            points: freeDrawElement.points.slice(0, i),
          })
        : "M 0 0";
    animateFromToPath(
      svg,
      element,
      dFrom,
      dTo,
      currentMs + i * (durationMs / repeat),
      durationMs / repeat,
    );
    dTo = dFrom;
  }
};

const patchSvgImage = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  animateOpacity(svg, element, currentMs, durationMs, "0");
};

/** fallback for element types we don't know how to sketch */
const patchGeneric = (
  svg: SVGSVGElement,
  element: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  animateOpacity(svg, element, currentMs, durationMs, "0");
};

/**
 * Very large or heavily segmented paths (e.g. a big decorative ellipse, which
 * the renderer tessellates into hundreds of curves) would turn into megabytes
 * of SMIL keyframes — each interpolated step repeats the whole path. Such
 * shapes are decorative, so fade them in instead of sketching every segment.
 */
const MAX_SKETCH_PATH_LENGTH = 800;
const MAX_SKETCH_SEGMENTS = 32;

const SKETCHED_TYPES = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
]);

const isTooComplexToSketch = (
  node: SVGElement,
  element: NonDeletedExcalidrawElement,
) => {
  if (!SKETCHED_TYPES.has(element.type)) {
    return false;
  }
  const paths = node.querySelectorAll("path");
  for (const path of paths) {
    const d = path.getAttribute("d") || "";
    if (d.length > MAX_SKETCH_PATH_LENGTH) {
      return true;
    }
    if ((d.match(/C/g)?.length || 0) > MAX_SKETCH_SEGMENTS) {
      return true;
    }
  }
  return false;
};

const patchSvgEle = (
  svg: SVGSVGElement,
  element: SVGElement,
  excalidrawElement: NonDeletedExcalidrawElement,
  currentMs: number,
  durationMs: number,
  idPrefix: string,
) => {
  const { type, roundness, width } = excalidrawElement;
  if (type === "line") {
    patchSvgLine(svg, element, !!roundness, currentMs, durationMs);
  } else if (type === "arrow") {
    patchSvgArrow(svg, element, !!roundness, currentMs, durationMs);
  } else if (type === "rectangle" || type === "diamond") {
    patchSvgRectangle(svg, element, currentMs, durationMs);
  } else if (type === "ellipse") {
    patchSvgEllipse(svg, element, currentMs, durationMs);
  } else if (type === "text") {
    patchSvgText(svg, element, width, currentMs, durationMs, idPrefix);
  } else if (type === "freedraw") {
    patchSvgFreedraw(svg, element, excalidrawElement, currentMs, durationMs);
  } else if (type === "image") {
    patchSvgImage(svg, element, currentMs, durationMs);
  } else {
    patchGeneric(svg, element, currentMs, durationMs);
  }
};

const createGroups = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const groups: Record<string, [SVGElement, number][]> = {};
  let index = 0;
  const childNodes = svg.childNodes as NodeListOf<SVGElement>;
  childNodes.forEach((element) => {
    if (element.tagName === "g" || element.tagName === "use") {
      const source = elements[index];
      const groupIds = source?.groupIds;
      if (groupIds && groupIds.length >= 1) {
        const groupId = groupIds[0];
        groups[groupId] = groups[groupId] || [];
        groups[groupId].push([element, index]);
      }
      index += 1;
    }
  });
  return groups;
};

const filterGroupNodes = (nodes: NodeListOf<SVGElement>) =>
  [...nodes].filter(
    (node) => node.tagName === "g" || node.tagName === "use" /* images */,
  );

const extractNumberFromElement = (
  element: NonDeletedExcalidrawElement | undefined,
  key: string,
) => {
  const match = element?.id.match(new RegExp(`${key}:(-?\\d+)`));
  return (match && Number(match[1])) || 0;
};

const sortSvgNodes = (
  nodes: SVGElement[],
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  [...nodes].sort((a, b) => {
    const aOrder = extractNumberFromElement(
      elements[nodes.indexOf(a)],
      "animateOrder",
    );
    const bOrder = extractNumberFromElement(
      elements[nodes.indexOf(b)],
      "animateOrder",
    );
    return aOrder - bOrder;
  });

/**
 * Injects the draw-in animation into `svg`, which must be the exported SVG of
 * `elements` in the same order (see `orderElementsForRender`).
 *
 * @returns the time at which the whole animation has finished, in ms
 */
export const animateSvg = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
  options: AnimateOptions = {},
): { finishedMs: number } => {
  const startMs = options.startMs ?? DEFAULTS.startMs;
  const groupDur = options.groupDuration ?? DEFAULTS.groupDuration;
  const idPrefix = options.idPrefix ?? DEFAULTS.idPrefix;
  const maxTotal = options.maxTotalDuration ?? DEFAULTS.maxTotalDuration;
  const individualDur = Math.min(
    options.elementDuration ?? DEFAULTS.elementDuration,
    Math.max(
      DEFAULTS.minElementDuration,
      maxTotal / Math.max(1, elements.length),
    ),
  );

  const finished = new Set<SVGElement>();
  let current = startMs;

  let groupNodes: SVGElement[];
  try {
    groupNodes = filterGroupNodes(svg.childNodes as NodeListOf<SVGElement>);
  } catch {
    return { finishedMs: startMs + individualDur };
  }

  // the exporter skipped/added a node we didn't account for — degrade to a
  // simple sequential fade instead of drawing the wrong shape
  const mismatch = groupNodes.length !== elements.length;

  const groups: Record<string, [SVGElement, number][]> = mismatch
    ? {}
    : createGroups(svg, elements);
  const elementForNode = new Map<SVGElement, NonDeletedExcalidrawElement>();
  if (!mismatch) {
    groupNodes.forEach((node, index) => {
      const element = elements[index];
      if (element) {
        elementForNode.set(node, element);
      }
    });
  }

  /** animates one exported group, falling back to a fade if anything is off */
  const animateOne = (
    node: SVGElement,
    element: NonDeletedExcalidrawElement | undefined,
    durationMs: number,
  ) => {
    try {
      if (element && !isTooComplexToSketch(node, element)) {
        patchSvgEle(svg, node, element, current, durationMs, idPrefix);
      } else {
        patchGeneric(svg, node, current, durationMs);
      }
    } catch {
      patchGeneric(svg, node, current, durationMs);
    }
    finished.add(node);
    current += durationMs;
  };

  const ordered = mismatch ? groupNodes : sortSvgNodes(groupNodes, elements);

  for (const node of ordered) {
    if (finished.has(node)) {
      continue;
    }
    const element = elementForNode.get(node);
    const groupIds = !mismatch && element ? element.groupIds : undefined;

    if (groupIds?.length) {
      // animating a grouped set: one slot per member, paced by the group budget
      const groupId = groupIds[0];
      const group = groups[groupId];
      if (group) {
        for (const [childNode, childIndex] of group) {
          if (finished.has(childNode)) {
            continue;
          }
          const childElement = elements[childIndex];
          const duration =
            extractNumberFromElement(childElement, "animateDuration") ||
            groupDur / (group.length + 1);
          animateOne(childNode, childElement, duration);
        }
        delete groups[groupId];
        continue;
      }
    }

    const duration = element
      ? extractNumberFromElement(element, "animateDuration") || individualDur
      : individualDur;
    animateOne(node, element, duration);
  }

  // small tail so trailing fills are visible before the overlay is removed
  return { finishedMs: current + 200 };
};

/**
 * Orders `elements` to match the order the SVG exporter renders them in, so
 * the injected animation lines up 1:1 with the exported groups.
 *
 * The exporter renders a container and then its bound label(s), and skips the
 * label when it is iterated itself; iframes/embeddables are rendered last.
 */
export const orderElementsForRender = (
  elements: readonly NonDeletedExcalidrawElement[],
): NonDeletedExcalidrawElement[] => {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const isBoundLabel = (el: NonDeletedExcalidrawElement) =>
    el.type === "text" && !!el.containerId && byId.has(el.containerId);

  const placed = new Set<string>();
  const ordered: NonDeletedExcalidrawElement[] = [];
  const deferred: NonDeletedExcalidrawElement[] = [];

  const push = (el: NonDeletedExcalidrawElement) => {
    if (placed.has(el.id)) {
      return;
    }
    placed.add(el.id);
    ordered.push(el);
  };

  for (const element of elements) {
    if (element.type === "embeddable" || element.type === "iframe") {
      deferred.push(element);
      continue;
    }
    if (isBoundLabel(element)) {
      continue;
    }
    push(element);
    for (const bound of element.boundElements ?? []) {
      if (bound.type === "text") {
        const label = byId.get(bound.id);
        if (label) {
          push(label);
        }
      }
    }
  }

  for (const element of elements) {
    if (!placed.has(element.id)) {
      deferred.push(element);
    }
  }

  for (const element of deferred) {
    push(element);
  }

  return ordered;
};
