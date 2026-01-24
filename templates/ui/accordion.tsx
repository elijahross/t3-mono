/**
 * Accordion component - Custom implementation
 * Replaces radix-ui Accordion with details/summary or custom JS
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

interface AccordionContextValue {
  type: "single" | "multiple"
  value: string[]
  onValueChange: (value: string) => void
  collapsible?: boolean
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

interface AccordionItemContextValue {
  value: string
  isOpen: boolean
  toggle: () => void
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

interface AccordionProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
  collapsible?: boolean
}

function Accordion({
  className,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  collapsible = true,
  children,
  ...props
}: AccordionProps) {
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
      if (currentValue.includes(itemValue)) {
        newValue = collapsible ? [] : currentValue
      } else {
        newValue = [itemValue]
      }
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
    <AccordionContext.Provider
      value={{
        type,
        value: currentValue,
        onValueChange: handleValueChange,
        collapsible,
      }}
    >
      <div
        data-slot="accordion"
        className={cn("flex w-full flex-col", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps extends React.ComponentProps<"div"> {
  value: string
}

function AccordionItem({
  className,
  value,
  children,
  ...props
}: AccordionItemProps) {
  const context = React.useContext(AccordionContext)
  if (!context) {
    throw new Error("AccordionItem must be used within an Accordion")
  }

  const isOpen = context.value.includes(value)
  const toggle = () => context.onValueChange(value)

  return (
    <AccordionItemContext.Provider value={{ value, isOpen, toggle }}>
      <div
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        className={cn("not-last:border-b", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

interface AccordionTriggerProps extends React.ComponentProps<"button"> {}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionTriggerProps) {
  const context = React.useContext(AccordionItemContext)
  if (!context) {
    throw new Error("AccordionTrigger must be used within an AccordionItem")
  }

  return (
    <h3 className="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        aria-expanded={context.isOpen}
        onClick={context.toggle}
        className={cn(
          "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-md py-4 text-left text-sm font-medium hover:underline focus-visible:ring-[3px] **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className={cn(
            "pointer-events-none shrink-0 transition-transform duration-200",
            context.isOpen && "rotate-180"
          )}
        />
      </button>
    </h3>
  )
}

interface AccordionContentProps extends React.ComponentProps<"div"> {}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionContentProps) {
  const context = React.useContext(AccordionItemContext)
  if (!context) {
    throw new Error("AccordionContent must be used within an AccordionItem")
  }

  const contentRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | undefined>(
    context.isOpen ? undefined : 0
  )

  React.useEffect(() => {
    if (context.isOpen) {
      const contentHeight = contentRef.current?.scrollHeight
      setHeight(contentHeight)
      // After animation, set to auto for dynamic content
      const timeout = setTimeout(() => setHeight(undefined), 200)
      return () => clearTimeout(timeout)
    } else {
      // Set to current height first for animation
      const contentHeight = contentRef.current?.scrollHeight
      setHeight(contentHeight)
      // Then animate to 0
      requestAnimationFrame(() => {
        setHeight(0)
      })
    }
  }, [context.isOpen])

  return (
    <div
      data-slot="accordion-content"
      data-state={context.isOpen ? "open" : "closed"}
      className="text-sm overflow-hidden transition-[height] duration-200"
      style={{ height: height === undefined ? "auto" : height }}
      {...props}
    >
      <div
        ref={contentRef}
        className={cn(
          "pt-0 pb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
