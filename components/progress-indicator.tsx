export function ProgressIndicator() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 border-2 border-border rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-foreground rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[15px] font-medium">Analyzing messages</p>
        <p className="text-[13px] text-muted-foreground">
          Extracting features, clustering threads, synthesizing triage
        </p>
      </div>
    </div>
  )
}
