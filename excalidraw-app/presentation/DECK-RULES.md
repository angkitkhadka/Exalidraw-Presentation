# Deck rules

These are the rules every deck in this project follows. They exist because the house style of a slide deck is easy to get wrong in a way that is hard to see: a deck can be accurate, well designed and still read as machine made.

The rules are enforced by `deckRules.ts`, which checks a deck for the mechanical ones, and by `demoDeck.test.ts`, which runs the built-in demo through it. A deck that breaks a rule fails the test.

## Content

- Write every slide title as a conclusion (an action title).
- Build the deck from a storyline decided first: one governing message, three to five supporting points, one point per slide.
- Use only facts and numbers from the material provided; never invent statistics, targets, causes or explanations.
- Put a source line on data slides.
- If data is missing, say so rather than filling a tile with a plausible number.
- Tailor the opening and the closing ask to the stated audience.
- Close with a specific next step, not "Thank you" or "Questions?".
- Write speaker notes that add context, anecdote and likely questions rather than repeating the slide.
- Keep the slide count as low as the argument allows.

## Design

- Use the user's template, fonts and palette when given. Otherwise choose a palette and type system from the subject, written down before building, and do not default to cream/terracotta, purple gradients, teal cards, or near-black with one neon accent.
- One consistent type treatment; no italic serif flourishes.
- No accent bars or all-caps eyebrow labels.
- Separate sections with whitespace.
- No icon-in-circle decoration, no rounded-card grids, no dashboard stat tiles.
- Vary slide forms (chart, single big number, two-column comparison, quote, image, diagram, plain sentence); never repeat the same three-box or four-bullet layout on consecutive slides.
- Vary bullet count and length, and use no bullets on some slides.
- Use native editable charts with honest axes and the right chart type for the message.
- Use real photos, screenshots or diagrams that carry information; no glossy 3D or generic stock imagery.
- Apply footers and slide numbers consistently via the master.
- Use one case convention for titles.

## Language

- No generic openers ("in today's fast-paced world"), no business clichés (leverage synergies, move the needle, paradigm shift), no AI vocabulary (delve, tapestry, landscape, pivotal, crucial, underscore, testament, foster, showcase, unlock, harness, navigate, journey, realm).
- Avoid "it's not X, it's Y" constructions, em-dash chains, forced groups of three, promotional tone, emoji bullets, bold-label bullets and Title Case headings.
- Vary sentence length.
- Make claims with evidence and a point of view.

## How this project meets them

**Palette and type system.** The project already had one colour scheme, set in `excalidraw-app/colors.md`, and one typeface for the slides. Both stay. The palette is a deep blue with a white ground, a logo blue for titles, a bright blue for emphasis, orange and teal for diagrams and red for errors only. The type is Nunito for everything, with Cascadia reserved for code, because a protocol transcript is a different kind of text. There is no second accent colour on a slide, and no colour is used to decorate.

**No accent bars, no all-caps eyebrows.** The old header drew a short rule under the title and set an eyebrow label in capitals. Both are gone. A slide title sits alone at the top, and the space below it does the separating.

**No rounded-card grids, no stat tiles.** The old layouts filled the slide with rounded boxes: a card per actor, a card per column, a card per statistic, numbered circles as bullets. Those are removed. Content is set as text on the page, and where a visual structure helps it is drawn as a hairline rule or a square block.

**Varied slide forms.** The demo uses a different form for each idea: a plain sentence, a diagram of the request chain, a two-column comparison, a single large number, a chart, a table, a code listing, a list of steps, and slides with and without bullets. The checker fails the deck if two slides in a row use the same form.

**Native charts.** Both charts are drawn from rectangles and lines, so they stay editable in Excalidraw. The axis starts at zero, the gridlines are labelled, and the values are the ones the sources give. The one chart with illustrative numbers says so in its source line.

**Sources.** Every slide that carries a number has a source line under it, naming the document and section it came from.

**Titles as conclusions.** Titles state what the slide establishes, in sentence case: "A cold lookup costs three round trips before the answer arrives" rather than "Name resolution".

**A real next step.** The closing slide asks the reader to open the network panel and count the round trips, which is the same thing the deck taught, and links the specifications it used.

## The checker

`deckRules.ts` holds the mechanical rules as data and functions:

- `BANNED_VOCABULARY`, `BANNED_PHRASES` and `BANNED_OPENERS` for the language rules.
- `checkDeck(slides)` returns a list of problems, each naming the slide and the rule it breaks.
- `isActionTitle(text)` and `isTitleCase(text)` are the heuristics for the title rules.

The checks that need judgement (does the deck have one governing message, does the ending name a next step) are done by writing the deck, not by code. The checker catches the things that are easy to miss on a long deck: a banned word in slide forty, a Title Case heading, two slides in a row using the same form, a number with no source.

`deckRules.test.ts` runs the checker over the built-in demo and asserts that it finds nothing, so a deck that breaks a rule fails the build.
