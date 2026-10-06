import { api } from '@/api/client'

/** A file sent with "Send us your list". */
export interface ProductListFile {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
}

/** GET /api/onboarding: the setup checklist as the server knows it (the install item is the phone's). */
export interface OnboardingStatus {
  products: number
  /** The shop's own stock changes: not opening stock from an import, not Procurepaddy support's. */
  stockChanges: number
  /** Staff other than the owner and Procurepaddy support. */
  staff: number
  listFiles: number
  files: ProductListFile[]
  /** The setup request's status. Absent when the shop has none (the API omits nulls). */
  setupStatus?: 'NEW' | 'CONTACTED' | 'LIST_RECEIVED' | 'LOADED' | 'RUNNING' | 'NOT_A_FIT'
  /** ON or OFF (switched off by the owner); absent when the team has never opened the shop. */
  supportAccess?: 'ON' | 'OFF'
  createdAt: string
}

export const MAX_LIST_FILE_BYTES = 5 * 1024 * 1024

export const onboardingApi = {
  status: () => api.get<OnboardingStatus>('/api/onboarding').then((r) => r.data),

  /** One file at a time, so a weak signal sends what it can and the rest can be retried. */
  sendListFile: (file: Blob, fileName: string) => {
    const body = new FormData()
    body.append('file', file, fileName)
    return api.post<ProductListFile>('/api/onboarding/product-list', body).then((r) => r.data)
  },
}

/**
 * A photo of a stock book doesn't need 12 megapixels. Shrinks it to at most 2000px on the long side
 * as a JPEG (about half a megabyte, which matters on a Nigerian data plan and keeps it under the
 * 5 MB limit). Anything that isn't a photo, or can't be decoded here, is sent as it is.
 */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; fileName: string }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return { blob: file, fileName: file.name }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob || blob.size >= file.size) return { blob: file, fileName: file.name }
    return { blob, fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg' }
  } catch {
    return { blob: file, fileName: file.name }
  }
}

const INSTALLED_KEY = 'pp.installed'

/** Whether Procurepaddy is on this phone's home screen: running from it now, or installed before. */
export function isInstalledHere(standalone: boolean): boolean {
  try {
    if (standalone) localStorage.setItem(INSTALLED_KEY, '1')
    return standalone || localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    return standalone
  }
}
