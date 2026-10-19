import {
  eyeIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { CanvasIcon } from "./CanvasesPanel";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const excalidrawAPI = useExcalidrawAPI();

  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.Item
        icon={<CanvasIcon />}
        onSelect={() =>
          excalidrawAPI?.toggleSidebar({
            name: "default",
            tab: "canvases",
            force: true,
          })
        }
      >
        Canvases
      </MainMenu.Item>
      <MainMenu.Item
        icon={presentationIcon}
        onSelect={() =>
          excalidrawAPI?.toggleSidebar({
            name: "default",
            tab: "presentation",
            force: true,
          })
        }
      >
        Presentation
      </MainMenu.Item>
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
