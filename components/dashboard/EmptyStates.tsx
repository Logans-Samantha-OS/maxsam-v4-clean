export function EmptyState({ title, description }: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm">{description}</p>
    </div>
  )
}
