# Admin Panel Modularization

## Overview

Refactored the admin panel to use shared modules, reducing code duplication and improving maintainability.

## New Module Structure

### `/lib/admin/`

Centralized admin utilities and shared code.

#### `constants.ts`

- **Order Status**: `OrderStatusType`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_COLORS`
- **Product Types**: `PRODUCT_TYPES`, `PRODUCT_TYPE_LABELS`, `PRODUCT_TYPE_LABELS_PLURAL`

#### `api-client.ts`

- Generic API utilities: `fetchData`, `postData`, `putData`, `deleteData`
- **AdminAPI** object with methods:
  - Partners: `getPartners`, `createPartner`, `updatePartner`, `deletePartner`
  - Products: `getProducts`, `createProduct`, `updateProduct`, `deleteProduct`
  - Groups: `getGroups`, `createGroup`, `updateGroup`, `deleteGroup`
  - Orders: `getOrders`, `updateOrderStatus`, `deleteOrder`, `createOrder`
  - Prices: `getPrices`, `updatePrices`
  - User: `getCurrentUser`

#### `hooks.ts`

Custom React hooks for data fetching:

- `usePartners(excludeAdmin?)` - Fetch partners list
- `useProducts()` - Fetch products list
- `useGroups()` - Fetch product groups
- `useCurrentUser()` - Fetch current logged-in user

All hooks return: `{ data, loading, error, refetch }`

#### `helpers.ts`

Utility functions:

- `getProductTypeLabel(type)` - Get localized product type name
- `formatPrice(price)` - Format price with MDL currency
- `formatDate(date)` - Format date in Russian locale
- `filterBySearchQuery(items, query, fields)` - Generic search filter
- `groupBy(array, keyGetter)` - Group array by key
- `downloadBlob(blob, filename)` - Download file helper
- `handleApiError(error)` - Extract error message from various error formats

#### `index.ts`

Barrel export for convenient imports: `export * from './constants'` etc.

## Refactored Components

### `products-management.tsx`

**Before**: 80+ lines of fetch logic
**After**:

```tsx
import {
  useProducts,
  useGroups,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  AdminAPI,
  handleApiError,
} from '@/lib/admin';

const { products, loading, refetch } = useProducts();
const { groups } = useGroups();
```

**Benefits**:

- Removed `fetchProducts()` and `fetchGroups()` functions
- Simplified error handling with `handleApiError`
- Type-safe product type labels from constants

### `orders-management.tsx`

**Before**: Duplicate fetch functions, manual status colors/labels
**After**:

```tsx
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatusType,
  AdminAPI,
  usePartners,
  useProducts,
  formatDate,
} from '@/lib/admin';

const { partners } = usePartners(true);
const { products } = useProducts();
```

**Benefits**:

- Removed 40+ lines of fetch code
- Consistent status colors and labels
- Date formatting helper

### `partners-management.tsx`

**Before**: Manual partner and user fetching
**After**:

```tsx
import {
  usePartners,
  useCurrentUser,
  AdminAPI,
  handleApiError,
} from '@/lib/admin';

const { partners, loading, refetch } = usePartners(true);
const { user } = useCurrentUser();
```

**Benefits**:

- Automatic ADMIN partner filtering
- Current user context available
- Simplified CRUD operations

### `groups-management.tsx`

**Before**: Manual fetch and grouping logic
**After**:

```tsx
import {
  useGroups,
  AdminAPI,
  handleApiError,
  PRODUCT_TYPE_LABELS_PLURAL,
  groupBy,
} from '@/lib/admin';

const { groups, refetch } = useGroups();
const groupedByType = groupBy(groups, (group) => group.type);
```

**Benefits**:

- Reusable `groupBy` helper
- Consistent product type labels
- Cleaner error handling

## Code Reduction

| Component               | Before     | After      | Reduction |
| ----------------------- | ---------- | ---------- | --------- |
| products-management.tsx | ~530 lines | ~470 lines | ~60 lines |
| orders-management.tsx   | ~580 lines | ~520 lines | ~60 lines |
| partners-management.tsx | ~286 lines | ~240 lines | ~46 lines |
| groups-management.tsx   | ~260 lines | ~220 lines | ~40 lines |

**Total**: ~200 lines of duplicated code removed

## Usage Examples

### Fetching data with hooks

```tsx
function MyComponent() {
  const { products, loading, error, refetch } = useProducts();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{products.map(...)}</div>;
}
```

### API calls

```tsx
async function handleCreate() {
  try {
    await AdminAPI.createProduct(data);
    alert('Success!');
  } catch (error) {
    const message = await handleApiError(error);
    alert(`Error: ${message}`);
  }
}
```

### Using constants

```tsx
<Select>
  {PRODUCT_TYPES.map((type) => (
    <SelectItem value={type}>{PRODUCT_TYPE_LABELS[type]}</SelectItem>
  ))}
</Select>
```

## Future Improvements

1. **Type safety**: Add proper TypeScript interfaces for all API responses
2. **Error boundary**: Implement global error handling for hooks
3. **Caching**: Add React Query or SWR for better data caching
4. **Loading states**: Create shared loading skeleton components
5. **Form validation**: Extract common validation logic
6. **Pagination**: Add pagination helpers for large datasets
7. **Optimistic updates**: Implement optimistic UI updates

## Migration Guide

To use the new modules in existing components:

1. Replace imports:

```tsx
// Old
import { useState, useEffect } from 'react';

// New
import { useProducts, PRODUCT_TYPES, AdminAPI } from '@/lib/admin';
```

2. Replace fetch logic:

```tsx
// Old
const [products, setProducts] = useState([]);
useEffect(() => {
  async function fetch() {
    const res = await fetch('/api/admin/products');
    const data = await res.json();
    setProducts(data);
  }
  fetch();
}, []);

// New
const { products, refetch } = useProducts();
```

3. Replace API calls:

```tsx
// Old
const res = await fetch('/api/admin/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// New
await AdminAPI.createProduct(data);
```

4. Use shared constants:

```tsx
// Old
const types = ['MAGNET', 'PLATE', 'POSTCARD'];

// New
import { PRODUCT_TYPES } from '@/lib/admin';
```
