import { useContext } from 'react'
import { SuperAdminAuthContext, type SuperAdminAuthContextValue } from '@/auth/SuperAdminAuthContext'

export function useSuperAdminAuth(): SuperAdminAuthContextValue {
  const ctx = useContext(SuperAdminAuthContext)
  if (!ctx) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider')
  }
  return ctx
}
