import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema, type LoginFormValues } from '@/auth/schemas'
import { useAuth } from '@/auth/useAuth'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'
import { DEFAULT_AUTHENTICATED_PATH, readRedirectParam, sanitizeRedirect } from '@/utils/redirectTarget'
import { authStorage } from '@/utils/storage'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { loginTenant } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      clientIdentifier: authStorage.getLastClientIdentifier() ?? '',
      username: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)
    try {
      await loginTenant(values)
      // Precedence: an explicit `?redirect=` (how the storefront sends people here — e.g.
      // `/login?redirect=/checkout`), then legacy router state, then the workspace dashboard.
      // Both candidates go through sanitizeRedirect so a crafted link can't bounce the user off-site.
      const redirectTo =
        readRedirectParam(location.search) ??
        sanitizeRedirect((location.state as LocationState | null)?.from?.pathname) ??
        DEFAULT_AUTHENTICATED_PATH
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (isAppError(err) && err.status === 401) {
        setFormError('Invalid Company ID, username, or password.')
      } else if (isAppError(err)) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <AuthCard
      title="Log in"
      footer={
        <div className="flex flex-col gap-2">
          <span className="text-neutral-500">
            New company?{' '}
            <Link to="/signup" className="font-medium text-primary-600 hover:underline">
              Create an account
            </Link>
          </span>
          {/* Login sits outside the storefront chrome, so it needs its own way back. */}
          <Link to="/" className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline">
            Browse the ProcurePal marketplace
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Company ID"
          hint="The short identifier your company was given at signup."
          autoComplete="organization"
          error={errors.clientIdentifier?.message}
          {...register('clientIdentifier')}
        />
        <TextField
          label="Username"
          autoComplete="username"
          error={errors.username?.message}
          {...register('username')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  )
}
