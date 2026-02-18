"use client";

import type { ReactNode } from "react";
import { useSplitView } from "@/lib/split-view-context";
import { PageGuide } from "@/components/layout/PageGuide";
import { MaximizeIcon, MinimizeIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SplitViewShell({ children }: { children: ReactNode }) {
  const { leftPanel, rightPanel, rightExpanded, setRightExpanded, closePanel, overlayPanel, closeOverlay } =
    useSplitView();

  const isCompact = rightPanel.open && !rightExpanded;
  const isExpanded = rightPanel.open && rightExpanded;

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* ── Left panel (inline sidebar) ── */}
      <div
        className={cn(
          "overflow-y-auto border-r border-border bg-card transition-all duration-300 ease-in-out",
          leftPanel.open
            ? "fixed inset-y-0 left-0 z-40 w-3/4 sm:relative sm:inset-auto sm:z-auto sm:w-[40%]"
            : "w-0 overflow-hidden",
        )}
      >
        {leftPanel.open && (
          <div className="relative p-6">
            <button
              type="button"
              onClick={() => closePanel("left")}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 cursor-pointer rounded-sm text-muted-foreground transition-opacity hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
            {leftPanel.content}
          </div>
        )}
      </div>

      {/* Mobile backdrop – left */}
      {leftPanel.open && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-black/40 sm:hidden"
          onClick={() => closePanel("left")}
          aria-label="Close panel"
        />
      )}

      {/* ── Main content – shifts left when right panel is open ── */}
      <main
        className={cn(
          "flex-1 overflow-y-auto pb-32 md:pb-20",
          "transition-[margin] duration-300 ease-in-out",
          isCompact && "md:mr-[25vw]",
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <PageGuide />
          {children}
        </div>
      </main>

      {/* ── Expanded backdrop (dark + blur, covers nav) ── */}
      <div
        className={cn(
          "fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isExpanded
            ? "pointer-events-auto cursor-pointer opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => isExpanded && closePanel("right")}
        onKeyDown={(e) => e.key === "Escape" && closePanel("right")}
        role="button"
        tabIndex={isExpanded ? 0 : -1}
        aria-label="Close panel"
      />

      {/* Mobile backdrop – compact right */}
      {isCompact && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-black/30 md:hidden"
          onClick={() => closePanel("right")}
          aria-label="Close panel"
        />
      )}

      {/* ── Right panel – always rendered for slide animation ── */}
      <div
        className={cn(
          // Base: matches nav styling
          "fixed flex flex-col overflow-hidden rounded-2xl border shadow-xl",
          "transition-all duration-300 ease-in-out",
          isExpanded
            ? // Expanded: fill viewport but leave space for CommandIsland
              "top-4 left-4 right-4 bottom-20 z-[60] border-border/50 bg-card backdrop-blur-lg"
            : cn(
                // Compact: same visual treatment
                "border-border/50 bg-card/80 backdrop-blur-lg",
                // Mobile: nearly full screen card, clear CommandIsland
                "bottom-20 left-4 right-4 top-4",
                // Desktop: right-anchored, stretch from top to above CommandIsland
                "md:left-auto md:right-3 md:top-3",
                // Width
                "md:w-[25vw] md:min-w-[340px]",
                "z-40",
                // Slide in/out from right
                rightPanel.open
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-[calc(100%+2rem)] opacity-0",
              ),
        )}
      >
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/30 px-3 py-2">
          <button
            type="button"
            onClick={() => setRightExpanded(!rightExpanded)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={rightExpanded ? "Collapse" : "Expand"}
          >
            {rightExpanded ? (
              <MinimizeIcon className="size-3.5" />
            ) : (
              <MaximizeIcon className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => closePanel("right")}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {rightPanel.content}
        </div>
      </div>

      {/* ── Mobile backdrop – overlay ── */}
      {overlayPanel.open && (
        <button
          type="button"
          className="fixed inset-0 z-[64] cursor-pointer bg-black/30 md:hidden"
          onClick={closeOverlay}
          aria-label="Close overlay"
        />
      )}

      {/* ── Overlay panel – floats above the right panel ── */}
      <div
        className={cn(
          "fixed flex flex-col overflow-hidden rounded-2xl border shadow-xl",
          "border-border/50 bg-card/80 backdrop-blur-lg",
          "transition-all duration-300 ease-in-out",
          "bottom-20 left-4 right-4 top-4",
          "md:left-auto md:right-3 md:top-3",
          "md:w-[25vw] md:min-w-[340px]",
          "z-[65]",
          overlayPanel.open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[calc(100%+2rem)] opacity-0",
        )}
      >
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border/30 px-3 py-2">
          <button
            type="button"
            onClick={closeOverlay}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {overlayPanel.content}
        </div>
      </div>
    </div>
  );
}
