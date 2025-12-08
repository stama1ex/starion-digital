/* eslint-disable @typescript-eslint/no-explicit-any */
// store/cart-store.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Product {
  id: number;
  number: string;
  type: string;
  image: string | null;
  material: string;
  country: string;
}

export interface CartItem {
  id: number;
  number: string;
  type: string;
  image: string | null;
  quantity: number;
  price: number; // NEW
}

interface CartState {
  items: CartItem[];
  addItem: (
    product: (Product & { price?: number }) | any,
    quantity: number
  ) => void;
  removeItem: (id: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (product, quantity) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                id: product.id,
                number: product.number,
                type: product.type.toLowerCase(),
                image: product.image,
                quantity,
                price: product.price ?? 0, // NEW
              },
            ],
          };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
      version: 3,
      partialize: (state) => ({ items: state.items }),
    }
  )
);
