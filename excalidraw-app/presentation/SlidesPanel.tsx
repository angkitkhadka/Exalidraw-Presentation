import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import clsx from "clsx";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  chevronDownIcon,
  collapseDownIcon,
  collapseUpIcon,
  DuplicateIcon,
  pencilIcon,
  playerPlayIcon,
  PlusIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useSetAtom } from "../app-jotai";

import {
  addSlide,
  DEFAULT_ANIMATE_DURATION,
  deleteSlides,
  duplicateSlide,
  getElementStep,
  getSlideAnimateDuration,
  getSlideMaxStep,
  getSlidePresentationData,
  getSlides,
  getSlidesSignature,
  moveSlide,
  renameSlide,
  setElementStep,
  slideAnimates,
  updateSlidePresentationData,
  updateSlidesPresentationData,
} from "./slides";
import { presentationAtom } from "./state";
import "./SlidesPanel.scss";

import type { Slide, SlideTransition } from "./slides";

const TRANSITIONS: {
  value: SlideTransition;
  label: string;
  group: string;
}[] = [
  { value: "glide", label: "Glide (camera)", group: "Camera" },
  { value: "cut", label: "Cut (instant)", group: "Camera" },
  { value: "flash", label: "Flash", group: "Camera" },
  { value: "fade", label: "Fade", group: "Subtle" },
  { value: "dissolve", label: "Dissolve", group: "Subtle" },
  { value: "zoom", label: "Zoom in", group: "Subtle" },
  { value: "zoom-out", label: "Zoom out", group: "Subtle" },
  { value: "push", label: "Push left", group: "Motion" },
  { value: "push-up", label: "Push up", group: "Motion" },
  { value: "cover", label: "Cover", group: "Motion" },
  { value: "uncover", label: "Uncover", group: "Motion" },
  { value: "rotate", label: "Rotate", group: "Motion" },
  { value: "wipe", label: "Wipe right", group: "Reveal" },
  { value: "wipe-up", label: "Wipe up", group: "Reveal" },
  { value: "split", label: "Split out", group: "Reveal" },
  { value: "split-vertical", label: "Split down", group: "Reveal" },
  { value: "flip", label: "Flip", group: "Dramatic" },
  { value: "pop", label: "Pop", group: "Dramatic" },
];

const TRANSITION_GROUPS = Array.from(
  new Set(TRANSITIONS.map((transition) => transition.group)),
);

const TRANSITION_LABELS = new Map(
  TRANSITIONS.map((transition) => [transition.value, transition.label]),
);

const DEFAULT_TRANSITION: SlideTransition = "glide";

const SPEEDS = [
  { label: "Slow", value: 800 },
  { label: "Normal", value: DEFAULT_ANIMATE_DURATION },
  { label: "Fast", value: 220 },
];

const SPEED_RANGE = { min: 120, max: 900, step: 20 };

const describeElement = (element: Slide["elements"][number]) => {
  if (element.type === "text") {
    return element.text.replace(/\s+/g, " ").trim() || "Text";
  }
  if (element.type === "image") {
    return "Image";
  }
  if (element.type === "freedraw") {
    return "Drawing";
  }
  if (element.type === "arrow") {
    return "Arrow";
  }
  if (element.type === "line") {
    return "Line";
  }
  if (element.type === "ellipse") {
    return "Ellipse";
  }
  if (element.type === "diamond") {
    return "Diamond";
  }
  return element.type[0].toUpperCase() + element.type.slice(1);
};

type SlideRowProps = {
  api: ExcalidrawImperativeAPI;
  slide: Slide;
  slides: Slide[];
  index: number;
  isActive: boolean;
  onFocus: (slide: Slide) => void;
};

