/**
 * Switch component - Native checkbox styled as switch
 * Replaces radix-ui Switch with styled native checkbox
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"

interface SwitchProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  size?: "sm" | "default"
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, size = "default", checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false)
    const controlled = checked !== undefined
    const checkedState = controlled ? checked : isChecked

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newChecked = event.target.checked
      if (!controlled) {
        setIsChecked(newChecked)
      }
      onChange?.(event)
      onCheckedChange?.(newChecked)
    }

    return (
      <div
        data-slot="switch"
        data-size={size}
        data-checked={checkedState ? "true" : undefined}
        data-unchecked={!checkedState ? "true" : undefined}
        className={cn(
          "data-checked:bg-primary data-unchecked:bg-input focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-full border border-transparent shadow-xs focus-within:ring-[3px] aria-invalid:ring-[3px] data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] group/switch relative inline-flex items-center transition-all after:absolute after:-inset-x-3 after:-inset-y-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          checked={checkedState}
          onChange={handleChange}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          aria-checked={checkedState}
          {...props}
        />
        <span
          data-slot="switch-thumb"
          className={cn(
            "bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full pointer-events-none block ring-0 transition-transform",
            "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
            checkedState
              ? "group-data-[size=default]/switch:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:translate-x-[calc(100%-2px)]"
              : "group-data-[size=default]/switch:translate-x-0 group-data-[size=sm]/switch:translate-x-0"
          )}
          data-checked={checkedState ? "true" : undefined}
          data-unchecked={!checkedState ? "true" : undefined}
        />
      </div>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
