/**
 * Sheet component - Dialog variant (side panel)
 * Built on top of Dialog component
 */
"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils/utils"
import { XIcon } from "lucide-react"

interface SheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

interface SheetProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const controlled = open !== undefined
  const isOpen = controlled ? open : internalOpen

  const handleOpenChange = (newOpen: boolean) => {
    if (!controlled) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  return (
    <SheetContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

interface SheetTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function SheetTrigger({
  className,
  asChild,
  onClick,
  children,
  ...props
}: SheetTriggerProps) {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error("SheetTrigger must be used within a Sheet")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.onOpenChange(true)
    onClick?.(event)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      ...props,
    } as React.HTMLAttributes<HTMLElement>)
  }

  return (
    <button
      type="button"
      data-slot="sheet-trigger"
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}

function SheetPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}

function SheetClose({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error("SheetClose must be used within a Sheet")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.onOpenChange(false)
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="sheet-close"
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}

function SheetOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error("SheetOverlay must be used within a Sheet")
  }

  return (
    <div
      data-slot="sheet-overlay"
      data-state={context.open ? "open" : "closed"}
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
        className
      )}
      onClick={() => context.onOpenChange(false)}
      {...props}
    />
  )
}

const sheetContentVariants = cva(
  "data-[state=open]:animate-in data-[state=closed]:animate-out bg-background fixed z-50 flex flex-col gap-6 p-6 shadow-lg transition ease-in-out duration-300 group/sheet-content",
  {
    variants: {
      side: {
        top: "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top ring-foreground/10 inset-x-0 top-0 ring-1 mx-1 mt-1 rounded-b-lg",
        bottom:
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom ring-foreground/10 inset-x-0 bottom-0 ring-1 mx-1 mb-1 rounded-t-lg",
        left: "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left border-border inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right:
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right border-border inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof sheetContentVariants> {}

function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  const context = React.useContext(SheetContext)
  if (!context) {
    throw new Error("SheetContent must be used within a Sheet")
  }

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context.onOpenChange(false)
      }
    }

    if (context.open) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [context.open, context])

  if (!context.open) return null

  return (
    <SheetPortal>
      <SheetOverlay />
      <div
        data-slot="sheet-content"
        data-state="open"
        data-side={side}
        role="dialog"
        aria-modal="true"
        className={cn(sheetContentVariants({ side }), className)}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        <SheetClose
          className="ring-offset-background focus:ring-ring data-disabled:pointer-events-none text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden cursor-pointer"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </SheetClose>
      </div>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("grid gap-1.5", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
