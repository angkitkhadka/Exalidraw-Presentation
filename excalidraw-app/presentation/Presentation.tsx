import { isWritableElement } from "@excalidraw/common";
import { isFrameLikeElement, newElementWith } from "@excalidraw/element";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import {
  chevronLeftIcon,
  chevronRight,
  EraserIcon,
  laserPointerToolIcon,
  pencilIcon,
  SelectionIcon,
} from "@excalidraw/excalidraw/components/icons";
import clsx from "clsx";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AppState,
  ElementRenderOverride,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtom } from "../app-jotai";

import {
  getElementStep,
  getSlideAnimateDuration,
  getSlideIndexAtViewportCenter,
  getSlideMaxStep,
  getSlidePresentationData,
  getSlides,
  slideAnimates,
} from "./slides";
import { SlideDrawIn } from "./SlideDrawIn";
import { clearSlideSvgCache, prefetchSlideSvg } from "./slideSvg";
import { presentationAtom } from "./state";
import "./Presentation.scss";

import type { Slide, SlideTransition } from "./slides";

type PresenterTool = "select" | "laser" | "draw" | "eraser";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

const PEN_COLORS = ["#e03131", "#1971c2", "#2f9e44", "#f08c00", "#ffffff"];

const SLIDE_ANIMATION_DURATION = 380;
const REVEAL_ANIMATION_DURATION = 280;

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const Presentation = () => {
  const api = useExcalidrawAPI();

  if (!api) {
    return null;
  }

  return <PresentationOverlay api={api} />;
};

