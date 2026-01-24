/**
 * Separator component - Pure HTML div
 * Replaces radix-ui Separator with native div element
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"

interface SeparatorProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  const semanticProps = decorative
    ? { role: "none" }
    : { "aria-orientation": orientation, role: "separator" }

  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      {...semanticProps}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
