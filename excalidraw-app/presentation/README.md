# Presentation mode (slides)

A local-first clone of the Excalidraw+ presentation feature. Everything is
derived from the scene — there is no server, no upload, and no live sharing.

## Concepts

- **A slide is a frame.** Any frame on the canvas becomes a slide.
- **Deck order is canvas order.** Frames are read top-to-bottom in rows, then
  left-to-right within a row.
- **Builds are element reveal steps.** Elements can be assigned a step
  (`customData.presentationStep`) and appear one step at a time.
- **Annotations are normal scene elements**, so drawing during a presentation
  works with the regular Excalidraw tools (and is undoable).

## Making a deck

1. Press **Add slide** in the panel (or draw a frame on the canvas).
2. Open **Main menu → Presentation** (or the command palette: *Start
   presentation*, *Add slide*).
3. Add, rename, reorder, duplicate, and delete slides from the panel. Double
   click a title — or use the pencil button — to rename it.
4. Open **Slide N settings** at the top of the panel to configure the
   **transition**, **draw-in animation** and its **speed**, **auto-advance**,
   **speaker notes**, and the **reveal steps** of every element on the slide.
   *Apply to all slides* copies the current transition/animation to the deck.
5. Press **Present** (or <kbd>F5</kbd>).

## Generating a deck from JSON (AI-friendly)

Hand-writing Excalidraw element JSON is painful, so `deck.ts` compiles a
small **deck spec**: plain text + a layout name. The compiler turns it into
real frames and elements (text is measured with the actual fonts) and can
append the deck below whatever is already on the canvas.

The intended workflow is to ask an assistant for a deck in this format and
compile it with `buildDeck()` / `importDeck()` — see
`examples/aws-ec2.deck.json` for a complete 25-slide example.

```jsonc
{
  "title": "How AWS EC2 Works",
  "slides": [
    {
      "layout": "title",
      "eyebrow": "AWS · COMPUTE",
      "title": "How AWS EC2 Works",
      "subtitle": "From a click to a running VM",
      "badge": "Start presenting",
      "accent": "#4c6ef5",
      "transition": "fade"
    },
    {
      "layout": "bullets",
      "eyebrow": "THE BASICS",
      "title": "What is EC2?",
      "bullets": ["Virtual servers by the second", "Pick an image and a size"],
      "reveal": true,
      "notes": "Keep this short."
    },
    {
      "layout": "flow",
      "title": "Lifecycle",
      "steps": ["Launch", "Pending", "Running", "Stopped", "Terminated"]
    }
  ]
}
```

| Field | Applies to | Notes |
| --- | --- | --- |
| `layout` | every slide | `title`, `section`, `bullets`, `split`, `stat`, `quote`, `flow`, `end` (default `bullets`) |
| `eyebrow` | all | small label above the title; the big number on `section` |
| `title`, `subtitle` | all | the frame is named after `title` |
| `bullets` | `bullets`, `split` | 1–6 items; on `split` they sit left of the card |
| `panel` | `split` | `{ "title": "...", "bullets": ["..."] }` right-hand card |
| `stats` | `stat` | up to 3 `{ "value": "99.99%", "label": "..." }` |
| `steps` | `flow` | up to 5 boxes connected by arrows |
| `quote`, `cite` | `quote` | big pull quote |
| `badge` | `title`, `end` | call-to-action pill text |
| `accent` | all | any `#rrggbb`; tints are derived automatically |
| `transition` | all | one of the transitions above |
| `animate` | all | `false` disables the draw-in for that slide |
| `animateDuration` | all | ms per object |
| `reveal` | all | reveal bullets / flow steps one at a time |
| `notes` | all | speaker notes |

Slides are laid out in a two-column grid (the deck order is reading order:
rows top-to-bottom, then left-to-right). Long titles and bullets are wrapped
automatically. Keep slides to one idea each — the templates have room for about
5 bullets or 3 cards.

## Presenting

Press **F5** (or **Present** in the panel) to start from the slide currently in
view. The editor chrome is hidden, the slide is fitted to the screen, and
fullscreen is requested. Leaving fullscreen leaves presentation mode.

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

`Glide` animates the camera between slides; every other transition uses the
browser's [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
to animate the outgoing and incoming slides together (with a graceful cut
fallback on browsers without support, and an instant cut under
`prefers-reduced-motion`). Auto-advance is configured per slide in the panel.

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

The presenter HUD (top bar, toolbar, notes, help) is captured separately from
the slide, so it stays put while the slide animates.

### Draw-in animation

Every slide is *sketched* as it appears: shapes draw themselves stroke-first,
their fills fade in after the outline, text is typed out, and freehand strokes
are re-traced point by point. This is a port of the SMIL technique used by
[dai-shi/excalidraw-animate](https://github.com/dai-shi/excalidraw-animate).

The canvas renderer has no notion of per-element drawing progress, so for the
duration of the effect the presenter overlays an animated SVG snapshot of the
slide that is pixel-aligned with the frame as rendered on screen, then fades it
out to reveal the (identical) live canvas underneath — so you can keep drawing
immediately after.

The animation is **on by default** for every slide. Turn it off per slide (or
tune the per-object speed) in the panel; the whole sequence is capped at ~2.4 s
so busy slides stay brisk, and it is skipped entirely under
`prefers-reduced-motion`. Element reveal steps are respected: only the elements
visible on entry are drawn. Press **R** to replay.

Undo/redo and the usual tool shortcuts keep working while presenting. Ink
drawn on a slide can be cleared with **Clear ink** just before leaving the
slide (it only removes elements created after the presentation started).

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
| `deck.ts` | Deck-spec → frames/elements compiler (used by tools/assistants) |
| `slides.test.ts` | Unit tests for ordering, grouping, steps, settings, reordering |
| `animate.test.ts` | Unit tests for the animation injection and element ordering |
| `deck.test.ts` | Unit tests for the deck spec parser, layouts, and demo deck |

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
      "autoAdvance": 0,       // ms, 0/undefined = off
      "animate": true,        // draw-in animation (default: on)
      "animateDuration": 450  // ms per object (optional; auto-tuned if unset)
    }
  }
}
```

Element reveal steps use `customData.presentationStep` (default `1`). Hidden
elements are hidden with `api.setElementRenderOverrides({ opacity: 0 })`, so the
scene is never mutated while presenting and leaving presentation restores it.
