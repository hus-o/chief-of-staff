"use client"

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-8">
      <div className="max-w-sm text-center space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Something went wrong</h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          An unexpected error occurred. Try again or reload the page.
        </p>
        <button
          onClick={reset}
          className="text-[14px] font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-md px-4 py-2 transition-colors duration-100 hover:bg-muted/40"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
