/**
 * Select component - Uses Floating UI for smart positioning
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
  size,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  useMergeRefs,
  useListNavigation,
  useTypeahead,
} from "@floating-ui/react"

import { cn } from "@/utils/utils"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

interface SelectOptions {
  initialOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

function useSelect({
  initialOpen = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  value: controlledValue,
  defaultValue = "",
  onValueChange: setControlledValue,
}: SelectOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)

  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen
  const value = controlledValue ?? uncontrolledValue
  const setValue = setControlledValue ?? setUncontrolledValue

  const elementsRef = React.useRef<(HTMLElement | null)[]>([])
  const labelsRef = React.useRef<(string | null)[]>([])

  const data = useFloating({
    placement: "bottom-start",
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            minWidth: `${rects.reference.width}px`,
          })
        },
        padding: 8,
      }),
    ],
  })

  const context = data.context

  const click = useClick(context, { event: "mousedown" })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "listbox" })
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    selectedIndex,
    onNavigate: setActiveIndex,
    loop: true,
  })
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex,
    onMatch: open ? setActiveIndex : undefined,
  })

  const interactions = useInteractions([
    click,
    dismiss,
    role,
    listNavigation,
    typeahead,
  ])

  const handleSelect = React.useCallback(
    (index: number | null, itemValue: string) => {
      setSelectedIndex(index)
      setValue(itemValue)
      setOpen(false)
    },
    [setValue, setOpen]
  )

  return React.useMemo(
    () => ({
      open,
      setOpen,
      value,
      setValue,
      activeIndex,
      selectedIndex,
      setSelectedIndex,
      handleSelect,
      elementsRef,
      labelsRef,
      ...interactions,
      ...data,
    }),
    [open, setOpen, value, setValue, activeIndex, selectedIndex, handleSelect, interactions, data]
  )
}

type SelectContextType = ReturnType<typeof useSelect> | null

const SelectContext = React.createContext<SelectContextType>(null)

function useSelectContext() {
  const context = React.useContext(SelectContext)
  if (context == null) {
    throw new Error("Select components must be wrapped in <Select />")
  }
  return context
}

interface SelectProps {
  open?: boolean
  defaultOpen?: boolean
  value?: string
  defaultValue?: string
  onOpenChange?: (open: boolean) => void
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({
  open,
  defaultOpen,
  value,
  defaultValue,
  onOpenChange,
  onValueChange,
  children,
}: SelectProps) {
  const select = useSelect({
    initialOpen: defaultOpen,
    open,
    onOpenChange,
    value,
    defaultValue,
    onValueChange,
  })

  return (
    <SelectContext.Provider value={select}>
      {children}
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger({ className, children, ...props }, propRef) {
    const context = useSelectContext()
    const ref = useMergeRefs([context.refs.setReference, propRef])

    return (
      <button
        ref={ref}
        type="button"
        data-slot="select-trigger"
        data-state={context.open ? "open" : "closed"}
        aria-expanded={context.open}
        aria-haspopup="listbox"
        {...context.getReferenceProps(props)}
        className={cn(
          "border-input dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 data-[state=open]:border-ring data-[state=open]:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] focus-visible:ring-[3px] aria-invalid:ring-[3px] data-[state=open]:ring-[3px] has-[>span>[data-slot=select-value]:empty]:text-muted-foreground *:data-[slot=select-value]:truncate *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:text-left *:data-[slot=select-value]:line-clamp-1 group/select-trigger flex w-full items-center justify-between gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
          className
        )}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground size-4 opacity-50" />
      </button>
    )
  }
)

function SelectValue({ placeholder, className, ...props }: React.ComponentProps<"span"> & { placeholder?: string }) {
  const context = useSelectContext()

  return (
    <span data-slot="select-value" className={cn(className)} {...props}>
      {context.value || placeholder}
    </span>
  )
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "item-aligned" | "popper"
  side?: "top" | "bottom"
  sideOffset?: number
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  function SelectContent({ className, children, ...props }, propRef) {
    const context = useSelectContext()
    const ref = useMergeRefs([context.refs.setFloating, propRef])

    if (!context.open) return null

    return (
      <FloatingPortal>
        <FloatingFocusManager context={context.context} modal={false}>
          <div
            ref={ref}
            data-slot="select-content"
            data-state="open"
            role="listbox"
            style={context.floatingStyles}
            {...context.getFloatingProps(props)}
            className={cn(
              "z-50 ring-foreground/10 bg-popover text-popover-foreground max-h-96 overflow-x-hidden overflow-y-auto rounded-lg p-1 shadow-md ring-1 outline-none",
              className
            )}
          >
            <SelectScrollUpButton />
            {children}
            <SelectScrollDownButton />
          </div>
        </FloatingFocusManager>
      </FloatingPortal>
    )
  }
)

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </div>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </div>
  )
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  function SelectItem({ className, children, value, disabled, ...props }, propRef) {
    const context = useSelectContext()
    const isSelected = context.value === value

    const index = React.useRef<number | null>(null)

    const ref = useMergeRefs([
      propRef,
      (node: HTMLElement | null) => {
        if (node) {
          const idx = context.elementsRef.current.indexOf(node)
          if (idx === -1) {
            index.current = context.elementsRef.current.length
            context.elementsRef.current.push(node)
            context.labelsRef.current.push(node.textContent)
          } else {
            index.current = idx
          }
        }
      },
    ])

    const isActive = context.activeIndex === index.current

    return (
      <div
        ref={ref}
        data-slot="select-item"
        data-selected={isSelected}
        data-disabled={disabled}
        data-active={isActive}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        tabIndex={disabled ? undefined : isActive ? 0 : -1}
        onClick={() => {
          if (!disabled) {
            context.handleSelect(index.current, value)
          }
        }}
        className={cn(
          "focus:bg-accent focus:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex w-full cursor-pointer items-center outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          className
        )}
        {...props}
      >
        <span className="right-2 size-4 pointer-events-none absolute flex items-center justify-center">
          {isSelected && <CheckIcon className="size-4" />}
        </span>
        {children}
      </div>
    )
  }
)

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select-group" role="group" className={cn(className)} {...props} />
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select-label" className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...props} />
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select-separator" role="separator" className={cn("bg-border -mx-1 my-1 h-px pointer-events-none", className)} {...props} />
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
