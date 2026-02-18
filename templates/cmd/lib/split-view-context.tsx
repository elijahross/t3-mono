"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { clearDrawerState } from "@/lib/view-state";

interface PanelState {
  open: boolean;
  content: ReactNode | null;
  width?: string;
}

interface SplitViewContextValue {
  leftPanel: PanelState;
  rightPanel: PanelState;
  rightExpanded: boolean;
  setRightExpanded: (v: boolean) => void;
  openPanel: (side: "left" | "right", content: ReactNode, width?: string) => void;
  closePanel: (side: "left" | "right") => void;
  overlayPanel: PanelState;
  openOverlay: (content: ReactNode) => void;
  closeOverlay: () => void;
}

const SplitViewContext = createContext<SplitViewContextValue | null>(null);

const closedPanel: PanelState = { open: false, content: null };

export function SplitViewProvider({ children }: { children: ReactNode }) {
  const [leftPanel, setLeftPanel] = useState<PanelState>(closedPanel);
  const [rightPanel, setRightPanel] = useState<PanelState>(closedPanel);
  const [rightExpanded, setRightExpanded] = useState(false);
  const [overlayPanel, setOverlayPanel] = useState<PanelState>(closedPanel);

  const openPanel = useCallback(
    (side: "left" | "right", content: ReactNode, width?: string) => {
      const state: PanelState = { open: true, content, width };
      if (side === "left") setLeftPanel(state);
      else {
        setRightPanel(state);
        setRightExpanded(false);
      }
    },
    [],
  );

  const closePanel = useCallback((side: "left" | "right") => {
    clearDrawerState();
    if (side === "left") setLeftPanel(closedPanel);
    else {
      setRightPanel(closedPanel);
      setRightExpanded(false);
      setOverlayPanel(closedPanel);
    }
  }, []);

  const openOverlay = useCallback((content: ReactNode) => {
    setOverlayPanel({ open: true, content });
  }, []);

  const closeOverlay = useCallback(() => {
    clearDrawerState();
    setOverlayPanel(closedPanel);
  }, []);

  return (
    <SplitViewContext.Provider
      value={{
        leftPanel,
        rightPanel,
        rightExpanded,
        setRightExpanded,
        openPanel,
        closePanel,
        overlayPanel,
        openOverlay,
        closeOverlay,
      }}
    >
      {children}
    </SplitViewContext.Provider>
  );
}

export function useSplitView() {
  const ctx = useContext(SplitViewContext);
  if (!ctx)
    throw new Error("useSplitView must be used within SplitViewProvider");
  return ctx;
}
