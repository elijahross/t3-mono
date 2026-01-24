/**
 * Dialog component - Native dialog element
 * Replaces radix-ui Dialog with native HTML dialog
 */
"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/utils/utils"
import { XIcon } from "lucide-react"

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
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
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function DialogTrigger({
  className,
  asChild,
  onClick,
  children,
  ...props
}: DialogTriggerProps) {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("DialogTrigger must be used within a Dialog")
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
      data-slot="dialog-trigger"
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}

function DialogClose({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("DialogClose must be used within a Dialog")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.onOpenChange(false)
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("DialogOverlay must be used within a Dialog")
  }

  return (
    <div
      data-slot="dialog-overlay"
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

interface DialogContentProps extends React.ComponentProps<"div"> {
  size?: "default" | "sm" | "lg" | "xl" | "full"
}

function DialogContent({
  className,
  size = "default",
  children,
  ...props
}: DialogContentProps) {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error("DialogContent must be used within a Dialog")
  }

  // Handle escape key
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
    <DialogPortal>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        data-state="open"
        data-size={size}
        role="dialog"
        aria-modal="true"
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100 data-[size=default]:max-w-lg data-[size=sm]:max-w-sm data-[size=lg]:max-w-3xl data-[size=xl]:max-w-5xl data-[size=full]:max-w-[calc(100%-2rem)] group/dialog-content fixed top-1/2 left-1/2 z-50 grid w-full max-h-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-lg",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
        <DialogClose
          className="ring-offset-background focus:ring-ring data-disabled:pointer-events-none data-disabled:opacity-50 text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden cursor-pointer"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </DialogClose>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("grid gap-1.5 text-left sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
