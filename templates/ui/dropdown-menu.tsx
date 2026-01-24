/**
 * DropdownMenu component - Uses Floating UI for smart positioning
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
  useListNavigation,
  useTypeahead,
  Placement,
} from "@floating-ui/react"

import { cn } from "@/utils/utils"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

interface DropdownMenuOptions {
  initialOpen?: boolean
  placement?: Placement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function useDropdownMenu({
  initialOpen = false,
  placement = "bottom-start",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: DropdownMenuOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen

  const elementsRef = React.useRef<(HTMLElement | null)[]>([])
  const labelsRef = React.useRef<(string | null)[]>([])

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
  const role = useRole(context, { role: "menu" })
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  })
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    onMatch: setActiveIndex,
  })

  const interactions = useInteractions([
    click,
    dismiss,
    role,
    listNavigation,
    typeahead,
  ])

  return React.useMemo(
    () => ({
      open,
      setOpen,
      activeIndex,
      setActiveIndex,
      elementsRef,
      labelsRef,
      ...interactions,
      ...data,
    }),
    [open, setOpen, activeIndex, interactions, data]
  )
}

type ContextType = ReturnType<typeof useDropdownMenu> | null

const DropdownMenuContext = React.createContext<ContextType>(null)

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext)
  if (context == null) {
    throw new Error("DropdownMenu components must be wrapped in <DropdownMenu />")
  }
  return context
}

interface DropdownMenuProps {
  children: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function DropdownMenu({
  children,
  open,
  defaultOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const menu = useDropdownMenu({
    initialOpen: defaultOpen,
    open,
    onOpenChange,
  })

  return (
    <DropdownMenuContext.Provider value={menu}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ children, asChild, ...props }, propRef) {
    const context = useDropdownMenuContext()
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
        data-slot="dropdown-menu-trigger"
        data-state={context.open ? "open" : "closed"}
        {...context.getReferenceProps(props)}
      >
        {children}
      </button>
    )
  }
)

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  function DropdownMenuContent({ className, style, children, ...props }, propRef) {
    const context = useDropdownMenuContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef])

    if (!context.open) return null

    return (
      <FloatingPortal>
        <FloatingFocusManager context={context.context} modal={false}>
          <div
            ref={ref}
            data-slot="dropdown-menu-content"
            data-state="open"
            role="menu"
            style={{
              ...context.floatingStyles,
              ...style,
            }}
            {...context.getFloatingProps(props)}
            className={cn(
              "z-50 ring-foreground/10 bg-popover text-popover-foreground min-w-36 rounded-lg p-1 shadow-md ring-1 outline-none",
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

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean
  variant?: "default" | "destructive"
  disabled?: boolean
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  disabled,
  onClick,
  children,
  ...props
}: DropdownMenuItemProps) {
  const context = useDropdownMenuContext()

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    onClick?.(event)
    context.setOpen(false)
  }

  return (
    <div
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      data-disabled={disabled}
      role="menuitem"
      tabIndex={disabled ? undefined : -1}
      onClick={handleClick}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled=true]:opacity-50 data-[inset=true]:pl-8 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-pointer items-center outline-hidden select-none data-[disabled=true]:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const context = useDropdownMenuContext()

  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      data-disabled={disabled}
      tabIndex={disabled ? undefined : -1}
      onClick={() => {
        if (disabled) return
        onCheckedChange?.(!checked)
        context.setOpen(false)
      }}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm data-[disabled=true]:opacity-50 relative flex cursor-pointer items-center outline-hidden select-none data-[disabled=true]:pointer-events-none hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="left-2 size-4 [&_svg:not([class*='size-'])]:size-4 pointer-events-none absolute flex items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  )
}

const DropdownMenuRadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
} | null>(null)

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<"div"> & { value?: string; onValueChange?: (value: string) => void }) {
  return (
    <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
      <div data-slot="dropdown-menu-radio-group" role="group" {...props}>
        {children}
      </div>
    </DropdownMenuRadioGroupContext.Provider>
  )
}

interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  disabled,
  ...props
}: DropdownMenuRadioItemProps) {
  const context = useDropdownMenuContext()
  const radioContext = React.useContext(DropdownMenuRadioGroupContext)
  const isChecked = radioContext?.value === value

  return (
    <div
      data-slot="dropdown-menu-radio-item"
      role="menuitemradio"
      aria-checked={isChecked}
      data-disabled={disabled}
      tabIndex={disabled ? undefined : -1}
      onClick={() => {
        if (disabled) return
        radioContext?.onValueChange?.(value)
        context.setOpen(false)
      }}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm data-[disabled=true]:opacity-50 relative flex cursor-pointer items-center outline-hidden select-none data-[disabled=true]:pointer-events-none hover:bg-accent hover:text-accent-foreground",
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

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset=true]:pl-8", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-separator" role="separator" className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="dropdown-menu-shortcut" className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...props} />
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-group" role="group" {...props} />
}

function DropdownMenuSub({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset=true]:pl-8 [&_svg:not([class*='size-'])]:size-4 flex cursor-pointer items-center outline-none select-none hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </div>
  )
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-sub-content"
      className={cn("ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-md p-1 shadow-lg ring-1", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
