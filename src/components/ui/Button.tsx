import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost'
type ButtonSize = 'sm' | 'md' | 'icon' | 'compactIcon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-app-brand text-white shadow-sm hover:bg-app-brand-strong disabled:bg-app-border disabled:text-app-text-muted',
  secondary:
    'border border-app-border bg-app-surface text-app-text shadow-sm hover:bg-app-surface-subtle',
  ghost: 'text-app-text-muted hover:bg-app-surface-subtle hover:text-app-text',
  danger:
    'bg-app-danger text-white shadow-sm hover:bg-red-800 disabled:bg-app-border disabled:text-app-text-muted',
  dangerGhost:
    'text-app-danger hover:bg-app-danger-soft hover:text-app-danger',
}

const sizeClasses: Record<ButtonSize, string> = {
  compactIcon: 'h-10 w-10 shrink-0 p-0',
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  icon: 'h-11 w-11 shrink-0 p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      size = 'md',
      type = 'button',
      variant = 'primary',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--app-radius-sm)] font-semibold transition-[background-color,border-color,color,box-shadow,transform] active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
