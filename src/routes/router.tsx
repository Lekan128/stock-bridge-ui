import { Navigate, Route, Routes } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { RedirectIfAuthenticated } from '@/auth/RedirectIfAuthenticated'
import { RedirectIfSuperAdminAuthenticated } from '@/auth/RedirectIfSuperAdminAuthenticated'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequirePermission } from '@/auth/RequirePermission'
import { RequireSuperAdmin } from '@/auth/RequireSuperAdmin'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AppLayout } from '@/layouts/AppLayout'
import { AdminAggregateAnalyticsPage } from '@/pages/AdminAggregateAnalyticsPage'
import { AdminTenantDetailPage } from '@/pages/AdminTenantDetailPage'
import { AdminTenantsPage } from '@/pages/AdminTenantsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { LoginPage } from '@/pages/LoginPage'
import { LowStockProductsPage } from '@/pages/LowStockProductsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProductFormPage } from '@/pages/ProductFormPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { SignupPage } from '@/pages/SignupPage'
import { SuperAdminLoginPage } from '@/pages/SuperAdminLoginPage'
import { UsersPage } from '@/pages/UsersPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        }
      />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="products"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ProductsPage />
            </RequirePermission>
          }
        />
        <Route
          path="products/new"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ProductFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="products/low-stock"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
              <LowStockProductsPage />
            </RequirePermission>
          }
        />
        <Route
          path="products/:id"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ProductDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="products/:id/edit"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_PRODUCTS}>
              <ProductFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="inventory"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_INVENTORY}>
              <InventoryPage />
            </RequirePermission>
          }
        />
        <Route
          path="analytics"
          element={
            <RequirePermission permission={PERMISSIONS.VIEW_ANALYTICS}>
              <AnalyticsPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission permission={PERMISSIONS.MANAGE_USERS}>
              <UsersPage />
            </RequirePermission>
          }
        />
      </Route>

      <Route
        path="/admin/login"
        element={
          <RedirectIfSuperAdminAuthenticated>
            <SuperAdminLoginPage />
          </RedirectIfSuperAdminAuthenticated>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireSuperAdmin>
            <AdminLayout />
          </RequireSuperAdmin>
        }
      >
        <Route index element={<Navigate to="tenants" replace />} />
        <Route path="tenants" element={<AdminTenantsPage />} />
        <Route path="tenants/:id" element={<AdminTenantDetailPage />} />
        <Route path="analytics" element={<AdminAggregateAnalyticsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
