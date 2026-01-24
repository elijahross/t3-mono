/**
 * Slider component - Native range input
 * Replaces radix-ui Slider with styled native range input
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"

interface SliderProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  defaultValue?: number[]
  value?: number[]
  min?: number
  max?: number
  step?: number
  orientation?: "horizontal" | "vertical"
  disabled?: boolean
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  defaultValue = [0],
  value,
  min = 0,
  max = 100,
  step = 1,
  orientation = "horizontal",
  disabled = false,
  onValueChange,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const controlled = value !== undefined
  const currentValue = controlled ? value : internalValue

  const handleChange = (index: number, newValue: number) => {
    const newValues = [...currentValue]
    newValues[index] = newValue

    // Sort values for range slider
    if (newValues.length > 1) {
      newValues.sort((a, b) => a - b)
    }

    if (!controlled) {
      setInternalValue(newValues)
    }
    onValueChange?.(newValues)
  }

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100

  const rangeStart = currentValue.length > 1 ? getPercentage(currentValue[0]) : 0
  const rangeEnd = getPercentage(currentValue[currentValue.length - 1])

  return (
    <div
      data-slot="slider"
      data-orientation={orientation}
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "data-[orientation=vertical]:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <div
        data-slot="slider-track"
        data-orientation={orientation}
        className="bg-muted rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 relative grow overflow-hidden"
      >
        <div
          data-slot="slider-range"
          className="bg-primary absolute select-none"
          style={
            orientation === "horizontal"
              ? {
                  left: `${rangeStart}%`,
                  right: `${100 - rangeEnd}%`,
                  top: 0,
                  bottom: 0,
                }
              : {
                  bottom: `${rangeStart}%`,
                  top: `${100 - rangeEnd}%`,
                  left: 0,
                  right: 0,
                }
          }
        />
      </div>
      {currentValue.map((val, index) => (
        <input
          key={index}
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          disabled={disabled}
          onChange={(e) => handleChange(index, Number(e.target.value))}
          className={cn(
            "absolute w-full h-full opacity-0 cursor-pointer",
            orientation === "vertical" && "h-full w-full"
          )}
          style={{
            pointerEvents: disabled ? "none" : "auto",
          }}
        />
      ))}
      {currentValue.map((val, index) => (
        <div
          key={index}
          data-slot="slider-thumb"
          className="border-primary ring-ring/50 size-4 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50 absolute cursor-pointer"
          style={
            orientation === "horizontal"
              ? {
                  left: `${getPercentage(val)}%`,
                  transform: "translateX(-50%)",
                }
              : {
                  bottom: `${getPercentage(val)}%`,
                  transform: "translateY(50%)",
                }
          }
        />
      ))}
    </div>
  )
}

export { Slider }
