/**
 * RadioGroup component - Native HTML radio inputs
 * Replaces radix-ui RadioGroup with styled native radio inputs
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"
import { CircleIcon } from "lucide-react"

interface RadioGroupContextValue {
  name: string
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

interface RadioGroupProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
}

function RadioGroup({
  className,
  value,
  defaultValue,
  onValueChange,
  name,
  children,
  ...props
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const controlled = value !== undefined
  const currentValue = controlled ? value : internalValue
  const generatedName = React.useId()

  const handleValueChange = (newValue: string) => {
    if (!controlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <RadioGroupContext.Provider
      value={{
        name: name ?? generatedName,
        value: currentValue,
        onValueChange: handleValueChange,
      }}
    >
      <div
        data-slot="radio-group"
        role="radiogroup"
        className={cn("grid gap-3 w-full", className)}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps extends Omit<React.ComponentProps<"input">, "type"> {
  value: string
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext)
    if (!context) {
      throw new Error("RadioGroupItem must be used within a RadioGroup")
    }

    const isChecked = context.value === value

    const handleChange = () => {
      context.onValueChange?.(value)
    }

    return (
      <div
        data-slot="radio-group-item"
        data-checked={isChecked ? "true" : undefined}
        className={cn(
          "border-input text-primary dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex size-4 rounded-full shadow-xs focus-within:ring-[3px] aria-invalid:ring-[3px] group/radio-group-item relative aspect-square shrink-0 border after:absolute after:-inset-x-3 after:-inset-y-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className
        )}
      >
        <input
          ref={ref}
          type="radio"
          name={context.name}
          value={value}
          checked={isChecked}
          onChange={handleChange}
          className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          {...props}
        />
        {isChecked && (
          <div
            data-slot="radio-group-indicator"
            className="group-aria-invalid/radio-group-item:text-destructive text-primary flex size-4 items-center justify-center pointer-events-none"
          >
            <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
          </div>
        )}
      </div>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
