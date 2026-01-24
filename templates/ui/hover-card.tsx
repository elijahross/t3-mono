/**
 * HoverCard component - Uses Floating UI for smart positioning
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
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  useMergeRefs,
  safePolygon,
  Placement,
} from "@floating-ui/react"

import { cn } from "@/utils/utils"

interface HoverCardOptions {
  initialOpen?: boolean
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  openDelay?: number
  closeDelay?: number
}

function useHoverCard({
  initialOpen = false,
  placement = "bottom",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  openDelay = 300,
  closeDelay = 300,
}: HoverCardOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({
        fallbackAxisSideDirection: "end",
        padding: 8,
      }),
      shift({ padding: 8 }),
    ],
  })

  const context = data.context

  const hover = useHover(context, {
    move: false,
    enabled: controlledOpen == null,
    delay: {
      open: openDelay,
      close: closeDelay,
    },
    handleClose: safePolygon({
      blockPointerEvents: true,
    }),
  })
  const focus = useFocus(context, {
    enabled: controlledOpen == null,
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "dialog" })

  const interactions = useInteractions([hover, focus, dismiss, role])

  return React.useMemo(
    () => ({
      open,
      setOpen,
      ...interactions,
      ...data,
    }),
    [open, setOpen, interactions, data]
  )
}

type ContextType = ReturnType<typeof useHoverCard> | null

const HoverCardContext = React.createContext<ContextType>(null)

function useHoverCardContext() {
  const context = React.useContext(HoverCardContext)
  if (context == null) {
    throw new Error("HoverCard components must be wrapped in <HoverCard />")
  }
  return context
}

interface HoverCardProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  openDelay?: number
  closeDelay?: number
}

function HoverCard({
  children,
  open,
  defaultOpen,
  onOpenChange,
  openDelay,
  closeDelay,
}: HoverCardProps) {
  const hoverCard = useHoverCard({
    initialOpen: defaultOpen,
    open,
    onOpenChange,
    openDelay,
    closeDelay,
  })

  return (
    <HoverCardContext.Provider value={hoverCard}>
      {children}
    </HoverCardContext.Provider>
  )
}

interface HoverCardTriggerProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean
}

const HoverCardTrigger = React.forwardRef<HTMLAnchorElement, HoverCardTriggerProps>(
  function HoverCardTrigger({ children, asChild, ...props }, propRef) {
    const context = useHoverCardContext()
    const ref = useMergeRefs([context.refs.setReference, propRef])

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children,
        context.getReferenceProps({
          ref,
          ...props,
          ...(children.props as Record<string, unknown>),
          "data-state": context.open ? "open" : "closed",
        })
      )
    }

    return (
      <a
        ref={ref}
        data-state={context.open ? "open" : "closed"}
        {...context.getReferenceProps(props)}
      >
        {children}
      </a>
    )
  }
)

interface HoverCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

const HoverCardContent = React.forwardRef<HTMLDivElement, HoverCardContentProps>(
  function HoverCardContent({ className, style, children, ...props }, propRef) {
    const context = useHoverCardContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef])

    if (!context.open) return null

    return (
      <FloatingPortal>
        <div
          ref={ref}
          data-slot="hover-card-content"
          data-state="open"
          style={{
            ...context.floatingStyles,
            ...style,
          }}
          {...context.getFloatingProps(props)}
          className={cn(
            "z-50 ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-4 text-sm shadow-md ring-1 outline-none",
            className
          )}
        >
          {children}
        </div>
      </FloatingPortal>
    )
  }
)

export { HoverCard, HoverCardTrigger, HoverCardContent }
