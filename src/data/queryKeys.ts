/**
 * Every cache key in one place, so invalidating "everything about products" after a write is one
 * prefix rather than a hunt for string literals. Keys are hierarchical: `['products']` covers the
 * list, every detail, history and supplier lines.
 */
export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (params: unknown) => ['products', 'list', params] as const,
    detail: (id: string | undefined) => ['products', 'detail', id] as const,
    history: (id: string | undefined, page: number) => ['products', 'history', id, page] as const,
    vendors: (id: string | undefined) => ['products', 'vendors', id] as const,
    lowStock: ['products', 'low-stock'] as const,
  },
  unitsOfMeasure: ['units-of-measure'] as const,
  categories: ['categories'] as const,
  vendors: {
    all: ['vendors'] as const,
    list: (params: unknown) => ['vendors', 'list', params] as const,
    options: ['vendors', 'options'] as const,
    detail: (id: string | undefined) => ['vendors', 'detail', id] as const,
  },
  expected: {
    all: ['expected'] as const,
    list: (status: string | undefined, page: number, size: number) => ['expected', 'list', status, page, size] as const,
    detail: (id: string | null) => ['expected', 'detail', id] as const,
  },
  stockMovements: {
    all: ['stock-movements'] as const,
    list: (params: unknown) => ['stock-movements', 'list', params] as const,
    summary: (filters: unknown) => ['stock-movements', 'summary', filters] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    summary: (params: unknown) => ['analytics', 'summary', params] as const,
    movements: (params: unknown) => ['analytics', 'movements', params] as const,
    topProducts: (params: unknown) => ['analytics', 'top-products', params] as const,
  },
}
