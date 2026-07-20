'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface PartnerCtx {
  isPartner: boolean;
  loading: boolean;
  address: string | null;
  isVip: boolean;
  isAdmin: boolean;
  hasEmail: boolean;
}

const PartnerContext = createContext<PartnerCtx>({
  isPartner: false,
  loading: true,
  address: null,
  isVip: false,
  isAdmin: false,
  hasEmail: true,
});

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasEmail, setHasEmail] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        setIsPartner(data.isPartner);
        setAddress(data.address ?? null);
        setIsVip(!!data.isVip);
        setIsAdmin(data.role === 'ADMIN' || data.role === 'SUPER_ADMIN');
        setHasEmail(!!data.hasEmail);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  return (
    <PartnerContext.Provider
      value={{ isPartner, loading, address, isVip, isAdmin, hasEmail }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export const usePartner = () => useContext(PartnerContext);
