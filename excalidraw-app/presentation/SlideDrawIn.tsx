import { useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { animateSvg } from "./animate";
import { getSlideBackground, getSlideSvg } from "./slideSvg";

import type { Slide } from "./slides";

type SlideDrawInProps = {
  api: ExcalidrawImperativeAPI;
  slide: Slide;
  /** reveal step the slide is entered on (later steps are not drawn) */
  step: number;
  /** per-element duration, in ms */
  duration: number;
  /** bump to replay the animation */
  nonce: number;
  /** called when the draw animation finishes (before the fade-out), so the
   *  presenter can restore canvas visibility while the overlay is still opaque */
  onFinish?: () => void;
  /** called once the overlay has fully faded (or could not be shown) */
  onDone?: () => void;
};

/**
 * Renders the incoming slide as an animated SVG snapshot on top of the canvas
 * and plays a hand-drawn "sketch" animation (see `./animate`). The snapshot is
 * pixel-aligned with the frame as rendered on screen and covers the live
 * canvas, so when the animation ends the overlay is faded out to reveal the
 * (identical) canvas underneath.
 */ export const SlideDrawIn = ({
  api,
  slide,
  step,
  duration,
  nonce,
  onFinish,
  onDone,
}: SlideDrawInProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let eraseTimer: number | undefined;
    let fadeTimer: number | undefined;

    const { frame } = slide;
    const appState = api.getAppState();
    const { scrollX, scrollY, zoom, theme } = appState;
    const scale = zoom.value;

    // align the snapshot with the frame exactly as the canvas renders it
    host.style.left = `${(frame.x + scrollX) * scale}px`;
    host.style.top = `${(frame.y + scrollY) * scale}px`;
    host.style.width = `${frame.width * scale}px`;
    host.style.height = `${frame.height * scale}px`;
    host.style.background = getSlideBackground(
      appState.viewBackgroundColor,
      theme,
    );

    getSlideSvg(api, slide, step, theme)
      .then(({ svg: pristine, ordered }) => {
        if (cancelled) {
          return;
        }
        if (!ordered.length) {
          // nothing to draw — reveal the live canvas immediately
          onFinishRef.current?.();
          onDoneRef.current?.();
          return;
        }

        // the cached snapshot must stay pristine for replays, so animate a copy
        const svg = pristine.cloneNode(true) as SVGSVGElement;
        const { finishedMs } = animateSvg(svg, ordered, {
          elementDuration: duration,
          idPrefix: `exc-typo-${frame.id}`,
        });

        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        host.style.opacity = "1";
        host.appendChild(svg);

        // SMIL animations start at the document timeline; rewind so the
        // animation plays from the beginning regardless of page age
        try {
          svg.setCurrentTime(0);
          svg.unpauseAnimations();
        } catch {
          // no SMIL support — the snapshot is simply shown finished
        }

        eraseTimer = window.setTimeout(() => {
          // restore the canvas while the overlay is still opaque, so the
          // fade reveals identical pixels instead of a blank frame
          onFinishRef.current?.();

          host.style.transition = "opacity 0.18s ease";
          host.style.opacity = "0";
          fadeTimer = window.setTimeout(() => {
            if (!cancelled) {
              host.replaceChildren();
              onDoneRef.current?.();
            }
          }, 200);
        }, finishedMs);
      })
      .catch(() => {
        if (!cancelled) {
          host.replaceChildren();
          onFinishRef.current?.();
          onDoneRef.current?.();
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(eraseTimer);
      window.clearTimeout(fadeTimer);
      host.replaceChildren();
      // no restore on unmount: effects double-run in dev (StrictMode) and it
      // would end the draw-in early. The presenter restores visibility on
      // navigation (`goto`) and on exit.
    };
    // `step` is intentionally not a dependency: advancing a reveal step must
    // not replay the draw-in (only `nonce` / the slide restarts it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, slide, duration, nonce]);

  return <div ref={hostRef} className="exc-present__drawin" />;
};
