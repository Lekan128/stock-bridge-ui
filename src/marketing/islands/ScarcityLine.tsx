import { useEffect, useState } from 'react'
import { fetchOffer, type FoundingOffer } from '@/marketing/api'
import { OFFER_ENDS_ON, formatDay } from '@/marketing/offer'

/**
 * The founding offer's real limits, beside the offer (conversion rule 7): places left, this week's
 * setups, the end date. The date is in the HTML; the counts arrive from the API and never pulse.
 * If they can't be fetched, only the date shows: a number we can't vouch for is never shown.
 */
export function ScarcityLine({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [offer, setOffer] = useState<FoundingOffer | null>(null)
  useEffect(() => {
    fetchOffer().then(setOffer, () => undefined)
  }, [])

  const muted = tone === 'dark' ? 'text-primary-100' : 'text-neutral-600'
  const strong = tone === 'dark' ? 'text-white' : 'text-neutral-900'
  if (offer && !offer.open) {
    return (
      <p className={`text-sm ${muted}`}>
        The founding setups are taken. You can still start with Procurepaddy, and we&apos;ll still help you set up.
      </p>
    )
  }
  return (
    // Each item keeps its words together; lines break only between items.
    // Room held for the counts before they arrive, so the page doesn't shift when they do.
    <p className={`min-h-[3.75rem] font-mono text-sm tabular-nums sm:min-h-[2.5rem] ${muted}`} data-scarcity>
      {offer && (
        <>
          <span className={`whitespace-nowrap ${strong}`}>Founding setups left: {offer.left} of {offer.total}</span>
          {' · '}
          <span className="whitespace-nowrap">
            This week: {Math.min(offer.bookedThisWeek, offer.weeklyCapacity)} of {offer.weeklyCapacity} booked
          </span>
          {' · '}
        </>
      )}
      <span className="whitespace-nowrap">Offer ends {formatDay(offer?.endsOn ?? OFFER_ENDS_ON)}</span>
    </p>
  )
}
