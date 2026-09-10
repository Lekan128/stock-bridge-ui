import { useContext } from 'react'
import {
  EmailVerificationContext,
  type EmailVerificationContextValue,
} from '@/features/profile/context/EmailVerificationContext'

export function useEmailVerification(): EmailVerificationContextValue {
  const ctx = useContext(EmailVerificationContext)
  if (!ctx) {
    throw new Error('useEmailVerification must be used within an EmailVerificationProvider')
  }
  return ctx
}
