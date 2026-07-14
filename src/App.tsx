import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { SuperAdminAuthProvider } from '@/auth/SuperAdminAuthContext'
import { ToastProvider } from '@/components/ToastContext'
import { LowStockAlertsProvider } from '@/features/products/context/LowStockAlertsContext'
import { AppRoutes } from '@/routes/router'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SuperAdminAuthProvider>
            <LowStockAlertsProvider>
              <AppRoutes />
            </LowStockAlertsProvider>
          </SuperAdminAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
