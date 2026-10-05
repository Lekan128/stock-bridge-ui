import { API_BASE_URL } from '@/marketing/config'

/** The founding offer's live numbers (GET /api/public/founding-offer). */
export interface FoundingOffer {
  total: number
  left: number
  weeklyCapacity: number
  bookedThisWeek: number
  /** ISO date: the first day the offer is closed. */
  endsOn: string
  open: boolean
}

export interface SetupRequestResult {
  id: string
  founding: boolean
  alreadyRequested: boolean
  /** ISO date: the Monday of the week the setup is booked into. */
  setupWeekStarts: string
}

let offerRequest: Promise<FoundingOffer> | null = null

/** One request per page load, however many places show the numbers. */
export function fetchOffer(): Promise<FoundingOffer> {
  offerRequest ??= fetch(`${API_BASE_URL}/api/public/founding-offer`).then((response) => {
    if (!response.ok) throw new Error(`offer ${response.status}`)
    return response.json() as Promise<FoundingOffer>
  })
  return offerRequest
}

/** Books the setup. Throws an Error whose message is fit to show (the API's own words). */
export async function requestSetup(body: {
  businessName: string
  whatsapp: string
  source: 'landing' | 'founding' | 'pricing'
  website: string
}): Promise<SetupRequestResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/public/setup-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("We couldn't reach Procurepaddy. Check your connection and try again, or message us on WhatsApp.")
  }
  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { message?: string }) => data.message)
      .catch(() => undefined)
    throw new Error(message ?? 'Something went wrong. Try again, or message us on WhatsApp.')
  }
  return response.json()
}
