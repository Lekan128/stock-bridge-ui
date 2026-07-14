import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { superAdminLoginSchema, type SuperAdminLoginFormValues } from '@/auth/schemas'
import { useSuperAdminAuth } from '@/auth/useSuperAdminAuth'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { isAppError } from '@/types/api'

export function SuperAdminLoginPage() {
  const { login } = useSuperAdminAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SuperAdminLoginFormValues>({
    resolver: zodResolver(superAdminLoginSchema),
    defaultValues: { username: '', password: '' },
  })

  async function onSubmit(values: SuperAdminLoginFormValues) {
    setFormError(null)
    try {
      await login(values)
      navigate('/admin/tenants', { replace: true })
    } catch (err) {
      if (isAppError(err) && err.status === 401) {
        setFormError('Invalid username or password.')
      } else if (isAppError(err)) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <AuthCard
      title="Super Admin Log in"
      eyebrow={
        <span className="rounded-md bg-primary-900 px-2 py-0.5 text-xs font-medium tracking-wide text-white uppercase">
          Super Admin
        </span>
      }
      subtitle="Platform administration — not for tenant accounts"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
