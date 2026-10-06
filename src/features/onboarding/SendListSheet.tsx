import { Camera, CircleCheck, FileUp, MessageCircle, RotateCcw, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { Spinner } from '@/components/Spinner'
import { MAX_LIST_FILE_BYTES, onboardingApi, shrinkPhoto, type ProductListFile } from '@/features/onboarding/onboardingApi'
import { WHATSAPP_URL } from '@/marketing/site'
import { isAppError } from '@/types/api'

type Pending = { key: string; file: File; state: 'waiting' | 'sending' | 'sent' | 'failed'; error?: string }

const ACCEPT = '.xlsx,.xls,.csv,.ods,.pdf,.txt,.doc,.docx,image/*'

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * "Send us your list" (LANDING_PAGE_PLAN.md §4): whatever the shop has (an Excel file, a CSV, a PDF,
 * or photos of the stock book, a page at a time) goes straight to the setup team, who load every
 * product, pack size and opening stock within 24 hours. Photos are shrunk on the phone first; each
 * file is sent on its own, so one that fails on a weak signal can be tried again by itself.
 */
export function SendListSheet({
  open,
  onClose,
  sent,
  companyName,
  companyId,
  onSent,
}: {
  open: boolean
  onClose: () => void
  sent: ProductListFile[]
  companyName: string
  companyId: string
  onSent: () => void
}) {
  const [pending, setPending] = useState<Pending[]>([])
  const [sending, setSending] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  function add(files: FileList | null) {
    if (!files) return
    const next = [...files].map((file, index) => ({ key: `${Date.now()}-${index}-${file.name}`, file, state: 'waiting' as const }))
    setPending((current) => [...current.filter((item) => item.state !== 'sent'), ...next])
  }

  function update(key: string, change: Partial<Pending>) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }

  async function sendAll() {
    setSending(true)
    for (const item of pending) {
      if (item.state === 'sent') continue
      update(item.key, { state: 'sending', error: undefined })
      try {
        const { blob, fileName } = await shrinkPhoto(item.file)
        if (blob.size > MAX_LIST_FILE_BYTES) {
          update(item.key, { state: 'failed', error: 'Over 5 MB. Send this one on WhatsApp.' })
          continue
        }
        await onboardingApi.sendListFile(blob, fileName)
        update(item.key, { state: 'sent' })
      } catch (err) {
        update(item.key, {
          state: 'failed',
          error: isAppError(err) ? err.message : "It didn't send. Check your connection and try again.",
        })
      }
    }
    setSending(false)
    onSent()
  }

  const waiting = pending.filter((item) => item.state !== 'sent').length
  const allSent = pending.length > 0 && waiting === 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send us your list"
      footer={
        allSent ? (
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button className="w-full" variant="action" onClick={() => void sendAll()} disabled={waiting === 0} loading={sending}>
            {waiting === 0 ? 'Choose what to send' : `Send ${waiting} ${waiting === 1 ? 'file' : 'files'}`}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {allSent ? (
          <p className="flex items-start gap-2 rounded-md bg-accent-50 px-3 py-2.5 text-sm text-accent-900">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
            Sent. We&apos;ll load your products within 24 hours and tell you on WhatsApp. Your checklist ticks itself when
            they&apos;re in.
          </p>
        ) : (
          <p className="text-sm text-neutral-700">
            Send what you have: your Excel or CSV, a PDF, or clear photos of your stock book, one page at a time. We load
            every product, pack size and opening stock within 24 hours.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => camera.current?.click()} disabled={sending}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            Take photos
          </Button>
          <Button variant="secondary" onClick={() => picker.current?.click()} disabled={sending}>
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose files
          </Button>
        </div>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          aria-label="Take photos of your stock book"
          onChange={(event) => {
            add(event.target.files)
            event.target.value = ''
          }}
        />
        <input
          ref={picker}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          aria-label="Choose files to send"
          onChange={(event) => {
            add(event.target.files)
            event.target.value = ''
          }}
        />

        {pending.length > 0 && (
          <ul className="flex flex-col divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {pending.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-neutral-900">{item.file.name}</span>
                  {item.error ? (
                    <span className="text-danger-700">{item.error}</span>
                  ) : (
                    <span className="text-neutral-600">{sizeLabel(item.file.size)}</span>
                  )}
                </span>
                {item.state === 'sending' && <Spinner size={16} />}
                {item.state === 'sent' && (
                  <span className="flex items-center gap-1 text-accent-800">
                    <CircleCheck className="h-4 w-4" aria-hidden="true" /> Sent
                  </span>
                )}
                {item.state === 'failed' && (
                  <span className="flex items-center gap-1 text-danger-700">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Not sent
                  </span>
                )}
                {item.state === 'waiting' && (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary-600 hover:underline"
                    onClick={() => setPending((current) => current.filter((other) => other.key !== item.key))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {pending.some((item) => item.state === 'failed') && !sending && (
          <Button variant="secondary" onClick={() => void sendAll()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try the rest again
          </Button>
        )}

        {sent.length > 0 && pending.length === 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Already sent</h3>
            <ul className="mt-1 text-sm text-neutral-700">
              {sent.map((file) => (
                <li key={file.id} className="truncate">
                  {file.fileName}
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hello Procurepaddy, this is ${companyName} (${companyId}). Here is my product list.`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-primary-600 hover:underline"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Or send it on WhatsApp
        </a>
      </div>
    </Sheet>
  )
}
