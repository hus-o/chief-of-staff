"use client"

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="max-w-sm text-center space-y-4">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <button
              onClick={reset}
              className="text-sm border rounded-md px-4 py-2"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