const SlideRow = ({
  api,
  slide,
  slides,
  index,
  isActive,
  onFocus,
}: SlideRowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slide.title);

  const data = getSlidePresentationData(slide.frame);
  const steps = getSlideMaxStep(slide);

  const transitionLabel =
    TRANSITION_LABELS.get(data.transition ?? DEFAULT_TRANSITION) ?? "Glide";

  const commitTitle = () => {
    setEditing(false);
    if (draft !== slide.title) {
      renameSlide(api, slide.frame, draft);
    }
  };

  return (
    <div
      className={clsx("exc-slide", { "exc-slide--active": isActive })}
      onClick={() => onFocus(slide)}
    >
      <div className="exc-slide__index">{index + 1}</div>

      <div className="exc-slide__body">
        {editing ? (
          <input
            className="exc-slide__nameInput"
            value={draft}
            autoFocus
            aria-label="Slide title"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitTitle();
              }
              if (event.key === "Escape") {
                setDraft(slide.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div
            className="exc-slide__name"
            title="Double-click to rename"
            onDoubleClick={(event) => {
              event.stopPropagation();
              setDraft(slide.title);
              setEditing(true);
            }}
          >
            {slide.title}
          </div>
        )}
        <div className="exc-slide__meta">
          {transitionLabel}
          {steps > 1 ? ` · ${steps} steps` : ""}
          {slideAnimates(slide.frame) ? " · draw-in" : ""}
          {data.autoAdvance
            ? ` · auto ${Math.round(data.autoAdvance / 1000)}s`
            : ""}
        </div>
      </div>

      <div
        className="exc-slide__tools"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          title="Move earlier"
          aria-label="Move earlier"
          disabled={index === 0}
          onClick={() => moveSlide(api, slides, index, -1)}
        >
          {collapseUpIcon}
        </button>
        <button
          type="button"
          title="Move later"
          aria-label="Move later"
          disabled={index === slides.length - 1}
          onClick={() => moveSlide(api, slides, index, 1)}
        >
          {collapseDownIcon}
        </button>
        <button
          type="button"
          title="Rename slide"
          aria-label="Rename slide"
          onClick={() => {
            setDraft(slide.title);
            setEditing(true);
          }}
        >
          {pencilIcon}
        </button>
        <button
          type="button"
          title="Duplicate slide"
          aria-label="Duplicate slide"
          onClick={() => duplicateSlide(api, slide)}
        >
          {DuplicateIcon}
        </button>
        <button
          type="button"
          title="Delete slide"
          aria-label="Delete slide"
          onClick={() => deleteSlides(api, [slide])}
        >
          {TrashIcon}
        </button>
      </div>
    </div>
  );
};

export const SlidesPanel = () => {
  const api = useExcalidrawAPI();

  if (!api) {
    return null;
  }

  return <SlidesPanelInner api={api} />;
};

