import { exportScene } from "@excalidraw/excalidraw";
import { cleanAppStateForExport } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { pointFrom } from "@excalidraw/math";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { animateSvg, orderElementsForRender } from "./animate";

const elementGroups = (svg: SVGSVGElement) =>
  [...svg.children].filter(
    (node) => node.tagName === "g" || node.tagName === "use",
  ) as SVGElement[];

const buildScene = () => {
  const frame = API.createElement({
    type: "frame",
    id: "frame-1",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  });
  const rect = API.createElement({
    id: "rect-1",
    x: 20,
    y: 20,
    width: 120,
    height: 80,
    frameId: frame.id,
    backgroundColor: "#ffc9c9",
  });
  const label = API.createElement({
    type: "text",
    id: "label-1",
    x: 30,
    y: 40,
    width: 90,
    height: 20,
    frameId: frame.id,
    text: "Hello",
    containerId: rect.id,
  });
  (rect as any).boundElements = [{ id: label.id, type: "text" }];
  const line = API.createElement({
    type: "line",
    id: "line-1",
    x: 160,
    y: 30,
    points: [pointFrom(0, 0), pointFrom(80, 40)],
    frameId: frame.id,
  });
  const free = API.createElement({
    type: "freedraw",
    id: "free-1",
    x: 30,
    y: 150,
    points: [
      pointFrom(0, 0),
      pointFrom(20, 20),
      pointFrom(40, 5),
      pointFrom(60, 30),
    ],
    frameId: frame.id,
  });
  return { frame, elements: [frame, rect, label, line, free] };
};

const exportSvg = async (ordered: NonDeletedExcalidrawElement[]) =>
  (await exportScene({
    type: "svg",
    data: {
      elements: ordered,
      appState: cleanAppStateForExport({ viewBackgroundColor: "#ffffff" }),
      files: {},
    },
    config: {
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      padding: 0,
    },
  })) as SVGSVGElement;

describe("orderElementsForRender", () => {
  it("places bound labels right after their container", () => {
    const label = {
      id: "l",
      type: "text",
      containerId: "r",
    } as unknown as NonDeletedExcalidrawElement;
    const rect = {
      id: "r",
      type: "rectangle",
      boundElements: [{ id: "l", type: "text" }],
    } as unknown as NonDeletedExcalidrawElement;
    const line = {
      id: "x",
      type: "line",
    } as unknown as NonDeletedExcalidrawElement;

    expect(
      orderElementsForRender([label, rect, line]).map((el) => el.id),
    ).toEqual(["r", "l", "x"]);
  });

  it("defers embeddables/iframes to the end", () => {
    const embed = {
      id: "e",
      type: "embeddable",
    } as unknown as NonDeletedExcalidrawElement;
    const rect = {
      id: "r",
      type: "rectangle",
    } as unknown as NonDeletedExcalidrawElement;

    expect(orderElementsForRender([embed, rect]).map((el) => el.id)).toEqual([
      "r",
      "e",
    ]);
  });
});

