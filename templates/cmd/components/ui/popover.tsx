/**
 * Popover component - Uses Floating UI for smart positioning
 * Automatically flips and shifts to stay within viewport
 */
"use client"

import * as React from "react"
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  useMergeRefs,
  Placement,
} from "@floating-ui/react"

import { cn } from "@/lib/utils"

interface PopoverOptions {
  initialOpen?: boolean
  placement?: Placement
  modal?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function usePopover({
  initialOpen = false,
  placement = "bottom",
  modal = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: PopoverOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({
        fallbackAxisSideDirection: "end",
        padding: 8,
      }),
      shift({ padding: 8 }),
    ],
  })

  const context = data.context

  const click = useClick(context, {
    enabled: controlledOpen == null,
  })
  const dismiss = useDismiss(context)
  const role = useRole(context)

  const interactions = useInteractions([click, dismiss, role])

  return React.useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
      modal,
    }),
    [open, setOpen, interactions, data, modal]
  )
}

type ContextType = ReturnType<typeof usePopover> | null

const PopoverContext = React.createContext<ContextType>(null)

function usePopoverContext() {
  const context = React.useContext(PopoverContext)
  if (context == null) {
    throw new Error("Popover components must be wrapped in <Popover />")
  }
  return context
}

interface PopoverProps {
  children: React.ReactNode
  modal?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function Popover({
  children,
  modal = false,
  open,
  defaultOpen,
  onOpenChange,
}: PopoverProps) {
  const popover = usePopover({
    initialOpen: defaultOpen,
    open,
    onOpenChange,
    modal,
  })

  return (
    <PopoverContext.Provider value={popover}>
      {children}
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ children, asChild, ...props }, propRef) {
    const context = usePopoverContext()
    const ref = useMergeRefs([context.refs.setReference, propRef])

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children,
        context.getReferenceProps({
          ref,
          ...props,
          ...(children.props as Record<string, unknown>),
          "data-state": context.open ? "open" : "closed",
        } as any)
      )
    }

    return (
      <button
        ref={ref}
        type="button"
        data-state={context.open ? "open" : "closed"}
        {...context.getReferenceProps(props)}
      >
        {children}
      </button>
    )
  }
)

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent({ className, style, children, ...props }, propRef) {
    const context = usePopoverContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef])

    if (!context.open) return null

    return (
      <FloatingPortal>
        <FloatingFocusManager context={context.context} modal={context.modal}>
          <div
            ref={ref}
            data-slot="popover-content"
            data-state="open"
            style={{
              ...context.floatingStyles,
              ...style,
            }}
            {...context.getFloatingProps(props)}
            className={cn(
              "z-[100] ring-foreground/10 bg-popover text-popover-foreground w-72 rounded-lg p-4 text-sm shadow-md ring-1 outline-none",
              className
            )}
          >
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    )
  }
)

function PopoverClose({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const context = usePopoverContext()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context.setOpen(false)
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="popover-close"
      onClick={handleClick}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </button>
  )
}

function PopoverAnchor({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="popover-anchor" className={cn(className)} {...props} />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
  PopoverAnchor,
}
