/**
 * Slot component for asChild pattern
 * Replaces radix-ui Slot.Root without external dependencies
 * Merges props and passes ref to child element
 */
import * as React from "react"
import { clsx } from "clsx"

function mergeProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>
): Record<string, unknown> {
  const overrideProps: Record<string, unknown> = { ...childProps }

  for (const propName in childProps) {
    const slotPropValue = slotProps[propName]
    const childPropValue = childProps[propName]

    const isHandler = /^on[A-Z]/.test(propName)
    if (isHandler) {
      // Merge event handlers
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: unknown[]) => {
          ;(childPropValue as (...args: unknown[]) => void)(...args)
          ;(slotPropValue as (...args: unknown[]) => void)(...args)
        }
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue
      }
    } else if (propName === "style") {
      // Merge styles
      overrideProps[propName] = { ...slotPropValue as object, ...childPropValue as object }
    } else if (propName === "className") {
      // Merge classNames
      overrideProps[propName] = clsx(slotPropValue, childPropValue)
    }
  }

  return { ...slotProps, ...overrideProps }
}

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, forwardedRef) => {
    const childrenArray = React.Children.toArray(children)
    const slottable = childrenArray.find(isSlottable)

    if (slottable) {
      const newElement = slottable.props.children as React.ReactNode
      const newChildren = childrenArray.map((child) => {
        if (child === slottable) {
          if (React.Children.count(newElement) > 1) {
            return React.Children.only(null)
          }
          return React.isValidElement(newElement)
            ? (newElement.props as { children?: React.ReactNode }).children
            : null
        }
        return child
      })

      return (
        <SlotClone {...slotProps} ref={forwardedRef}>
          {React.isValidElement(newElement)
            ? React.cloneElement(newElement, undefined, newChildren)
            : null}
        </SlotClone>
      )
    }

    return (
      <SlotClone {...slotProps} ref={forwardedRef}>
        {children}
      </SlotClone>
    )
  }
)
Slot.displayName = "Slot"

interface SlotCloneProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

const SlotClone = React.forwardRef<HTMLElement, SlotCloneProps>(
  ({ children, ...props }, forwardedRef) => {
    if (React.isValidElement(children)) {
      const childRef = (children as React.ReactElement & { ref?: React.Ref<unknown> }).ref
      return React.cloneElement(children, {
        ...mergeProps(props, children.props as Record<string, unknown>),
        ref: forwardedRef
          ? composeRefs(forwardedRef, childRef)
          : childRef,
      } as React.Attributes)
    }

    return React.Children.count(children) > 1 ? React.Children.only(null) : null
  }
)
SlotClone.displayName = "SlotClone"

const Slottable = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

function isSlottable(child: React.ReactNode): child is React.ReactElement<{ children: React.ReactNode }> {
  return React.isValidElement(child) && child.type === Slottable
}

type PossibleRef<T> = React.Ref<T> | undefined

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref !== null && ref !== undefined) {
    ;(ref as React.MutableRefObject<T>).current = value
  }
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => refs.forEach((ref) => setRef(ref, node))
}

export { Slot, Slottable }
