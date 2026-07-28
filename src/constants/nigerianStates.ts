/**
 * The 36 states plus the Federal Capital Territory, alphabetical.
 *
 * ProcurePal delivers within Nigeria only, so `delivery_addresses` has no country column
 * (see contract §4.3) and every address form renders this as a <select> rather than a free
 * text field — a typo'd state breaks delivery routing and skews the regional analytics.
 */
export const NIGERIAN_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT - Abuja',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
] as const

export type NigerianState = (typeof NIGERIAN_STATES)[number]

/** Widened to plain string: persisted addresses may predate a rename of any entry above. */
export function isNigerianState(value: string): boolean {
  return (NIGERIAN_STATES as readonly string[]).includes(value)
}
