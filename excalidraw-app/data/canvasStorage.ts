import { createStore, del, entries, get, set } from "idb-keyval";

import { getNonDeletedElements } from "@excalidraw/element";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { atom } from "../app-jotai";

const store = createStore("excalidraw-canvases", "canvases");

export type CanvasSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  elementCount: number;
};

type CanvasRecord = CanvasSummary & {
  /** serialized scene (elements + app state) */
  scene: string;
  /** binary files (images), stored as data URLs */
  files: BinaryFileData[];
};

export type CanvasScene = {
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: AppState["viewBackgroundColor"];
    exportBackground: AppState["exportBackground"];
    gridSize: AppState["gridSize"];
    gridStep: AppState["gridStep"];
    name: string | null;
  };
  files: BinaryFileData[];
};

/** id of the canvas currently open in the editor (null = unsaved) */
export const currentCanvasIdAtom = atom<string | null>(null);
/** name of the canvas currently open in the editor */
export const currentCanvasNameAtom = atom<string>("");

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `canvas-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** binary files hold blob: URLs, which don't survive a reload — inline them */
const toStorableFile = async (
  file: BinaryFileData,
): Promise<BinaryFileData | null> => {
  const { dataURL } = file;
  if (!dataURL) {
    return null;
  }
  if (dataURL.startsWith("data:")) {
    return { ...file, dataURL };
  }
  try {
    const response = await fetch(dataURL);
    const blob = await response.blob();
    return { ...file, dataURL: (await blobToDataUrl(blob)) as DataURL };
  } catch {
    return null;
  }
};

export const listCanvases = async (): Promise<CanvasSummary[]> => {
  const all = await entries<string, CanvasRecord>(store);
  const summaries = all
    .map(([, record]) => ({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      elementCount: record.elementCount,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
};

export const getCanvas = async (id: string) => {
  const record = await get<CanvasRecord>(id, store);
  if (!record) {
    return null;
  }
  return {
    ...record,
    scene: undefined,
    files: undefined,
  } as CanvasSummary;
};

export const saveCanvas = async ({
  id,
  name,
  elements,
  appState,
  files,
}: {
  id?: string | null;
  name: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}): Promise<CanvasSummary> => {
  const canvasId = id || createId();
  const existing = await get<CanvasRecord>(canvasId, store);
  const now = Date.now();

  const storableFiles = (
    await Promise.all(Object.values(files).map(toStorableFile))
  ).filter((file): file is BinaryFileData => file !== null);

  const scene = serializeAsJSON(elements, appState, {}, "local");

  const record: CanvasRecord = {
    id: canvasId,
    name: name.trim() || "Untitled canvas",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    elementCount: getNonDeletedElements(elements).length,
    scene,
    files: storableFiles,
  };

  await set(canvasId, record, store);
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    elementCount: record.elementCount,
  };
};

export const loadCanvas = async (id: string): Promise<CanvasScene | null> => {
  const record = await get<CanvasRecord>(id, store);
  if (!record) {
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(record.scene);
  } catch {
    return null;
  }

  const elements = restoreElements(parsed.elements ?? [], null, {
    refreshDimensions: true,
    repairBindings: true,
  });
  const appState = restoreAppState(parsed.appState ?? {}, null);

  return {
    elements: elements as ExcalidrawElement[],
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      exportBackground: appState.exportBackground,
      gridSize: appState.gridSize,
      gridStep: appState.gridStep,
      name: record.name,
    },
    files: record.files ?? [],
  };
};

export const renameCanvas = async (id: string, name: string) => {
  const record = await get<CanvasRecord>(id, store);
  if (!record) {
    return;
  }
  await set(
    id,
    { ...record, name: name.trim() || record.name, updatedAt: Date.now() },
    store,
  );
};

export const deleteCanvas = async (id: string) => {
  await del(id, store);
};
