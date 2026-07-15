/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Generic API client utilities for admin panel
 */

export async function fetchData<T>(endpoint: string): Promise<T> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}`);
  }
  return res.json();
}

export async function postData<T>(endpoint: string, data: any): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to post to ${endpoint}`);
  }

  return res.json();
}

export async function putData<T>(endpoint: string, data: any): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to update ${endpoint}`);
  }

  return res.json();
}

export async function deleteData(endpoint: string): Promise<void> {
  const res = await fetch(endpoint, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to delete from ${endpoint}`);
  }
}

/**
 * Specific API endpoints
 */

export const AdminAPI = {
  // Partners
  getPartners: () => fetchData<any[]>('/api/admin/partners'),
  createPartner: (data: any) => postData('/api/admin/partners', data),
  updatePartner: (data: any) => putData('/api/admin/partners', data),
  deletePartner: (id: number) => deleteData(`/api/admin/partners?id=${id}`),

  // Products
  getProducts: () => fetchData<any[]>('/api/admin/products'),
  createProduct: (data: any) => postData('/api/admin/products', data),
  updateProduct: (data: any) => putData('/api/admin/products', data),
  deleteProduct: (id: number) => deleteData(`/api/admin/products?id=${id}`),

  // Groups
  getGroups: () => fetchData<any[]>('/api/admin/groups'),
  createGroup: (data: any) => postData('/api/admin/groups', data),
  updateGroup: (data: any) => putData('/api/admin/groups', data),
  deleteGroup: (id: number) => deleteData(`/api/admin/groups?id=${id}`),

  // Orders
  getOrders: () => fetchData<any[]>('/api/admin/orders'),
  updateOrderStatus: (data: { orderId: number; status: string }) =>
    putData('/api/admin/orders', data),
  deleteOrder: (orderId: number) =>
    deleteData(`/api/admin/orders?orderId=${orderId}`),
  createOrder: (data: any) => postData('/api/admin/create-order', data),

  // Prices
  getPrices: (partnerId: number) =>
    fetchData<any[]>(`/api/admin/prices?partnerId=${partnerId}`),
  updatePrices: (data: any) => putData('/api/admin/prices', data),

  // Current user
  getCurrentUser: () => fetchData<any>('/api/me'),
};
