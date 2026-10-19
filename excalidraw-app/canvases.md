# Canvases (browser storage)

The app is fully local: there is no server, no account, and no sharing. This
feature lets you keep as many separate canvases as you like, stored in the
browser (IndexedDB) on the device.

## Using it

Open the **Canvases** tab in the sidebar (or **Main menu → Canvases**).

| Action | What happens |
| --- | --- |
| **New canvas** | Closes the current canvas and empties the canvas (undoable) |
| **Save** / **Update** | Stores the current scene under the name in the field |
| Click a canvas | Opens it — elements, background and grid are restored |
| Pencil | Renames the canvas |
| Trash | Deletes the canvas from the browser |

Saved canvases survive a reload and a browser restart. Clearing site data
removes them — nothing is uploaded anywhere.

## How it works

- `data/canvasStorage.ts` — IndexedDB store (`excalidraw-canvases` / `canvases`),
  one record per canvas: name, timestamps, the serialized scene and the binary
  files (images are inlined as data URLs so they survive a reload).
- `components/CanvasesPanel.tsx` — the sidebar panel.
- The scene is restored with `restoreElements()` / `restoreAppState()` and
  applied through `api.addFiles()` + `api.updateScene()`.

`currentCanvasIdAtom` tracks which canvas is open, so **Update** overwrites it
instead of creating a copy.
