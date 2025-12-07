'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Souvenir } from '@/types';

export interface CartItem {
  number: string;
  type: string;
  image?: string | null;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Souvenir, quantity: number) => void;
  removeItem: (number: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (product, quantity) =>
        set((state) => {
          const existing = state.items.find((i) => i.number === product.number);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.number === product.number
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                number: product.number,
                type: product.type,
                image: product.image ?? null,
                quantity,
              },
            ],
          };
        }),

      removeItem: (number) =>
        set((state) => ({
          items: state.items.filter((i) => i.number !== number),
        })),

      clear: () => set({ items: [] }),
    }),

    {
      name: 'cart-storage', // <- ключ хранилища
      version: 1,
      partialize: (state) => ({ items: state.items }), // только корзина
    }
  )
);
