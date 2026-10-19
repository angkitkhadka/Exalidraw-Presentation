import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { CaptureUpdateAction } from "@excalidraw/element";
import clsx from "clsx";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkIcon,
  pencilIcon,
  PlusIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";

import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { playerPlayIcon } from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useSetAtom } from "../app-jotai";
import {
  currentCanvasIdAtom,
  currentCanvasNameAtom,
  deleteCanvas,
  listCanvases,
  loadCanvas,
  renameCanvas,
  saveCanvas,
} from "../data/canvasStorage";
import {
  DEMO_SLIDES,
  DEMO_TITLE,
  openDemoScene,
} from "../presentation/demoDeck";
import { presentationAtom } from "../presentation/state";

import "./CanvasesPanel.scss";

import type { CanvasSummary } from "../data/canvasStorage";

export const CanvasIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const CanvasesPanel = () => {
  const api = useExcalidrawAPI();

  if (!api) {
    return null;
  }

  return <CanvasesPanelInner api={api} />;
};

const CanvasesPanelInner = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const [currentId, setCurrentId] = useAtom(currentCanvasIdAtom);
  const [currentName, setCurrentName] = useAtom(currentCanvasNameAtom);
  const setPresentation = useSetAtom(presentationAtom);

  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setCanvases(await listCanvases());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toast = (message: string) => api.setToast({ message });

  const handleSave = async () => {
    setBusy(true);
    try {
      const summary = await saveCanvas({
        id: currentId,
        name: name.trim() || currentName || "Untitled canvas",
        elements: api.getSceneElementsIncludingDeleted(),
        appState: api.getAppState(),
        files: api.getFiles(),
      });
      setCurrentId(summary.id);
      setCurrentName(summary.name);
      setName(summary.name);
      await refresh();
      toast(currentId ? "Canvas updated" : "Canvas saved");
    } catch (error: any) {
      toast(error?.message || "Could not save the canvas");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (id: string) => {
    setBusy(true);
    try {
      const scene = await loadCanvas(id);
      if (!scene) {
        toast("That canvas could not be read");
        return;
      }
      if (scene.files.length) {
        api.addFiles(scene.files);
      }
      api.updateScene({
        elements: scene.elements,
        appState: scene.appState,
      });
      const summary = canvases.find((canvas) => canvas.id === id);
      setCurrentId(id);
      setCurrentName(summary?.name ?? "");
      setName(summary?.name ?? "");
      toast(`Opened "${summary?.name ?? "canvas"}"`);
    } catch (error: any) {
      toast(error?.message || "Could not open the canvas");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opens the built-in demo deck. It is never stored, so it can not be
   * deleted or lost: it is rebuilt from its source every time.
   */
  const handleOpenDemo = async () => {
    if (api.getSceneElements().length) {
      const confirmed = await openConfirmModal({
        title: "Open the demo deck?",
        description:
          "The demo replaces the canvas you are working on. Save it first if you want to keep it.",
        actionLabel: "Open the demo",
        color: "danger",
      });
      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    try {
      await openDemoScene(api, rootRef.current?.ownerDocument);
      setCurrentId(null);
      setCurrentName("");
      setName("");
      // jump straight into the presentation
      setPresentation({ active: true, startIndex: 0 });
    } catch (error: any) {
      toast(error?.message || "Could not open the demo deck");
    } finally {
      setBusy(false);
    }
  };

  const handleNew = () => {
    const appState = api.getAppState();
    api.updateScene({
      elements: [],
      appState: { ...appState, name: null, selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setCurrentId(null);
    setCurrentName("");
    setName("");
    toast("Started a new canvas");
  };

  const handleDelete = async (id: string) => {
    await deleteCanvas(id);
    if (id === currentId) {
      setCurrentId(null);
      setCurrentName("");
      setName("");
    }
    await refresh();
    toast("Canvas deleted");
  };

  const handleRename = async (id: string) => {
    await renameCanvas(id, renameDraft);
    setRenamingId(null);
    if (id === currentId) {
      setCurrentName(renameDraft.trim());
      setName(renameDraft.trim());
    }
    await refresh();
  };

  return (
    <div className="exc-canvases" ref={rootRef}>
      <div className="exc-canvases__header">
        <div>
          <h3 className="exc-canvases__title">Canvases</h3>
          <p className="exc-canvases__subtitle">
            {canvases.length
              ? `${canvases.length} saved in this browser`
              : "Saved in this browser"}
          </p>
        </div>
      </div>

      <div className="exc-canvases__actions">
        <button
          type="button"
          className="exc-canvases__btn exc-canvases__btn--primary"
          onClick={handleNew}
          title="Close the current canvas and start a new one"
        >
          {PlusIcon}
          New canvas
        </button>
      </div>

      <div className="exc-canvases__save">
        <input
          className="exc-canvases__name"
          value={name}
          placeholder="Canvas name"
          aria-label="Canvas name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSave();
            }
          }}
        />
        <button
          type="button"
          className="exc-canvases__btn"
          disabled={busy}
          onClick={handleSave}
        >
          {checkIcon}
          {currentId ? "Update" : "Save"}
        </button>
      </div>

      <div className="exc-canvases__demo">
        <div className="exc-canvases__demoHead">
          <span className="exc-canvases__demoBadge">Demo</span>
          <span className="exc-canvases__demoCount">
            {DEMO_SLIDES.length} slides
          </span>
        </div>
        <div className="exc-canvases__demoTitle">{DEMO_TITLE}</div>
        <p className="exc-canvases__demoText">
          A built-in deck with transitions, hand-drawn draw-in animations and
          speaker notes. It is regenerated every time, so it can never be lost
          or deleted.
        </p>
        <button
          type="button"
          className="exc-canvases__btn exc-canvases__btn--demo"
          disabled={busy}
          onClick={handleOpenDemo}
        >
          {playerPlayIcon}
          Open and present the demo
        </button>
      </div>

      <div className="exc-canvases__list">
        {canvases.length === 0 && (
          <p className="exc-canvases__empty">
            No saved canvases yet. Draw something and press Save.
          </p>
        )}

        {canvases.map((canvas) => (
          <div
            key={canvas.id}
            className={clsx("exc-canvases__item", {
              "exc-canvases__item--current": canvas.id === currentId,
            })}
          >
            {renamingId === canvas.id ? (
              <input
                className="exc-canvases__name"
                value={renameDraft}
                autoFocus
                aria-label="Canvas name"
                onChange={(event) => setRenameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleRename(canvas.id);
                  }
                  if (event.key === "Escape") {
                    setRenamingId(null);
                  }
                }}
                onBlur={() => handleRename(canvas.id)}
              />
            ) : (
              <button
                type="button"
                className="exc-canvases__itemName"
                title={`Open "${canvas.name}"`}
                onClick={() => handleOpen(canvas.id)}
              >
                <span className="exc-canvases__itemTitle">{canvas.name}</span>
                <span className="exc-canvases__itemMeta">
                  {canvas.elementCount} element
                  {canvas.elementCount === 1 ? "" : "s"} ·{" "}
                  {formatDate(canvas.updatedAt)}
                </span>
              </button>
            )}

            <div className="exc-canvases__itemTools">
              <button
                type="button"
                title="Rename canvas"
                aria-label="Rename canvas"
                onClick={() => {
                  setRenameDraft(canvas.name);
                  setRenamingId(canvas.id);
                }}
              >
                {pencilIcon}
              </button>
              <button
                type="button"
                title="Delete canvas"
                aria-label="Delete canvas"
                onClick={() => handleDelete(canvas.id)}
              >
                {TrashIcon}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
