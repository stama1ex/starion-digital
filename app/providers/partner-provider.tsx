'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface PartnerCtx {
  isPartner: boolean;
  loading: boolean;
}

const PartnerContext = createContext<PartnerCtx>({
  isPartner: false,
  loading: true,
});

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        setIsPartner(data.isPartner);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  return (
    <PartnerContext.Provider value={{ isPartner, loading }}>
      {children}
    </PartnerContext.Provider>
  );
}

export const usePartner = () => useContext(PartnerContext);
