import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export interface StorefrontSearchInputProps {
  /** Called after a submit — lets the mobile drawer close itself. */
  onSubmitted?: () => void
  autoFocus?: boolean
  className?: string
}

/**
 * Catalog search box in the storefront header.
 *
 * Submitting navigates to `/?q=…` rather than holding the term in context: the catalog's filters,
 * sort and page all live in the URL (contract §7 query params), so a search is shareable, survives
 * a reload, and the browser back button steps through searches the way shoppers expect.
 */
export function StorefrontSearchInput({ onSubmitted, autoFocus = false, className = '' }: StorefrontSearchInputProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeQuery = searchParams.get('q') ?? ''
  const [term, setTerm] = useState(activeQuery)

  // Keep the box in step with the URL — e.g. after a back/forward, or when a category link
  // clears the query.
  useEffect(() => {
    setTerm(activeQuery)
  }, [activeQuery])

  function submit(next: string) {
    const trimmed = next.trim()
    // Dropping the param entirely (rather than `?q=`) keeps the "browse everything" URL clean.
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/')
    onSubmitted?.()
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit(term)
      }}
      className={`relative flex w-full items-center ${className}`}
    >
      <label htmlFor="storefront-search" className="sr-only">
        Search the ProcurePal catalog
      </label>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400" aria-hidden="true" />
      <input
        id="storefront-search"
        type="search"
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search products, brands or SKUs"
        className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-24 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
      {term && (
        <button
          type="button"
          onClick={() => {
            setTerm('')
            submit('')
          }}
          aria-label="Clear search"
          className="absolute right-[4.75rem] rounded p-1 text-neutral-400 hover:text-neutral-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="submit"
        className="absolute right-1 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
      >
        Search
      </button>
    </form>
  )
}
