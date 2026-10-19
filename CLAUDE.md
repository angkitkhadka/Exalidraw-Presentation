# CLAUDE.md

## Project Structure

A monorepo with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library, published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - The web application, the only consumer of the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`, `@excalidraw/laser-pointer`, `@excalidraw/fractional-indexing`
- **`excalidraw-app/presentation/`** - The presentation feature: slide model, draw-in animation, presenter overlay and the deck manager panel
- **`excalidraw-app/data/canvasStorage.ts`** - Browser storage for canvases

The application is local-first. There is no server, no account and no collaboration: the canvas, the saved canvases and the deck all live in the browser.

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
yarn build:app:static # Build the app for self-hosting (no analytics)
```

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

### The app is served from a sub-path on GitHub Pages

`VITE_APP_BASE_PATH` is prefixed to every asset url at build time. The `deploy-pages` workflow sets it to the repository name, and the vite config falls back to `GITHUB_REPOSITORY` when it is not set.
