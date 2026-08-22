import { api } from '@/api/client'
import type {
  VendorWaitlistApplicationPayload,
  VendorWaitlistApplicationResponse,
} from '@/features/vendorWaitlist/types'

/**
 * The one public vendor endpoint.
 *
 * `public: true` for the same reason every call in `storefrontApi` passes it: `/api/vendor-waitlist`
 * is in the backend's PERMIT_ALL_PATHS allowlist and the caller is anonymous by definition, so
 * without the flag any non-2xx from here would trip the shared client's refresh-and-redirect and
 * throw a business that is trying to apply onto a login screen it has no account for — which is
 * exactly the confusion this whole flow is worded to avoid.
 */
export const vendorWaitlistApi = {
  apply: (payload: VendorWaitlistApplicationPayload) =>
    api
      .post<VendorWaitlistApplicationResponse>('/api/vendor-waitlist', payload, { public: true })
      .then((r) => r.data),
}
