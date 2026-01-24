/**
 * ToggleGroup component - Group of toggle buttons
 * Replaces radix-ui ToggleGroup with custom implementation
 */
"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/utils"
import { toggleVariants } from "@/components/ui/toggle"

interface ToggleGroupContextValue extends VariantProps<typeof toggleVariants> {
  type: "single" | "multiple"
  value: string[]
  onValueChange: (value: string) => void
  spacing?: number
  orientation?: "horizontal" | "vertical"
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

interface ToggleGroupProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange">,
    VariantProps<typeof toggleVariants> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
  spacing?: number
  orientation?: "horizontal" | "vertical"
}

function ToggleGroup({
  className,
  variant,
  size,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  spacing = 0,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupProps) {
  const normalizeValue = (val: string | string[] | undefined): string[] => {
    if (val === undefined) return []
    return Array.isArray(val) ? val : [val]
  }

  const [internalValue, setInternalValue] = React.useState<string[]>(
    normalizeValue(defaultValue)
  )
  const controlled = value !== undefined
  const currentValue = controlled ? normalizeValue(value) : internalValue

  const handleValueChange = (itemValue: string) => {
    let newValue: string[]

    if (type === "single") {
      newValue = currentValue.includes(itemValue) ? [] : [itemValue]
    } else {
      newValue = currentValue.includes(itemValue)
        ? currentValue.filter((v) => v !== itemValue)
        : [...currentValue, itemValue]
    }

    if (!controlled) {
      setInternalValue(newValue)
    }

    onValueChange?.(type === "single" ? (newValue[0] ?? "") : newValue)
  }

  return (
    <ToggleGroupContext.Provider
      value={{
        type,
        value: currentValue,
        onValueChange: handleValueChange,
        variant,
        size,
        spacing,
        orientation,
      }}
    >
      <div
        data-slot="toggle-group"
        data-variant={variant}
        data-size={size}
        data-spacing={spacing}
        data-orientation={orientation}
        role="group"
        style={{ "--gap": spacing } as React.CSSProperties}
        className={cn(
          "rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

interface ToggleGroupItemProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof toggleVariants> {
  value: string
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  value,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext)
  if (!context) {
    throw new Error("ToggleGroupItem must be used within a ToggleGroup")
  }

  const isPressed = context.value.includes(value)

  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      data-state={isPressed ? "on" : "off"}
      aria-pressed={isPressed}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "data-[state=on]:bg-muted group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:last:rounded-r-md group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:last:rounded-b-md shrink-0 focus:z-10 focus-visible:z-10 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { ToggleGroup, ToggleGroupItem }
