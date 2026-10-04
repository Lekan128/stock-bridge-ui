import '@/features/designPreview/designPreview.css'
import { applyPreview, readPreview } from '@/features/designPreview/designPreviewConfig'

// Preview builds only (main.tsx): put back whatever the person last chose to preview.
applyPreview(readPreview())
