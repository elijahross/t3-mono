/**
 * Collapsible component - Custom implementation
 * Replaces radix-ui Collapsible with custom JS
 */
"use client"

import * as React from "react"

import { cn } from "@/utils/utils"

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

interface CollapsibleProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
}

function Collapsible({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
  ...props
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const controlled = open !== undefined
  const isOpen = controlled ? open : internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return
    if (!controlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  const toggle = () => handleOpenChange(!isOpen)

  return (
    <CollapsibleContext.Provider
      value={{
        open: isOpen,
        onOpenChange: handleOpenChange,
        toggle,
      }}
    >
      <div
        data-slot="collapsible"
        data-state={isOpen ? "open" : "closed"}
        data-disabled={disabled ? "true" : undefined}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function CollapsibleTrigger({
  className,
  asChild,
  onClick,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("CollapsibleTrigger must be used within a Collapsible")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.toggle()
    onClick?.(event)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      "data-state": context.open ? "open" : "closed",
      "aria-expanded": context.open,
      ...props,
    } as React.HTMLAttributes<HTMLElement>)
  }

  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      data-state={context.open ? "open" : "closed"}
      aria-expanded={context.open}
      onClick={handleClick}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </button>
  )
}

interface CollapsibleContentProps extends React.ComponentProps<"div"> {
  forceMount?: boolean
}

function CollapsibleContent({
  className,
  forceMount = false,
  children,
  ...props
}: CollapsibleContentProps) {
  const context = React.useContext(CollapsibleContext)
  if (!context) {
    throw new Error("CollapsibleContent must be used within a Collapsible")
  }

  const contentRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | undefined>(
    context.open ? undefined : 0
  )

  React.useEffect(() => {
    if (context.open) {
      const contentHeight = contentRef.current?.scrollHeight
      setHeight(contentHeight)
      const timeout = setTimeout(() => setHeight(undefined), 200)
      return () => clearTimeout(timeout)
    } else {
      const contentHeight = contentRef.current?.scrollHeight
      setHeight(contentHeight)
      requestAnimationFrame(() => {
        setHeight(0)
      })
    }
  }, [context.open])

  if (!forceMount && !context.open && height === 0) {
    return null
  }

  return (
    <div
      data-slot="collapsible-content"
      data-state={context.open ? "open" : "closed"}
      className={cn(
        "overflow-hidden transition-[height] duration-200",
        className
      )}
      style={{ height: height === undefined ? "auto" : height }}
      {...props}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
