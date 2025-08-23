'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ExampleBlockSkeletonProps {
  reverse?: boolean;
  className?: string;
}

export const ExampleBlockSkeleton: React.FC<ExampleBlockSkeletonProps> = ({
  reverse = false,
  className,
}) => {
  return (
    <div className={cn('mx-4 md:mx-0', className)}>
      <div
        className={cn(
          'relative flex flex-col md:flex-row items-center justify-between md:w-full border rounded-lg shadow-md p-6 md:p-10',
          reverse ? 'md:flex-row-reverse' : ''
        )}
        style={{ backgroundColor: 'var(--color-border)' }}
      >
        {/* Текстовый блок */}
        <div className="flex flex-col items-center md:items-start justify-center md:w-2/3 gap-4 my-8">
          <Skeleton
            className="h-8 w-48"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <Skeleton
            className="h-6 w-64"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <Skeleton
            className="h-4 w-40"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
        </div>

        {/* Картинка товара */}
        <Skeleton
          className="w-60 h-60 md:w-72 md:h-72 rounded-md"
          style={{ backgroundColor: 'var(--color-border)' }}
        />
      </div>
    </div>
  );
};
