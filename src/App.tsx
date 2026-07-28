import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { SuperAdminAuthProvider } from '@/auth/SuperAdminAuthContext'
import { ToastProvider } from '@/components/ToastContext'
import { CartProvider } from '@/features/cart/context/CartContext'
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
                <AppRoutes />
              </CartProvider>
            </LowStockAlertsProvider>
          </SuperAdminAuthProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
