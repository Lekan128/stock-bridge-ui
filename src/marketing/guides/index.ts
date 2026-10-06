import { costPrice, excel, fifo, offline, units } from '@/marketing/guides/guidesTwo'
import { howToCount, howToTrackStock, openingStock, reorderLevels, stopMissing } from '@/marketing/guides/guidesOne'
import type { Guide } from '@/marketing/guides/types'

/** Every guide, in the order the index lists them: the first steps first. */
export const GUIDES: Guide[] = [
  howToTrackStock,
  howToCount,
  stopMissing,
  openingStock,
  reorderLevels,
  fifo,
  units,
  costPrice,
  excel,
  offline,
]
