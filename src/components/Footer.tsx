export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="mt-auto border-t border-app-border bg-app-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] text-xs text-app-text-muted sm:px-6 md:flex-row md:items-center md:justify-between md:pb-5">
        <p className="font-semibold text-app-text">Fantasy League Manager</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Built for private leagues</span>
          <span aria-hidden="true">·</span>
          <span>© {currentYear}</span>
        </div>
      </div>
    </footer>
  )
}