const PresentationOverlay = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const [presentation, setPresentation] = useAtom(presentationAtom);

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [tool, setTool] = useState<PresenterTool>("select");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [blackout, setBlackout] = useState<"none" | "black" | "white">("none");
  const [hudVisible, setHudVisible] = useState(true);
  const [flashKey, setFlashKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [drawActive, setDrawActive] = useState(false);
  const [drawNonce, setDrawNonce] = useState(0);
  const drawActiveRef = useRef(false);

  /** keeps the ref (read by non-React handlers) in sync with the state */
  const setDrawing = useCallback((value: boolean) => {
    drawActiveRef.current = value;
    setDrawActive(value);
  }, []);

  const active = presentation.active;

  const slidesRef = useRef<Slide[]>([]);
  const indexRef = useRef(0);
  const stepRef = useRef(1);
  const rafRef = useRef<number | undefined>(undefined);
  const skipFullscreenExitRef = useRef(false);
  const initialIdsRef = useRef<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const viewTransitionTokenRef = useRef(0);
  const savedRef = useRef<{
    scrollX: number;
    scrollY: number;
    zoom: AppState["zoom"];
    viewBackgroundColor: string;
    frameRendering: AppState["frameRendering"];
    tool: AppState["activeTool"];
    openSidebar: AppState["openSidebar"];
  } | null>(null);

  // step visibility

  const applyStepVisibility = useCallback(
    (slide: Slide, nextStep: number, opts?: { hideAll?: boolean }) => {
      const overrides = new Map<string, ElementRenderOverride>();
      for (const element of slide.elements) {
        if (opts?.hideAll || getElementStep(element) > nextStep) {
          overrides.set(element.id, { opacity: 0 });
        }
      }
      window.cancelAnimationFrame(rafRef.current!);
      api.setElementRenderOverrides(overrides);
    },
    [api],
  );

  const revealStep = useCallback(
    (slide: Slide, nextStep: number) => {
      if (drawActiveRef.current) {
        // the draw-in overlay covers the canvas; the new step is applied as
        // soon as the animation finishes
        return;
      }
      const overrides = new Map<string, ElementRenderOverride>();
      const revealed: { id: string; opacity: number }[] = [];

      for (const element of slide.elements) {
        const elementStep = getElementStep(element);
        if (elementStep > nextStep) {
          overrides.set(element.id, { opacity: 0 });
        } else if (elementStep === nextStep) {
          revealed.push({ id: element.id, opacity: element.opacity ?? 100 });
        }
      }

      if (!revealed.length) {
        api.setElementRenderOverrides(overrides);
        return;
      }

      const start = performance.now();
      const tick = () => {
        const progress = Math.min(
          1,
          (performance.now() - start) / REVEAL_ANIMATION_DURATION,
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        const frame = new Map(overrides);
        for (const item of revealed) {
          frame.set(item.id, { opacity: item.opacity * eased });
        }
        api.setElementRenderOverrides(frame);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      window.cancelAnimationFrame(rafRef.current!);
      rafRef.current = requestAnimationFrame(tick);
    },
    [api],
  );

  // navigation

  /**
   * `setViewport()` commits asynchronously; wait until the committed viewport
   * actually differs from `before` (or the timeout elapses) before doing
   * anything that depends on the new scroll/zoom.
   */
  const afterViewport = useCallback(
    (
      before: Pick<AppState, "scrollX" | "scrollY" | "zoom">,
      callback: () => void,
    ) => {
      const deadline = performance.now() + 320;
      const tick = () => {
        const next = api.getAppState();
        const settled =
          next.scrollX !== before.scrollX ||
          next.scrollY !== before.scrollY ||
          next.zoom.value !== before.zoom.value;
        if (settled || performance.now() > deadline) {
          callback();
          return;
        }
        window.setTimeout(tick, 8);
      };
      window.setTimeout(tick, 8);
    },
    [api],
  );

  /**
   * Animates between two slides with the browser's View Transitions API.
   *
   * The canvas container is captured as a single image, the viewport is moved
   * to the incoming slide while the screen is frozen, and then CSS animates
   * the old and new snapshots (push, wipe, flip, …). The presenter HUD is
   * captured separately and stays put.
   */
  const runSlideTransition = useCallback(
    (transition: SlideTransition, commit: () => void, after: () => void) => {
      const doc = document as ViewTransitionDocument;
      const container = overlayRef.current?.closest<HTMLElement>(".excalidraw");

      if (!doc.startViewTransition || !container || prefersReducedMotion()) {
        commit();
        after();
        return;
      }

      const token = ++viewTransitionTokenRef.current;
      const root = document.documentElement;

      root.dataset.excVt = transition;
      container.style.setProperty("view-transition-name", "exc-slide");

      const cleanup = () => {
        // a newer navigation may have superseded this transition
        if (viewTransitionTokenRef.current !== token) {
          return;
        }
        container.style.removeProperty("view-transition-name");
        delete root.dataset.excVt;
      };

      try {
        const viewTransition = doc.startViewTransition(async () => {
          const before = api.getAppState();
          commit();
          // The browser waits for this callback before capturing the new
          // slide, but `setViewport()` commits asynchronously — poll the
          // committed viewport so the capture shows the incoming slide.
          // (rAF is paused during this phase, so timers are used instead.)
          const deadline = performance.now() + 250;
          while (performance.now() < deadline) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 8);
            });
            const next = api.getAppState();
            if (
              next.scrollX !== before.scrollX ||
              next.scrollY !== before.scrollY ||
              next.zoom.value !== before.zoom.value
            ) {
              break;
            }
          }
        });
        viewTransition.finished.then(
          () => {
            cleanup();
            after();
          },
          () => {
            cleanup();
            after();
          },
        );
      } catch {
        cleanup();
        commit();
        after();
      }
    },
    [api],
  );

  const goto = useCallback(
    (
      targetIndex: number,
      opts?: { animate?: boolean; step?: number; draw?: boolean },
    ): boolean => {
      const slides = slidesRef.current;
      if (!slides.length) {
        return false;
      }
      const clamped = Math.max(0, Math.min(slides.length - 1, targetIndex));
      const slide = slides[clamped];
      const previousIndex = indexRef.current;

      indexRef.current = clamped;
      setIndex(clamped);

      const initialStep = Math.max(
        1,
        Math.min(opts?.step ?? 1, getSlideMaxStep(slide)),
      );
      stepRef.current = initialStep;
      setStep(initialStep);

      const transition =
        getSlidePresentationData(slide.frame).transition ?? "glide";
      const animate = opts?.animate !== false && clamped !== previousIndex;
      const shouldDraw =
        opts?.draw !== false &&
        slideAnimates(slide.frame) &&
        !prefersReducedMotion();

      const target: [number, number, number, number] = [
        slide.frame.x,
        slide.frame.y,
        slide.frame.x + slide.frame.width,
        slide.frame.y + slide.frame.height,
      ];

      const commit = () => {
        api.setViewport({
          target,
          fit: "contain",
          offsets: { top: 0, right: 0, bottom: 0, left: 0 },
          animation: false,
          lock: { scroll: true, zoom: true, overscroll: false },
        });
      };

      // Hide the incoming slide's content *before* it becomes visible. Without
      // this the audience would see the finished slide for a beat while the
      // animated SVG snapshot is still being exported.
      applyStepVisibility(slide, initialStep, { hideAll: shouldDraw });

      // hide any running draw-in while the slide changes
      setDrawing(false);

      // warm neighbouring slides in the background so navigation is instant
      const prefetchAround = (index: number) => {
        const theme = api.getAppState().theme;
        const nextSlide = slides[index + 1];
        if (nextSlide && slideAnimates(nextSlide.frame)) {
          prefetchSlideSvg(api, nextSlide, 1, theme);
        }
        const previousSlide = slides[index - 1];
        if (previousSlide && slideAnimates(previousSlide.frame)) {
          prefetchSlideSvg(
            api,
            previousSlide,
            getSlideMaxStep(previousSlide),
            theme,
          );
        }
      };

      const before = api.getAppState();
      const scheduleDraw = () => {
        if (!shouldDraw) {
          return;
        }
        afterViewport(before, () => {
          setDrawNonce((nonce) => nonce + 1);
          setDrawing(true);
        });
        // after the incoming slide is on screen, prepare the neighbours
        window.setTimeout(() => prefetchAround(clamped), 400);
      };

      if (!animate || transition === "cut") {
        commit();
        scheduleDraw();
        return true;
      }

      if (transition === "glide") {
        api.setViewport({
          target,
          fit: "contain",
          offsets: { top: 0, right: 0, bottom: 0, left: 0 },
          animation: { duration: SLIDE_ANIMATION_DURATION },
          lock: { scroll: true, zoom: true, overscroll: false },
        });
        window.setTimeout(scheduleDraw, SLIDE_ANIMATION_DURATION);
        return true;
      }

      if (transition === "flash") {
        commit();
        setFlashKey((key) => key + 1);
        window.setTimeout(scheduleDraw, 340);
        return true;
      }

      runSlideTransition(transition, commit, scheduleDraw);
      return true;
    },
    [afterViewport, api, applyStepVisibility, runSlideTransition, setDrawing],
  );

  /** Called when the draw-in overlay is gone (or could not be shown). */
  const finishDraw = useCallback(
    (frameId: string) => {
      const slide = slidesRef.current[indexRef.current];
      if (!slide || slide.frame.id !== frameId) {
        return;
      }
      // the draw-in is over: reveal steps can animate again
      setDrawing(false);
      // the frame was hidden for the draw-in — restore normal visibility
      applyStepVisibility(slide, stepRef.current);
    },
    [applyStepVisibility, setDrawing],
  );

  const next = useCallback(() => {
    const slides = slidesRef.current;
    const slide = slides[indexRef.current];
    if (!slide) {
      return;
    }
    if (stepRef.current < getSlideMaxStep(slide)) {
      const nextStep = stepRef.current + 1;
      stepRef.current = nextStep;
      setStep(nextStep);
      revealStep(slide, nextStep);
      return;
    }
    if (indexRef.current < slides.length - 1) {
      goto(indexRef.current + 1);
    }
  }, [goto, revealStep]);

  const prev = useCallback(() => {
    const slide = slidesRef.current[indexRef.current];
    if (!slide) {
      return;
    }
    if (stepRef.current > 1) {
      const nextStep = stepRef.current - 1;
      stepRef.current = nextStep;
      setStep(nextStep);
      applyStepVisibility(slide, nextStep);
      return;
    }
    if (indexRef.current > 0) {
      const previous = slidesRef.current[indexRef.current - 1];
      // land on the previous slide fully revealed
      goto(indexRef.current - 1, { step: getSlideMaxStep(previous) });
    }
  }, [applyStepVisibility, goto]);

  // enter / exit

  const exit = useCallback(() => {
    const saved = savedRef.current;
    window.cancelAnimationFrame(rafRef.current!);
    api.setElementRenderOverrides(null);
    api.setViewport(null);

    if (saved) {
      api.updateFrameRendering(saved.frameRendering);
      api.updateScene({
        appState: {
          scrollX: saved.scrollX,
          scrollY: saved.scrollY,
          zoom: saved.zoom,
          viewBackgroundColor: saved.viewBackgroundColor,
          openSidebar: saved.openSidebar,
          selectedElementIds: {},
        },
      });
      api.setActiveTool(saved.tool);
    }

    if (document.fullscreenElement) {
      skipFullscreenExitRef.current = true;
      document.exitFullscreen().catch(() => {
        skipFullscreenExitRef.current = false;
      });
    }

    setNotesOpen(false);
    setHelpOpen(false);
    setBlackout("none");
    setTool("select");
    setDrawing(false);
    clearSlideSvgCache();
    setPresentation({ active: false, startIndex: -1 });
  }, [api, setDrawing, setPresentation]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const elements = api.getSceneElementsIncludingDeleted();
    const slides = getSlides(elements);

    if (!slides.length) {
      api.setToast({ message: "Add a slide (frame) first" });
      setPresentation({ active: false, startIndex: -1 });
      return;
    }

    slidesRef.current = slides;
    initialIdsRef.current = new Set(elements.map((el) => el.id));
    skipFullscreenExitRef.current = false;
    // don't carry an editor toast (e.g. "Added 25 slides") into the show
    api.setToast(null);

    const appState = api.getAppState();
    savedRef.current = {
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
      viewBackgroundColor: appState.viewBackgroundColor,
      frameRendering: { ...appState.frameRendering },
      tool: appState.activeTool,
      openSidebar: appState.openSidebar,
    };

    api.selection.clear();
    api.updateScene({
      appState: {
        openSidebar: null,
        selectedElementIds: {},
        contextMenu: null,
        editingTextElement: null,
      },
    });
    api.updateFrameRendering({ name: false, outline: false, clip: true });
    api.setActiveTool({ type: "selection" });

    const startIndex =
      presentation.startIndex >= 0
        ? presentation.startIndex
        : getSlideIndexAtViewportCenter(api, slides);

    clearSlideSvgCache();
    // start rendering the first slide before the viewport moves, so the
    // draw-in can begin as soon as the frame is on screen
    const startSlide = slides[startIndex];
    if (startSlide && slideAnimates(startSlide.frame)) {
      prefetchSlideSvg(api, startSlide, 1, api.getAppState().theme);
    }
    goto(startIndex, { animate: false });

    document.documentElement.requestFullscreen?.().catch(() => {});

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // leave fullscreen → leave presentation
  useEffect(() => {
    if (!active) {
      return;
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // `F` toggles fullscreen while staying in the presentation
        if (skipFullscreenExitRef.current) {
          skipFullscreenExitRef.current = false;
          return;
        }
        exit();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [active, exit]);

  // start the presentation from anywhere with F5
  useEffect(() => {
    if (active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F5") {
        return;
      }
      if (event.target instanceof Element && isWritableElement(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!getSlides(api.getSceneElementsIncludingDeleted()).length) {
        api.setToast({ message: "Add a slide (frame) first" });
        return;
      }
      setPresentation({ active: true, startIndex: -1 });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, api, setPresentation]);

  // tools

  const selectTool = useCallback(
    (nextTool: PresenterTool, color = penColor) => {
      setTool(nextTool);
      switch (nextTool) {
        case "select":
          api.setActiveTool({ type: "selection" });
          break;
        case "laser":
          api.setActiveTool({ type: "laser" });
          break;
        case "eraser":
          api.setActiveTool({ type: "eraser" });
          break;
        case "draw":
          api.updateScene({
            appState: {
              currentItemStrokeColor: color,
              currentItemBackgroundColor: "transparent",
              currentItemFillStyle: "solid",
              currentItemStrokeStyle: "solid",
              currentItemStrokeWidthKey: "medium",
              currentItemOpacity: 100,
            },
          });
          api.setActiveTool({ type: "freedraw", locked: true });
          break;
      }
    },
    [api, penColor],
  );

  const replayDraw = useCallback(() => {
    const slide = slidesRef.current[indexRef.current];
    if (!slide || !slideAnimates(slide.frame) || prefersReducedMotion()) {
      return;
    }
    setDrawNonce((nonce) => nonce + 1);
    setDrawing(true);
  }, [setDrawing]);

  const clearAnnotations = useCallback(() => {
    const slide = slidesRef.current[indexRef.current];
    if (!slide) {
      return;
    }
    const frameId = slide.frame.id;
    const elements = api.getSceneElementsIncludingDeleted();
    let didChange = false;
    const next = elements.map((el) => {
      if (
        el.frameId === frameId &&
        el.id !== frameId &&
        !initialIdsRef.current.has(el.id) &&
        !isFrameLikeElement(el)
      ) {
        didChange = true;
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    });
    if (didChange) {
      api.updateScene({ elements: next });
    }
  }, [api]);

  // keyboard

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && isWritableElement(event.target)) {
        return;
      }
      let handled = true;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          prev();
          break;
        case "Home":
          goto(0);
          break;
        case "End":
          goto(slidesRef.current.length - 1);
          break;
        case "Escape":
          if (helpOpen) {
            setHelpOpen(false);
            break;
          }
          if (notesOpen) {
            setNotesOpen(false);
            break;
          }
          if (blackout !== "none") {
            setBlackout("none");
            break;
          }
          if (tool !== "select") {
            selectTool("select");
            break;
          }
          exit();
          break;
        case "l":
        case "L":
          selectTool("laser");
          break;
        case "d":
        case "D":
        case "p":
        case "P":
          selectTool("draw");
          break;
        case "e":
        case "E":
          selectTool("eraser");
          break;
        case "v":
        case "V":
          selectTool("select");
          break;
        case "n":
        case "N":
          setNotesOpen((open) => !open);
          break;
        case "b":
        case "B":
          setBlackout((state) => (state === "black" ? "none" : "black"));
          break;
        case "w":
        case "W":
          setBlackout((state) => (state === "white" ? "none" : "white"));
          break;
        case "c":
        case "C":
          clearAnnotations();
          break;
        case "r":
        case "R":
          replayDraw();
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) {
            skipFullscreenExitRef.current = true;
            document.exitFullscreen().catch(() => {
              skipFullscreenExitRef.current = false;
            });
          } else {
            document.documentElement.requestFullscreen?.().catch(() => {});
          }
          break;
        case "F5":
          // already presenting — don't let the browser reload the page
          break;
        case "?":
        case "h":
        case "H":
          setHelpOpen((open) => !open);
          break;
        default: {
          const digit = Number(event.key);
          if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
            goto(digit - 1);
          } else {
            handled = false;
          }
        }
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    active,
    blackout,
    clearAnnotations,
    exit,
    goto,
    helpOpen,
    next,
    notesOpen,
    prev,
    replayDraw,
    selectTool,
    tool,
  ]);

  // misc: timer, auto-advance, hud auto-hide, refit on resize

  useEffect(() => {
    if (!active) {
      return;
    }
    const started = performance.now();
    setElapsed(0);
    const interval = window.setInterval(
      () => setElapsed(performance.now() - started),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const slide = slidesRef.current[index];
    const autoAdvance = slide
      ? getSlidePresentationData(slide.frame).autoAdvance ?? 0
      : 0;
    if (!autoAdvance) {
      return;
    }
    const timer = window.setTimeout(() => next(), autoAdvance);
    return () => window.clearTimeout(timer);
  }, [active, index, step, next]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let idleTimer: number | undefined;
    const showHud = () => {
      setHudVisible(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setHudVisible(false), 3000);
    };
    showHud();
    window.addEventListener("mousemove", showHud);
    window.addEventListener("pointerdown", showHud);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener("mousemove", showHud);
      window.removeEventListener("pointerdown", showHud);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let timer: number | undefined;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => goto(indexRef.current, { animate: false, draw: false }),
        200,
      );
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [active, goto]);

  const slide = slidesRef.current[index];
  const notes = slide ? getSlidePresentationData(slide.frame).notes ?? "" : "";
  const totalSteps = slide ? getSlideMaxStep(slide) : 1;

  if (!active || !slide) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={clsx("exc-present", {
        "exc-present--hud-hidden": !hudVisible,
      })}
    >
      {blackout !== "none" && (
        <div
          className={clsx(
            "exc-present__blackout",
            `exc-present__blackout--${blackout}`,
          )}
        />
      )}

      {flashKey > 0 && <div key={flashKey} className="exc-present__flash" />}

      {drawActive && slideAnimates(slide.frame) && (
        <SlideDrawIn
          key={`${slide.frame.id}:${drawNonce}`}
          api={api}
          slide={slide}
          step={step}
          duration={getSlideAnimateDuration(slide.frame)}
          nonce={drawNonce}
          onFinish={() => {
            const currentSlide = slidesRef.current[indexRef.current];
            if (currentSlide && currentSlide.frame.id === slide.frame.id) {
              applyStepVisibility(currentSlide, stepRef.current);
            }
          }}
          onDone={() => finishDraw(slide.frame.id)}
        />
      )}

      <div className="exc-present__topbar">
        <div className="exc-present__title">{slide.title}</div>
        <div className="exc-present__counter">
          {index + 1} / {slidesRef.current.length}
          {totalSteps > 1 ? ` · step ${step}/${totalSteps}` : ""}
        </div>
      </div>

      <div className="exc-present__hud">
        <div className="exc-present__group">
          <button
            type="button"
            title="Previous slide (Left arrow)"
            aria-label="Previous slide"
            onClick={prev}
          >
            {chevronLeftIcon}
          </button>
          <button
            type="button"
            title="Next slide (Right arrow)"
            aria-label="Next slide"
            onClick={next}
          >
            {chevronRight}
          </button>
        </div>

        <div className="exc-present__divider" />

        <div className="exc-present__group">
          <button
            type="button"
            className={clsx({ active: tool === "select" })}
            title="Pointer / select (V)"
            aria-label="Pointer"
            onClick={() => selectTool("select")}
          >
            {SelectionIcon}
          </button>
          <button
            type="button"
            className={clsx({ active: tool === "laser" })}
            title="Laser pointer (L)"
            aria-label="Laser pointer"
            onClick={() => selectTool("laser")}
          >
            {laserPointerToolIcon}
          </button>
          <button
            type="button"
            className={clsx({ active: tool === "draw" })}
            title="Draw (D)"
            aria-label="Draw"
            onClick={() => selectTool("draw")}
          >
            {pencilIcon}
          </button>
          <button
            type="button"
            className={clsx({ active: tool === "eraser" })}
            title="Eraser (E)"
            aria-label="Eraser"
            onClick={() => selectTool("eraser")}
          >
            {EraserIcon}
          </button>
        </div>

        {tool === "draw" && (
          <div className="exc-present__group exc-present__colors">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title="Pen color"
                className={clsx("exc-present__swatch", {
                  active: penColor === color,
                })}
                style={{ background: color }}
                onClick={() => {
                  setPenColor(color);
                  selectTool("draw", color);
                }}
              />
            ))}
          </div>
        )}

        <div className="exc-present__divider" />

        <div className="exc-present__group">
          <button
            type="button"
            className={clsx({ active: notesOpen })}
            title="Speaker notes (N)"
            onClick={() => setNotesOpen((open) => !open)}
          >
            Notes
          </button>
          <button
            type="button"
            title="Clear drawings on this slide (C)"
            onClick={clearAnnotations}
          >
            Clear ink
          </button>
          <button
            type="button"
            className={clsx({ active: blackout === "black" })}
            title="Blackout (B)"
            aria-label="Blackout"
            onClick={() =>
              setBlackout((state) => (state === "black" ? "none" : "black"))
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            title="Shortcuts (?)"
            onClick={() => setHelpOpen((open) => !open)}
          >
            ?
          </button>
        </div>

        <div className="exc-present__divider" />

        <div className="exc-present__group">
          <span className="exc-present__timer">{formatTime(elapsed)}</span>
          <button
            type="button"
            title="Leave presentation (Esc)"
            className="exc-present__exit"
            onClick={exit}
          >
            Exit
          </button>
        </div>
      </div>

      {notesOpen && (
        <div className="exc-present__notes">
          <h4>Speaker notes</h4>
          <div className="exc-present__notes-body">{notes || "—"}</div>
        </div>
      )}

      {helpOpen && (
        <div className="exc-present__help" onClick={() => setHelpOpen(false)}>
          <div className="exc-present__help-card">
            <h3>Presenter shortcuts</h3>
            <ul>
              <li>
                <kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd> next slide /
                reveal next step
              </li>
              <li>
                <kbd>←</kbd> <kbd>PgUp</kbd> previous slide / step
              </li>
              <li>
                <kbd>1</kbd>–<kbd>9</kbd> jump to slide
              </li>
              <li>
                <kbd>Home</kbd> <kbd>End</kbd> first / last slide
              </li>
              <li>
                <kbd>V</kbd> pointer · <kbd>L</kbd> laser · <kbd>D</kbd> draw ·{" "}
                <kbd>E</kbd> eraser
              </li>
              <li>
                <kbd>C</kbd> clear drawings on slide
              </li>
              <li>
                <kbd>R</kbd> replay slide animation
              </li>
              <li>
                <kbd>N</kbd> speaker notes
              </li>
              <li>
                <kbd>B</kbd> blackout · <kbd>W</kbd> whiteout
              </li>
              <li>
                <kbd>F</kbd> fullscreen · <kbd>Esc</kbd> exit
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
