/**
 * Tooltip component - Uses Floating UI for smart positioning
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
  Placement,
} from "@floating-ui/react"

import { cn } from "@/utils/utils"

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
  skipDelayDuration?: number
}

const TooltipProviderContext = React.createContext<{
  delayDuration: number
  skipDelayDuration: number
}>({
  delayDuration: 300,
  skipDelayDuration: 300,
})

function TooltipProvider({
  children,
  delayDuration = 300,
  skipDelayDuration = 300,
}: TooltipProviderProps) {
  return (
    <TooltipProviderContext.Provider value={{ delayDuration, skipDelayDuration }}>
      {children}
    </TooltipProviderContext.Provider>
  )
}

interface TooltipOptions {
  initialOpen?: boolean
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
}

function useTooltip({
  initialOpen = false,
  placement = "top",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  delayDuration,
}: TooltipOptions = {}) {
  const providerContext = React.useContext(TooltipProviderContext)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen
  const delay = delayDuration ?? providerContext.delayDuration

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        fallbackAxisSideDirection: "start",
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
      open: delay,
      close: 0,
    },
  })
  const focus = useFocus(context, {
    enabled: controlledOpen == null,
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "tooltip" })

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

type ContextType = ReturnType<typeof useTooltip> | null

const TooltipContext = React.createContext<ContextType>(null)

function useTooltipContext() {
  const context = React.useContext(TooltipContext)
  if (context == null) {
    throw new Error("Tooltip components must be wrapped in <Tooltip />")
  }
  return context
}

interface TooltipProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
}

function Tooltip({
  children,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
}: TooltipProps) {
  const tooltip = useTooltip({
    initialOpen: defaultOpen,
    open,
    onOpenChange,
    delayDuration,
  })

  return (
    <TooltipContext.Provider value={tooltip}>
      {children}
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  function TooltipTrigger({ children, asChild, ...props }, propRef) {
    const context = useTooltipContext()
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

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  function TooltipContent({ className, style, children, ...props }, propRef) {
    const context = useTooltipContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef])

    if (!context.open) return null

    return (
      <FloatingPortal>
        <div
          ref={ref}
          data-slot="tooltip-content"
          data-state="open"
          style={{
            ...context.floatingStyles,
            ...style,
          }}
          {...context.getFloatingProps(props)}
          className={cn(
            "z-50 bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-medium shadow-md",
            className
          )}
        >
          {children}
        </div>
      </FloatingPortal>
    )
  }
)

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