describe("animateSvg", () => {
  it("matches the exported groups and injects draw-in animations", async () => {
    const { elements } = buildScene();
    const ordered = orderElementsForRender(elements.slice(1));
    const svg = await exportSvg(ordered);
    const groups = elementGroups(svg);

    expect(groups.length).toBe(ordered.length);

    const { finishedMs } = animateSvg(svg, ordered, {
      startMs: 0,
      elementDuration: 100,
    });

    expect(finishedMs).toBeGreaterThan(0);
    expect(svg.querySelectorAll("animate").length).toBeGreaterThan(0);
  });

  it("hides shapes until their slot and types text along a path", async () => {
    const { elements } = buildScene();
    const ordered = orderElementsForRender(elements.slice(1));
    const svg = await exportSvg(ordered);
    const groups = elementGroups(svg);

    animateSvg(svg, ordered, { startMs: 0, elementDuration: 100 });

    // rect group: [fill, stroke] — the stroke is hidden until it draws
    const rectGroup = groups[0];
    const stroke = rectGroup.childNodes[1] as SVGElement;
    expect(stroke.tagName).toBe("path");
    expect(stroke.getAttribute("opacity")).toBe("0");
    expect(stroke.querySelector('animate[attributeName="d"]')).not.toBeNull();

    // freedraw: interpolated along the stroke outline
    const freeGroup = groups[ordered.findIndex((el) => el.type === "freedraw")];
    expect(
      freeGroup.querySelector('animate[attributeName="d"]'),
    ).not.toBeNull();

    // text: rendered as a textPath animated by a path in <defs>
    const textPath = svg.querySelector("textPath");
    expect(textPath).not.toBeNull();
    const id = textPath?.getAttribute("href")?.slice(1);
    expect(id).toBeTruthy();
    expect(svg.querySelector(`defs path[id="${id}"]`)).not.toBeNull();
    expect(
      svg.querySelector("defs path")?.querySelector("animate"),
    ).not.toBeNull();
  });

  it("falls back to a fade for unknown element types", async () => {
    const { elements } = buildScene();
    const ordered = orderElementsForRender(elements.slice(1));
    const svg = await exportSvg(ordered);
    const groups = elementGroups(svg);

    // pretend the first group is an embeddable we don't know how to sketch
    const unknown = {
      ...ordered[0],
      type: "embeddable",
    } as unknown as NonDeletedExcalidrawElement;

    expect(() =>
      animateSvg(svg, [unknown, ...ordered.slice(1)], {
        startMs: 0,
        elementDuration: 100,
      }),
    ).not.toThrow();

    expect(groups[0].getAttribute("opacity")).toBe("0");
    expect(
      groups[0].querySelector('animate[attributeName="opacity"]'),
    ).not.toBeNull();
  });

  it("fades very complex shapes instead of generating huge keyframes", () => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg") as SVGSVGElement;
    const group = document.createElementNS(ns, "g");
    const path = document.createElementNS(ns, "path");
    // a large ellipse is tessellated into hundreds of curves by the renderer
    path.setAttribute(
      "d",
      `M0 0 ${Array.from(
        { length: 40 },
        (_, i) => `C${i} 0, ${i + 1} 0, ${i + 2} 0`,
      ).join(" ")}`,
    );
    group.appendChild(path);
    svg.appendChild(group);

    const ellipse = {
      id: "big-ellipse",
      type: "ellipse",
      groupIds: [],
    } as unknown as NonDeletedExcalidrawElement;

    animateSvg(svg, [ellipse], { startMs: 0, elementDuration: 100 });

    expect(group.getAttribute("opacity")).toBe("0");
    expect(
      group.querySelector('animate[attributeName="opacity"]'),
    ).not.toBeNull();
    expect(svg.querySelectorAll("animate").length).toBe(1);
  });

  it("caps the total duration on busy slides", async () => {
    const makeSvg = (count: number) => {
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      ) as SVGSVGElement;
      for (let i = 0; i < count; i++) {
        svg.appendChild(
          document.createElementNS("http://www.w3.org/2000/svg", "g"),
        );
      }
      return svg;
    };
    const elements = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `el-${i}`,
        type: "rectangle",
        groupIds: [],
      })) as unknown as NonDeletedExcalidrawElement[];

    // 8 elements, per-object 500ms — the 1000ms budget shortens them
    const capped = animateSvg(makeSvg(8), elements(8), {
      startMs: 100,
      elementDuration: 500,
      maxTotalDuration: 1000,
    });
    expect(capped.finishedMs).toBeLessThan(2000);

    // 30 elements can't go below the per-element floor, but should still be
    // bounded (not 30 × 500ms)
    const busy = animateSvg(makeSvg(30), elements(30), {
      startMs: 100,
      elementDuration: 500,
      maxTotalDuration: 1000,
    });
    expect(busy.finishedMs).toBeLessThan(4000);
  });
});
