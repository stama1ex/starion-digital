// store/useLocaleStore.ts
import { create } from 'zustand';

interface LocaleState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'ru',
  setLocale: (locale) => {
    set({ locale });
    // сохраняем в cookie, чтобы сервер видел
    document.cookie = `locale=${locale}; path=/; max-age=31536000`;
  },
}));
