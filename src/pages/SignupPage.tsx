import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { signupSchema, type SignupFormValues } from '@/auth/schemas'
import { useAuth } from '@/auth/useAuth'
import { AuthCard } from '@/components/AuthCard'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { isAppError } from '@/types/api'
import { slugify } from '@/utils/slugify'

const KNOWN_FIELDS = new Set<keyof SignupFormValues>([
  'name',
  'clientIdentifier',
  'adminEmail',
  'password',
  'confirmPassword',
])

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const identifierEdited = useRef(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      clientIdentifier: '',
      adminEmail: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: SignupFormValues) {
    setFormError(null)
    try {
      const tenantUser = await signup({
        name: values.name,
        clientIdentifier: values.clientIdentifier || undefined,
        adminEmail: values.adminEmail,
        password: values.password,
        confirmPassword: values.confirmPassword,
      })
      showToast(`Welcome to Stock Bridge, ${tenantUser.clientName}!`, 'success')
      navigate('/', { replace: true })
    } catch (err) {
      if (!isAppError(err)) {
        setFormError('Something went wrong. Please try again.')
        return
      }

      let mappedAny = false
      for (const fieldError of err.errors ?? []) {
        if (fieldError.field && KNOWN_FIELDS.has(fieldError.field as keyof SignupFormValues)) {
          setError(fieldError.field as keyof SignupFormValues, { message: fieldError.message })
          mappedAny = true
        }
      }
      if (mappedAny) return

      const lower = err.message.toLowerCase()
      if (lower.includes('identifier')) {
        setError('clientIdentifier', { message: err.message })
      } else if (lower.includes('password') && lower.includes('match')) {
        setError('confirmPassword', { message: err.message })
      } else {
        setFormError(err.message)
      }
    }
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <span className="text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Company name"
          autoComplete="organization"
          error={errors.name?.message}
          {...register('name', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              if (!identifierEdited.current) {
                setValue('clientIdentifier', slugify(e.target.value), { shouldValidate: true })
              }
            },
          })}
        />
        <TextField
          label="Client identifier"
          hint="Used to log in. Lowercase letters, numbers, and hyphens only."
          error={errors.clientIdentifier?.message}
          {...register('clientIdentifier', {
            onChange: () => {
              identifierEdited.current = true
            },
          })}
        />
        <TextField
          label="Admin email"
          type="email"
          autoComplete="email"
          error={errors.adminEmail?.message}
          {...register('adminEmail')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <FormError message={formError} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthCard>
  )
}
