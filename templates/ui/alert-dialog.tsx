/**
 * AlertDialog component - Dialog variant for confirmations
 * Custom implementation without radix-ui
 */
"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/utils/utils"
import { Button } from "@/components/ui/button"

interface AlertDialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null)

interface AlertDialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function AlertDialog({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: AlertDialogProps) {
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
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

interface AlertDialogTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function AlertDialogTrigger({
  className,
  asChild,
  onClick,
  children,
  ...props
}: AlertDialogTriggerProps) {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error("AlertDialogTrigger must be used within an AlertDialog")
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
      data-slot="alert-dialog-trigger"
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </button>
  )
}

function AlertDialogPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error("AlertDialogOverlay must be used within an AlertDialog")
  }

  return (
    <div
      data-slot="alert-dialog-overlay"
      data-state={context.open ? "open" : "closed"}
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  )
}

interface AlertDialogContentProps extends React.ComponentProps<"div"> {
  size?: "default" | "sm"
}

function AlertDialogContent({
  className,
  size = "default",
  children,
  ...props
}: AlertDialogContentProps) {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error("AlertDialogContent must be used within an AlertDialog")
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
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <div
        data-slot="alert-dialog-content"
        data-state="open"
        data-size={size}
        role="alertdialog"
        aria-modal="true"
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100 data-[size=default]:max-w-lg data-[size=sm]:max-w-xs group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 shadow-lg outline-none",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "bg-muted mb-2 inline-flex size-16 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="alert-dialog-title"
      className={cn(
        "text-lg font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-dialog-description"
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

interface AlertDialogActionProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive"
  size?: "default" | "sm"
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  onClick,
  ...props
}: AlertDialogActionProps) {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error("AlertDialogAction must be used within an AlertDialog")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    context.onOpenChange(false)
  }

  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(className)}
      {...props}
    />
  )
}

interface AlertDialogCancelProps extends React.ComponentProps<"button"> {
  variant?: "outline" | "ghost"
  size?: "default" | "sm"
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: AlertDialogCancelProps) {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error("AlertDialogCancel must be used within an AlertDialog")
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    context.onOpenChange(false)
  }

  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