const SlidesPanelInner = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const uiAppState = useUIAppState();
  const setPresentation = useSetAtom(presentationAtom);

  const pendingRef = useRef<readonly ExcalidrawElement[] | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const signatureRef = useRef("");

  const [slides, setSlides] = useState<Slide[]>(() => {
    const elements = api.getSceneElementsIncludingDeleted();
    signatureRef.current = getSlidesSignature(elements);
    return getSlides(elements);
  });
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const commit = () => {
      rafRef.current = undefined;
      const elements = pendingRef.current;
      pendingRef.current = null;
      if (!elements) {
        return;
      }
      const signature = getSlidesSignature(elements);
      if (signature === signatureRef.current) {
        return;
      }
      signatureRef.current = signature;
      setSlides(getSlides(elements));
    };

    return api.onChange((nextElements) => {
      pendingRef.current = nextElements;
      if (rafRef.current === undefined) {
        rafRef.current = requestAnimationFrame(commit);
      }
    });
  }, [api]);

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const activeIndex = useMemo(() => {
    const selectedIds = Object.keys(uiAppState.selectedElementIds);

    const id =
      slides.find((slide) => selectedIds.includes(slide.frame.id))?.frame.id ??
      slides.find((slide) =>
        slide.elements.some((el) => selectedIds.includes(el.id)),
      )?.frame.id ??
      activeFrameId;

    return Math.max(
      0,
      slides.findIndex((slide) => slide.frame.id === id),
    );
  }, [slides, uiAppState.selectedElementIds, activeFrameId]);

  const activeSlide: Slide | undefined = slides[activeIndex];

  const notesFrameRef = useRef<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    const frame = activeSlide?.frame;
    if (!frame) {
      return;
    }
    if (notesFrameRef.current !== frame.id) {
      notesFrameRef.current = frame.id;
      setNotesDraft(getSlidePresentationData(frame).notes ?? "");
    }
  }, [activeSlide]);

  const notesTimer = useRef<number | undefined>(undefined);
  const commitNotes = useCallback(
    (value: string) => {
      if (!activeSlide) {
        return;
      }
      window.clearTimeout(notesTimer.current);
      notesTimer.current = window.setTimeout(() => {
        updateSlidePresentationData(api, activeSlide.frame, { notes: value });
      }, 600);
    },
    [activeSlide, api],
  );

  const toast = (message: string) => api.setToast({ message });

  const handlePresent = () => {
    if (!slides.length) {
      toast("Add a slide (frame) first");
      return;
    }
    setPresentation({ active: true, startIndex: activeIndex });
  };

  const focusSlide = useCallback(
    (slide: Slide) => {
      setActiveFrameId(slide.frame.id);
      api.selection.clear();
      api.updateScene({
        appState: { selectedElementIds: { [slide.frame.id]: true } },
      });
      api.setViewport({
        target: [
          slide.frame.x,
          slide.frame.y,
          slide.frame.x + slide.frame.width,
          slide.frame.y + slide.frame.height,
        ],
        fit: "scale-down",
        animation: { duration: 260 },
      });
    },
    [api],
  );

  const maxStep = activeSlide ? getSlideMaxStep(activeSlide) : 1;
  const activeData = activeSlide
    ? getSlidePresentationData(activeSlide.frame)
    : ({} as ReturnType<typeof getSlidePresentationData>);

  const activeSummary = activeSlide
    ? [
        TRANSITION_LABELS.get(activeData.transition ?? DEFAULT_TRANSITION),
        slideAnimates(activeSlide.frame) ? "draw-in" : "no draw-in",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const applyToAll = () => {
    if (!activeSlide) {
      return;
    }
    updateSlidesPresentationData(api, slides, {
      transition: activeData.transition ?? DEFAULT_TRANSITION,
      animate: activeSlide ? slideAnimates(activeSlide.frame) : undefined,
      animateDuration: getSlideAnimateDuration(activeSlide.frame),
    });
    toast(`Applied to ${slides.length} slides`);
  };

  return (
    <div className="exc-slides">
      <div className="exc-slides__head">
        <div className="exc-slides__header">
          <h3 className="exc-slides__title">Presentation</h3>
          <p className="exc-slides__subtitle">
            {slides.length
              ? `${slides.length} slide${slides.length > 1 ? "s" : ""}`
              : "Frames are slides"}
          </p>
        </div>

        <div className="exc-slides__actions">
          <button
            type="button"
            className="exc-slides__btn exc-slides__btn--primary"
            onClick={handlePresent}
            title="Start presenting (F5)"
          >
            {playerPlayIcon}
            Present
          </button>
          <button
            type="button"
            className="exc-slides__btn"
            onClick={() => addSlide(api)}
            title="Add an empty slide"
          >
            {PlusIcon}
            Add slide
          </button>
        </div>
      </div>

      {activeSlide && (
        <div
          className={clsx("exc-slides__settings", {
            "exc-slides__settings--open": settingsOpen,
          })}
        >
          <button
            type="button"
            className="exc-slides__settingsToggle"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            title={`Transition, animation and notes for slide ${
              activeIndex + 1
            }`}
          >
            <span>Slide {activeIndex + 1} settings</span>
            <span className="exc-slides__settingsSummary">{activeSummary}</span>
            <span className="exc-slides__settingsChevron">
              {chevronDownIcon}
            </span>
          </button>

          {settingsOpen && (
            <div className="exc-slides__settingsBody">
              <label className="exc-slides__field exc-slides__field--wide">
                <span>Transition</span>
                <select
                  value={activeData.transition ?? DEFAULT_TRANSITION}
                  onChange={(event) =>
                    updateSlidePresentationData(api, activeSlide.frame, {
                      transition: event.target.value as SlideTransition,
                    })
                  }
                >
                  {TRANSITION_GROUPS.map((group) => (
                    <optgroup key={group} label={group}>
                      {TRANSITIONS.filter(
                        (transition) => transition.group === group,
                      ).map((transition) => (
                        <option key={transition.value} value={transition.value}>
                          {transition.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="exc-slides__field">
                <span>Auto-advance (s)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Math.round((activeData.autoAdvance ?? 0) / 1000)}
                  onChange={(event) =>
                    updateSlidePresentationData(api, activeSlide.frame, {
                      autoAdvance:
                        Math.max(0, Number(event.target.value) || 0) * 1000,
                    })
                  }
                />
              </label>

              <label className="exc-slides__field">
                <span>Draw-in animation</span>
                <input
                  type="checkbox"
                  checked={slideAnimates(activeSlide.frame)}
                  onChange={(event) =>
                    updateSlidePresentationData(api, activeSlide.frame, {
                      animate: event.target.checked,
                    })
                  }
                />
              </label>

              <div className="exc-slides__field exc-slides__field--wide">
                <span>
                  Draw-in speed{" "}
                  <em className="exc-slides__speedValue">
                    {getSlideAnimateDuration(activeSlide.frame)} ms
                  </em>
                </span>
                <input
                  type="range"
                  min={SPEED_RANGE.min}
                  max={SPEED_RANGE.max}
                  step={SPEED_RANGE.step}
                  disabled={!slideAnimates(activeSlide.frame)}
                  value={getSlideAnimateDuration(activeSlide.frame)}
                  onChange={(event) =>
                    updateSlidePresentationData(api, activeSlide.frame, {
                      animateDuration: Number(event.target.value),
                    })
                  }
                />
                <div className="exc-slides__speeds">
                  {SPEEDS.map((speed) => (
                    <button
                      key={speed.label}
                      type="button"
                      className={clsx("exc-slides__speed", {
                        "exc-slides__speed--active":
                          getSlideAnimateDuration(activeSlide.frame) ===
                          speed.value,
                      })}
                      disabled={!slideAnimates(activeSlide.frame)}
                      onClick={() =>
                        updateSlidePresentationData(api, activeSlide.frame, {
                          animateDuration: speed.value,
                        })
                      }
                    >
                      {speed.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="exc-slides__field exc-slides__field--wide">
                <span>Speaker notes</span>
                <textarea
                  rows={2}
                  placeholder="Only visible to you while presenting (press N)"
                  value={notesDraft}
                  onChange={(event) => {
                    setNotesDraft(event.target.value);
                    commitNotes(event.target.value);
                  }}
                  onBlur={() =>
                    updateSlidePresentationData(api, activeSlide.frame, {
                      notes: notesDraft,
                    })
                  }
                />
              </div>

              <div className="exc-slides__field exc-slides__field--wide">
                <span>Reveal steps</span>
                <p className="exc-slides__hint">
                  Pick the step each element appears on. Step 1 is visible from
                  the start, step 2 after the first advance.
                </p>
                <div className="exc-slides__elements">
                  {activeSlide.elements.length === 0 && (
                    <p className="exc-slides__hint">This slide is empty.</p>
                  )}
                  {activeSlide.elements.map((element) => {
                    const step = getElementStep(element);
                    return (
                      <div
                        key={element.id}
                        className="exc-slides__element"
                        title={describeElement(element)}
                      >
                        <span className="exc-slides__elementName">
                          {describeElement(element)}
                        </span>
                        <span className="exc-slides__elementSteps">
                          {Array.from(
                            { length: maxStep + 1 },
                            (_, i) => i + 1,
                          ).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={clsx("exc-slides__step", {
                                "exc-slides__step--current": step === value,
                                "exc-slides__step--new": value === maxStep + 1,
                              })}
                              title={`Show on step ${value}`}
                              onClick={() =>
                                setElementStep(
                                  api,
                                  element.id,
                                  value === step ? null : value,
                                )
                              }
                            >
                              {value}
                            </button>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="exc-slides__btn exc-slides__btn--wide"
                onClick={applyToAll}
                title="Copy this slide's transition and animation to every slide"
              >
                Apply to all slides
              </button>
            </div>
          )}
        </div>
      )}

      <div className="exc-slides__list">
        {slides.map((slide, index) => (
          <SlideRow
            key={slide.frame.id}
            api={api}
            slide={slide}
            slides={slides}
            index={index}
            isActive={index === activeIndex}
            onFocus={focusSlide}
          />
        ))}
      </div>

      <div className="exc-slides__footer">
        <p className="exc-slides__tip">
          <kbd>F5</kbd> present, <kbd>Space</kbd> or arrow keys navigate,{" "}
          <kbd>L</kbd> laser, <kbd>D</kbd> draw, <kbd>Esc</kbd> exit.
        </p>
      </div>
    </div>
  );
};
