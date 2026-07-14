import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50">
      <h1 className="text-2xl font-semibold text-neutral-900">Page not found</h1>
      <Link to="/" className="text-primary-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
