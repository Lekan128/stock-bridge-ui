import type { CompanyVendor } from '@/features/vendors/types'

/** How the supplier gets the order. PHONE: already ordered by phone, nothing is sent. */
export type SendWay = 'WHATSAPP' | 'EMAIL' | 'SELF' | 'PHONE'

/**
 * Which way starts picked: email only once it has worked for this supplier (the owner's rule of
 * 1 Nov), else WhatsApp when there is a number, else sending it yourself.
 */
export function defaultSendWay(vendor: CompanyVendor | undefined): SendWay {
  if (!vendor) return 'SELF'
  if (vendor.emailOrders === true && (vendor.email ?? '').trim() !== '') return 'EMAIL'
  if ((vendor.contactPhone ?? '').trim() !== '') return 'WHATSAPP'
  return 'SELF'
}
