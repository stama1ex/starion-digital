'use client';

import { Container } from './container';
import { Skeleton } from '@/components/ui/skeleton';

export const HeaderSkeleton = () => {
  return (
    <header className="border-b border-border sticky top-0 z-10 backdrop-blur-xl">
      <Container className="flex items-center justify-between py-4 sm:py-6 gap-4 relative">
        {/* Лого */}
        <Skeleton
          className="h-6 w-32 sm:h-8 sm:w-40"
          style={{ backgroundColor: 'var(--color-border)' }}
        />

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-4">
          <Skeleton
            className="h-6 w-12"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <Skeleton
            className="h-6 w-20"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <Skeleton
            className="h-6 w-20"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <Skeleton
            className="h-6 w-8"
            style={{ backgroundColor: 'var(--color-border)' }}
          />{' '}
          {/* language */}
          <Skeleton
            className="h-6 w-8"
            style={{ backgroundColor: 'var(--color-border)' }}
          />{' '}
          {/* theme toggle */}
        </div>

        {/* Burger Menu (mobile) */}
        <div className="sm:hidden">
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </Container>
    </header>
  );
};
