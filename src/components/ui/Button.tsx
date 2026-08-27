import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'icon'

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
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  icon: 'h-11 w-11 p-0',
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
        'inline-flex items-center justify-center gap-2 rounded-[var(--app-radius-sm)] font-semibold transition-colors disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
