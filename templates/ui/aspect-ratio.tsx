/**
 * AspectRatio component - Pure CSS aspect-ratio
 * Replaces radix-ui AspectRatio with CSS aspect-ratio property
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"

interface AspectRatioProps extends React.ComponentProps<"div"> {
  ratio?: number
}

function AspectRatio({
  ratio = 1,
  className,
  style,
  ...props
}: AspectRatioProps) {
  return (
    <div
      data-slot="aspect-ratio"
      className={cn("relative w-full", className)}
      style={{
        ...style,
        aspectRatio: String(ratio),
      }}
      {...props}
    />
  )
}

export { AspectRatio }
