import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { SuperAdminAuthProvider } from '@/auth/SuperAdminAuthContext'
import { ToastProvider } from '@/components/ToastContext'
import { CartProvider } from '@/features/cart/context/CartContext'
import { EmailVerificationProvider } from '@/features/profile/context/EmailVerificationContext'
import { LowStockAlertsProvider } from '@/features/products/context/LowStockAlertsContext'
import { AppRoutes } from '@/routes/router'

// Provider order is load-bearing: CartProvider reads auth state (to choose between the
// localStorage cart and the server cart) and calls useToast (to report the merge on login), so it
// must sit inside both. It wraps the routes rather than StorefrontLayout because the cart badge,
// the cart page and checkout all need it, and the workspace's reorder action feeds it too.
function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SuperAdminAuthProvider>
            <LowStockAlertsProvider>
              <CartProvider>
                {/*
                  Innermost, but still ABOVE AppRoutes, and both halves of that matter.
                  Inside AuthProvider because it reads auth state to decide whether to ask
                  /api/me at all; above the routes because `/verify-email` is a public page
                  OUTSIDE the workspace shell, and it calls refresh() on success so the banner
                  clears without a reload. A provider mounted inside AppLayout could not be
                  reached from there.
                */}
                <EmailVerificationProvider>
                  <AppRoutes />
                </EmailVerificationProvider>
              </CartProvider>
            </LowStockAlertsProvider>
          </SuperAdminAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
