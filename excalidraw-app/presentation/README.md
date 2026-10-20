# Presentation mode (slides)

A local-first clone of the Excalidraw+ presentation feature. Everything is derived from the scene — there is no server, no upload, and no live sharing.

## Concepts

- **A slide is a frame.** Any frame on the canvas becomes a slide.
- **Deck order is canvas order.** Frames are read top-to-bottom in rows, then left-to-right within a row.
- **Builds are element reveal steps.** Elements can be assigned a step (`customData.presentationStep`) and appear one step at a time.
- **Annotations are normal scene elements**, so drawing during a presentation works with the regular Excalidraw tools (and is undoable).

## The built-in demo

The app ships with a demo deck of twenty-six slides, on how a page load works from the first lookup to the paint. Open the **Canvases** tab and press **Open and present the demo**.

The demo is never stored. It is rebuilt from its source every time, so it can neither be deleted nor lost. It has a transition on every slide, a hand-drawn draw-in animation, reveal steps on a few slides, and speaker notes throughout.

The source is `demoContent.ts` (the words) and `demoDeck.ts` (the layouts), and the layouts are shared with nothing else, so the deck can be edited freely.

### House style

`DECK-RULES.md` holds the rules a deck in this project follows, so that a deck does not read as machine written. They cover the argument, the layout and the wording. `deckRules.ts` checks the mechanical half of them, and `deckRules.test.ts` runs that check over the demo, so a deck that breaks a rule fails the test.

| File | Purpose |
| --- | --- |
| `DECK-RULES.md` | The rules a deck here follows, and how the demo meets them |
| `deckRules.ts` | The checks for the rules that can be checked mechanically |
| `deckRules.test.ts` | Runs the checks over the demo, and over deliberately broken decks |

## Making a deck

1. Press **Add slide** in the panel (or draw a frame on the canvas).
2. Open **Main menu → Presentation** (or the command palette: _Start presentation_, _Add slide_).
3. Add, rename, reorder, duplicate, and delete slides from the panel. Double click a title — or use the pencil button — to rename it.
4. Open **Slide N settings** at the top of the panel to configure the **transition**, **draw-in animation** and its **speed**, **auto-advance**, **speaker notes**, and the **reveal steps** of every element on the slide. _Apply to all slides_ copies the current transition/animation to the deck.
5. Press **Present** (or <kbd>F5</kbd>).

## Presenting

Press **F5** (or **Present** in the panel) to start from the slide currently in view. The editor chrome is hidden, the slide is fitted to the screen, and fullscreen is requested. Leaving fullscreen leaves presentation mode.

| Key | Action |
| --- | --- |
| `→` `↓` `Space` `Enter` `PageDown` | Next step / slide |
| `←` `↑` `PageUp` | Previous step / slide |
| `Home` / `End` | First / last slide |
| `1`–`9` | Jump to slide |
| `V` | Pointer / select |
| `L` | Laser pointer |
| `D` / `P` | Draw (freedraw, locked) |
| `E` | Eraser |
| `C` | Clear ink drawn on this slide during the presentation |
| `R` | Replay the slide's draw-in animation |
| `N` | Speaker notes |
| `B` / `W` | Black / white screen |
| `F` | Toggle fullscreen |
| `?` / `H` | Shortcut help |
| `Esc` | Close help → notes → blackout → tool → exit |

`Glide` animates the camera between slides; every other transition uses the browser's [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) to animate the outgoing and incoming slides together (with a graceful cut fallback on browsers without support, and an instant cut under `prefers-reduced-motion`). Auto-advance is configured per slide in the panel.

| Transition | Effect |
| --- | --- |
| Glide (camera) | Pans/zooms the camera from the previous slide (default) |
| Cut | Instant, no animation |
| Flash | Instant cut behind a white flash |
| Fade | Cross-fade between slides |
| Dissolve | Cross-fade with blur |
| Zoom in / Zoom out | Scale up into / down out of the slide |
| Push left / Push up | New slide pushes the old one off-screen |
| Cover / Uncover | New slide slides over / old slide slides away |
| Wipe right / Wipe up | New slide is revealed by a directional wipe |
| Split out / Split down | New slide opens from the center |
| Flip | 3D card flip |
| Rotate | Rotate + scale |
| Pop | Small overshoot scale |

The presenter HUD (top bar, toolbar, notes, help) is captured separately from the slide, so it stays put while the slide animates.

### Draw-in animation

Every slide is _sketched_ as it appears: shapes draw themselves stroke-first, their fills fade in after the outline, text is typed out, and freehand strokes are re-traced point by point. This is a port of the SMIL technique used by [dai-shi/excalidraw-animate](https://github.com/dai-shi/excalidraw-animate).

The canvas renderer has no notion of per-element drawing progress, so for the duration of the effect the presenter overlays an animated SVG snapshot of the slide that is pixel-aligned with the frame as rendered on screen, then fades it out to reveal the (identical) live canvas underneath — so you can keep drawing immediately after.

The animation is **on by default** for every slide. Turn it off per slide (or tune the per-object speed) in the panel; the whole sequence is capped at ~2.4 s so busy slides stay brisk, and it is skipped entirely under `prefers-reduced-motion`. Element reveal steps are respected: only the elements visible on entry are drawn. Press **R** to replay.

Undo/redo and the usual tool shortcuts keep working while presenting. Ink drawn on a slide can be cleared with **Clear ink** just before leaving the slide (it only removes elements created after the presentation started).

## Implementation

| File | Purpose |
| --- | --- |
| `slides.ts` | Slide model, reading order, mutations, reveal steps, viewport helpers |
| `state.ts` | `presentationAtom` (`{ active, startIndex }`) |
| `SlidesPanel.tsx` | Sidebar deck manager (list, per-slide settings) |
| `Presentation.tsx` | Presenter overlay (HUD, tools, keyboard, fullscreen, transitions) |
| `animate.ts` | Draw-in animation: SVG export → injected SMIL (port of excalidraw-animate) |
| `SlideDrawIn.tsx` | Aligned animated SVG overlay used by the presenter |
| `slideSvg.ts` | Cropped, cached slide SVGs + content hash + neighbour prefetch |
| `demoContent.ts` | The twenty-six slides of the built-in demo deck |
| `demoDeck.ts` | The layouts the demo is drawn with, and the `.excalidraw` export |
| `slides.test.ts` | Unit tests for ordering, grouping, steps, settings, reordering |
| `animate.test.ts` | Unit tests for the animation injection and element ordering |

Per-slide metadata lives on the frame:

```jsonc
{
  "customData": {
    "presentation": {
      "notes": "Say hi",
      "transition": "glide", // "glide" | "cut" | "flash" | "fade" | "dissolve"
      // | "push" | "push-up" | "cover" | "uncover"
      // | "wipe" | "wipe-up" | "split" | "split-vertical"
      // | "zoom" | "zoom-out" | "flip" | "rotate" | "pop"
      "autoAdvance": 0, // ms, 0/undefined = off
      "animate": true, // draw-in animation (default: on)
      "animateDuration": 450 // ms per object (optional; auto-tuned if unset)
    }
  }
}
```

Element reveal steps use `customData.presentationStep` (default `1`). Hidden elements are hidden with `api.setElementRenderOverrides({ opacity: 0 })`, so the scene is never mutated while presenting and leaving presentation restores it.
