import { cn } from '@/lib/cn'

export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', light ? 'bg-app-lime text-app-ink' : 'bg-app-brand text-white', className)}>
      <svg className="h-7 w-7" fill="none" viewBox="0 0 32 32">
        <path d="M7 25V7h5v13h13v5H7Z" fill="currentColor" />
        <path d="m18 6 8 8M18 14l8-8" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </span>
  )
}

/** Decorative field markings; the surrounding page supplies all content. */
export function FieldArtwork({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 480 280">
      <g stroke="currentColor" strokeWidth="1">
        <rect x="30" y="35" width="420" height="210" rx="4" />
        <path d="M65 35v210M415 35v210M100 35v210m35-210v210m35-210v210m35-210v210m35-210v210m35-210v210m35-210v210m35-210v210m35-210v210" />
        <path d="M65 107h350M65 173h350" strokeWidth="7" strokeDasharray="1 7" />
        <path d="m30 60 35-25M30 95l35-25M30 130l35-25M30 165l35-25M30 200l35-25M30 235l35-25M415 60l35-25M415 95l35-25M415 130l35-25M415 165l35-25M415 200l35-25M415 235l35-25" />
      </g>
      <g stroke="currentColor" strokeWidth="3">
        <path d="m146 118 16 16m-16 0 16-16m166 46 16 16m-16 0 16-16" />
        <circle cx="304" cy="96" r="8" />
        <path d="M172 173h48q22 0 22-22v-35m-8 8 8-8 8 8" />
      </g>
    </svg>
  )
}
