# Colours

Every deck in this project uses one colour scheme, so the slides, the presenter and the panels all look like they belong together.

| Colour | Hex | Used for |
| --- | --- | --- |
| Flexera Ultra Dark Blue | `#142636` | The cover, divider and closing slide backgrounds |
| White | `#ffffff` | The content slide backgrounds, and the text on the dark slides |
| Logo Blue | `#00549f` | The slide titles, and the bars in a chart |
| Flexera Blue | `#00a1de` | One accent per slide: a bullet marker, a chart bar, a diagram marker |
| Near-black | `#121619` | The body text |
| Light Gray | `#f8f9fb` | The code block fill |
| Border Gray | `#c1c7cd` | The rules, the table and chart gridlines |
| Orange 40 | `#ffab87` | The second diagram accent |
| Teal 30 | `#6ec0c0` | The third diagram accent |
| Red 50 | `#d85a77` | Risks and errors only |

A slide uses one accent, not several, and never a second one for decoration.

## Type

| Family | Used for |
| --- | --- |
| Nunito | Every label, title and heading on a slide |
| Cascadia | Code blocks and protocol transcripts, where the alignment is the point |

One family carries the prose, so a slide has a single type treatment. The monospace face is reserved for text that is monospace by nature, and no slide sets a title in anything but the text family.

## The demo deck

The demo deck lives in `excalidraw-app/presentation/demoDeck.ts` and uses these colours directly. The sidebar panels set the same values as CSS variables, so the editor chrome matches the slides:

```scss
.exc-slides {
  --color-primary: #00549f; /* the logo blue */
  --exc-accent: #00a1de; /* the bright blue */
  --exc-border: #c1c7cd;
  --exc-surface: #f8f9fb;
}
```
