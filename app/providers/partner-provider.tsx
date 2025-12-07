'use client';

import { createContext, useContext } from 'react';

interface PartnerContextType {
  isPartner: boolean;
}

const PartnerContext = createContext<PartnerContextType>({
  isPartner: false,
});

export function PartnerProvider({
  isPartner,
  children,
}: {
  isPartner: boolean;
  children: React.ReactNode;
}) {
  return (
    <PartnerContext.Provider value={{ isPartner }}>
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  return useContext(PartnerContext);
}
