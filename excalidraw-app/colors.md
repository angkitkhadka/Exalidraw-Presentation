# Colours

Every deck in this project uses one colour scheme, so the slides, the presenter and the panels all look like they belong together.

| Colour | Hex | Used for |
| --- | --- | --- |
| Flexera Ultra Dark Blue | `#142636` | The title, divider and closing slide backgrounds |
| White | `#ffffff` | The content slide backgrounds, and the text on the dark slides |
| Logo Blue | `#00549f` | The slide titles |
| Flexera Blue | `#00a1de` | Highlights, icons and key takeaways |
| Near-black | `#121619` | The body text |
| Light Gray | `#f8f9fb` | The card and code box fills |
| Border Gray | `#c1c7cd` | The borders and dividers |
| Orange 40 | `#ffab87` | The second accent, for diagrams |
| Teal 30 | `#6ec0c0` | The third accent, for diagrams |
| Red 50 | `#d85a77` | Risks and errors only |

The demo deck lives in `excalidraw-app/presentation/demoDeck.ts` and uses these colours directly. The sidebar panels set the same values as CSS variables, so the editor chrome matches the slides:

```scss
.exc-slides {
  --color-primary: #00549f; /* the logo blue */
  --exc-accent: #00a1de; /* the bright blue */
  --exc-border: #c1c7cd;
  --exc-surface: #f8f9fb;
}
```
