import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { presentationIcon } from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import { SlidesPanel } from "../presentation/SlidesPanel";

import { CanvasIcon, CanvasesPanel } from "./CanvasesPanel";

import "./AppSidebar.scss";

export const AppSidebar = () => {
  const { openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="canvases"
          style={{ opacity: openSidebar?.tab === "canvases" ? 1 : 0.4 }}
        >
          <CanvasIcon />
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="canvases" className="px-3">
        <CanvasesPanel />
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <SlidesPanel />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
