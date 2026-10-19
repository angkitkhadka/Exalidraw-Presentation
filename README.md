<div align="center">
  <h2>
    A hand-drawn whiteboard with a presentation mode. </br>
    Slides are frames, animations are hand-drawn. </br>
    Everything stays in your browser. </br>
  </h2>
</div>

<br />
<p align="center">
  <a href="https://github.com/angkitkhadka/Exalidraw-Presentation/blob/master/LICENSE">
    <img alt="Released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg"  /></a>
  <a href="https://github.com/angkitkhadka/Exalidraw-Presentation/actions">
    <img alt="Deploy to GitHub Pages" src="https://github.com/angkitkhadka/Exalidraw-Presentation/actions/workflows/deploy-pages.yml/badge.svg" /></a>
</p>

<div align="center">
  <figure>
    <a href="https://angkitkhadka.github.io/Exalidraw-Presentation/" target="_blank" rel="noopener">
      <img src="https://raw.githubusercontent.com/excalidraw/excalidraw/master/public/og-image-3.png" alt="Excalidraw" />
    </a>
    <figcaption>
      <p align="center">
        Open the app in your browser. Nothing is uploaded, nothing is shared.
      </p>
    </figcaption>
  </figure>
</div>

## Features

- Infinite, canvas-based whiteboard with a hand-drawn look.
- Dark mode and a light theme.
- A presentation mode built into the sidebar: frames become slides.
- Hand-drawn draw-in animation for every slide, in the spirit of [excalidraw-animate](https://github.com/dai-shi/excalidraw-animate).
- Eighteen slide transitions, reveal steps, speaker notes and auto-advance.
- Draw on a slide while presenting, with a laser pointer and an eraser.
- Multiple canvases, stored in the browser, with no account and no server.
- Image support, shape libraries, localization and export to PNG, SVG and clipboard.
- Open format: drawings are stored as an `.excalidraw` json file.

## Presentation mode

Open the **Presentation** tab in the sidebar, or press <kbd>F5</kbd>.

A slide is a frame. Draw a frame on the canvas and it becomes a slide, in reading order, so a deck laid out in a grid reads the way you would expect. The panel lets you add, rename, reorder, duplicate and delete slides, and configure the active one:

- the transition used when entering the slide,
- the draw-in animation and how fast it draws,
- how long the slide stays on screen before advancing,
- the reveal step of every element on the slide, so you can build a slide up piece by piece,
- speaker notes, visible only to the presenter.

Every slide can be replayed on demand, and the whole deck can be applied to all slides at once when you want a consistent look.

See [`excalidraw-app/presentation/README.md`](excalidraw-app/presentation/README.md) for the full documentation, including the deck spec that lets an assistant generate a deck for you.

## Canvases

The **Canvases** tab keeps as many drawings as you like in the browser. Save the current canvas under a name, open a saved one, start a new one, rename or delete them. Everything is stored locally, in IndexedDB, and survives a reload. Clearing your browser data removes it, so nothing is ever uploaded anywhere.

See [`excalidraw-app/canvases.md`](excalidraw-app/canvases.md) for the details.

## Local development

```bash
yarn install
yarn start
```

The app is served on <http://localhost:3000>.

Useful commands:

| Command                 | What it does                               |
| ----------------------- | ------------------------------------------ |
| `yarn start`            | Starts the dev server                      |
| `yarn build:app`        | Builds the app into `excalidraw-app/build` |
| `yarn build:app:static` | Builds without analytics, for self-hosting |
| `yarn test:typecheck`   | Type checks the whole repo                 |
| `yarn test:code`        | Lints the whole repo                       |
| `yarn test:app`         | Runs the unit tests                        |
| `yarn fix`              | Formats and lints with autofix             |

## Deploying to GitHub Pages

The repository ships with a workflow that builds the app and publishes it to GitHub Pages on every push to `master`. The app is served from <https://angkitkhadka.github.io/Exalidraw-Presentation/>.

Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. See [`excalidraw-app/DEPLOY.md`](excalidraw-app/DEPLOY.md) for the details and for building the site yourself.

## Credits

This is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw), the open source hand-drawn whiteboard, and follows the same MIT license. The presentation mode is a local, server-free reimplementation of the feature Excalidraw+ ships.

## License

[MIT](LICENSE)
