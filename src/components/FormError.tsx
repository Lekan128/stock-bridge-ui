export function FormError({ message }: { message?: string | null }) {
  if (!message) return null

  return (
    <div role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
      {message}
    </div>
  )
}
