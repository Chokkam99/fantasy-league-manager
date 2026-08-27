import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const formControlClassName =
  'min-h-11 w-full rounded-[var(--app-radius-sm)] border border-app-border bg-app-surface px-3 text-app-text outline-none transition focus:border-app-brand focus:ring-2 focus:ring-app-brand-soft disabled:cursor-not-allowed disabled:bg-app-surface-subtle disabled:text-app-text-muted'

export function FormField({
  children,
  description,
  htmlFor,
  label,
  optional = false,
}: {
  children: ReactNode
  description?: ReactNode
  htmlFor: string
  label: ReactNode
  optional?: boolean
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-app-text" htmlFor={htmlFor}>
        {label}{' '}
        {optional && <span className="font-normal text-app-text-muted">(optional)</span>}
      </label>
      {description && <p className="mt-1 text-xs leading-5 text-app-text-muted">{description}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
  function TextInput({ className, ...props }, ref) {
    return <input className={cn(formControlClassName, className)} ref={ref} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<'select'>>(
  function Select({ className, ...props }, ref) {
    return <select className={cn(formControlClassName, className)} ref={ref} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        className={cn(formControlClassName, 'min-h-24 resize-y py-2.5', className)}
        ref={ref}
        {...props}
      />
    )
  },
)
