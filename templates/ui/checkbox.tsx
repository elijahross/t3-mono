/**
 * Checkbox component - Native HTML checkbox
 * Replaces radix-ui Checkbox with styled native checkbox
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"
import { CheckIcon } from "lucide-react"

interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
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
        data-slot="checkbox"
        data-checked={checkedState ? "true" : undefined}
        className={cn(
          "border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-[4px] border shadow-xs transition-shadow group-has-disabled/field:opacity-50 focus-within:ring-[3px] aria-invalid:ring-[3px] relative shrink-0 after:absolute after:-inset-x-3 after:-inset-y-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checkedState}
          onChange={handleChange}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          {...props}
        />
        {checkedState && (
          <CheckIcon
            data-slot="checkbox-indicator"
            className="size-3.5 text-current pointer-events-none"
          />
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
