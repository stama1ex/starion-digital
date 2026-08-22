'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface PartnerCtx {
  isPartner: boolean;
  loading: boolean;
  address: string | null;
  isVip: boolean;
  isAdmin: boolean;
  hasEmail: boolean;
  showAdminPanelTitle: boolean;
  toggleAdminPanelTitle: () => void;
}

const PartnerContext = createContext<PartnerCtx>({
  isPartner: false,
  loading: true,
  address: null,
  isVip: false,
  isAdmin: false,
  hasEmail: true,
  showAdminPanelTitle: true,
  toggleAdminPanelTitle: () => {},
});

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);
  const [showAdminPanelTitle, setShowAdminPanelTitle] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        setIsPartner(data.isPartner);
        setAddress(data.address ?? null);
        setIsVip(!!data.isVip);
        setIsAdmin(
          data.role === 'ADMIN' ||
            data.role === 'PRODUCT_ADMIN' ||
            data.role === 'SUPER_ADMIN',
        );
        setHasEmail(!!data.hasEmail);
        setShowAdminPanelTitle(data.showAdminPanelTitle ?? true);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Мгновенно переключает видимость на экране и сохраняет настройку в
  // фоне - без ожидания ответа сервера и без перезагрузки страницы
  const toggleAdminPanelTitle = async () => {
    const next = !showAdminPanelTitle;
    setShowAdminPanelTitle(next);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showAdminPanelTitle: next }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (error) {
      console.error('Error saving admin panel title preference:', error);
      setShowAdminPanelTitle(!next);
    }
  };

  return (
    <PartnerContext.Provider
      value={{
        isPartner,
        loading,
        address,
        isVip,
        isAdmin,
        hasEmail,
        showAdminPanelTitle,
        toggleAdminPanelTitle,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export const usePartner = () => useContext(PartnerContext);
