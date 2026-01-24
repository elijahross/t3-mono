/**
 * ContextMenu component - Right-click menu
 * Custom implementation without radix-ui
 */
"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/utils/utils"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

interface ContextMenuContextValue {
  open: boolean
  position: { x: number; y: number }
  onOpenChange: (open: boolean) => void
  setPosition: (position: { x: number; y: number }) => void
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null)

function ContextMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })

  return (
    <ContextMenuContext.Provider value={{ open, position, onOpenChange: setOpen, setPosition }}>
      {children}
    </ContextMenuContext.Provider>
  )
}

function ContextMenuTrigger({ className, children, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(ContextMenuContext)
  if (!context) throw new Error("ContextMenuTrigger must be used within a ContextMenu")

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    context.setPosition({ x: event.clientX, y: event.clientY })
    context.onOpenChange(true)
  }

  return (
    <div
      data-slot="context-menu-trigger"
      onContextMenu={handleContextMenu}
      className={cn(className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ContextMenuPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function ContextMenuContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(ContextMenuContext)
  if (!context) throw new Error("ContextMenuContent must be used within a ContextMenu")

  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        context.onOpenChange(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") context.onOpenChange(false)
    }
    if (context.open) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [context.open, context])

  if (!context.open) return null

  return (
    <ContextMenuPortal>
      <div
        ref={contentRef}
        data-slot="context-menu-content"
        data-state="open"
        role="menu"
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ring-foreground/10 bg-popover text-popover-foreground min-w-36 rounded-lg p-1 shadow-md ring-1 duration-100 fixed z-50",
          className
        )}
        style={{ top: context.position.y, left: context.position.x }}
        {...props}
      >
        {children}
      </div>
    </ContextMenuPortal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean; variant?: "default" | "destructive" }) {
  const context = React.useContext(ContextMenuContext)

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(event)
    context?.onOpenChange(false)
  }

  return (
    <div
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      role="menuitem"
      tabIndex={-1}
      onClick={handleClick}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive gap-2 rounded-sm px-2 py-1.5 text-sm data-disabled:opacity-50 data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-pointer items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: React.ComponentProps<"div"> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  const context = React.useContext(ContextMenuContext)

  return (
    <div
      data-slot="context-menu-checkbox-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      onClick={() => {
        onCheckedChange?.(!checked)
        context?.onOpenChange(false)
      }}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm data-disabled:opacity-50 relative flex cursor-pointer items-center outline-hidden select-none data-disabled:pointer-events-none hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="left-2 size-4 pointer-events-none absolute flex items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  )
}

const ContextMenuRadioGroupContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void } | null>(null)

function ContextMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<"div"> & { value?: string; onValueChange?: (value: string) => void }) {
  return (
    <ContextMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
      <div data-slot="context-menu-radio-group" role="group" {...props}>
        {children}
      </div>
    </ContextMenuRadioGroupContext.Provider>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const context = React.useContext(ContextMenuContext)
  const radioContext = React.useContext(ContextMenuRadioGroupContext)
  const isChecked = radioContext?.value === value

  return (
    <div
      data-slot="context-menu-radio-item"
      role="menuitemradio"
      aria-checked={isChecked}
      tabIndex={-1}
      onClick={() => {
        radioContext?.onValueChange?.(value)
        context?.onOpenChange(false)
      }}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm data-disabled:opacity-50 relative flex cursor-pointer items-center outline-hidden select-none data-disabled:pointer-events-none hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="left-2 size-4 pointer-events-none absolute flex items-center justify-center">
        {isChecked && <CircleIcon className="size-2 fill-current" />}
      </span>
      {children}
    </div>
  )
}

function ContextMenuLabel({ className, inset, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return <div data-slot="context-menu-label" data-inset={inset} className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)} {...props} />
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="context-menu-separator" role="separator" className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="context-menu-shortcut" className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...props} />
}

function ContextMenuGroup({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="context-menu-group" role="group" {...props} />
}

function ContextMenuSub({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function ContextMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn("focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 flex cursor-pointer items-center outline-none select-none", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </div>
  )
}

function ContextMenuSubContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="context-menu-sub-content" className={cn("ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-md p-1 shadow-lg ring-1", className)} {...props} />
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
