import { Logo } from '@/components/Logo'
import { Spinner } from '@/components/Spinner'

export function BootstrappingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4">
        <Logo size={40} />
        <Spinner size={20} className="text-neutral-400" />
      </div>
    </div>
  )
}
