import { createElement, lazy, useEffect, useReducer, type ComponentType, type ReactNode } from 'react'

export interface LazyPage<P extends object> {
  (props: P): ReactNode
  /** Starts fetching the page's chunk now; once it is in, the page renders without suspending. */
  preload: () => Promise<void>
}

/**
 * `lazy()` for a page that can also be fetched ahead of its first render (Phase H, time to first
 * row).
 *
 * A plain `lazy()` page suspends on its first render even when its chunks are service-worker hits
 * a few milliseconds away, and since React 19, once a Suspense fallback has been shown its content
 * is held back until 300 ms after it ("fallback throttling") - so every warm open of the app sat on
 * a blank screen for 300 ms it had no reason to. So this page never suspends for a load that is
 * already under way (`preloadRoute`, at boot): it shows `placeholder` as an ordinary render and
 * swaps in the page the moment it arrives. Only a page nobody has started loading goes through
 * `lazy()`, exactly as before.
 */
export function lazyPage<P extends object>(
  load: () => Promise<ComponentType<P>>,
  placeholder: ReactNode = null,
): LazyPage<P> {
  let loaded: ComponentType<P> | null = null
  let loading: Promise<ComponentType<P>> | null = null
  const loadOnce = () =>
    (loading ??= load().then(
      (component) => {
        loaded = component
        return component
      },
      (error: unknown) => {
        // Offline before this chunk was ever cached: let the route's own lazy load try again,
        // and show its error.
        loading = null
        throw error
      },
    ))
  const Lazy = lazy(() => loadOnce().then((component) => ({ default: component })))

  function Page(props: P) {
    const [, rerender] = useReducer((n: number) => n + 1, 0)
    const waitingFor = loaded ? null : loading
    useEffect(() => {
      waitingFor?.then(rerender, rerender)
    }, [waitingFor])

    if (loaded) return createElement(loaded, props)
    if (waitingFor) return placeholder
    return createElement(Lazy, props)
  }
  Page.preload = () => loadOnce().then(() => undefined)
  return Page
}
