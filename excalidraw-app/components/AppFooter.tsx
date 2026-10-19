import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
      </Footer>
    );
  },
);
