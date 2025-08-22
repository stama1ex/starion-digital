// components/LandingDrawer.tsx
/* eslint-disable @next/next/no-img-element */
'use client';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getCategories } from '@/lib/categories';
import { Soon } from './shared/soon';
import { Box, Globe, WalletCards } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LandingDrawer() {
  const t = useTranslations('LandingDrawer');
  const tCategories = useTranslations('Categories');
  const categories = getCategories().map((category) => ({
    ...category,
    name: tCategories(`${category.nameKey}.name`),
  }));

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button className="mx-auto md:mx-0 cursor-pointer bg-primary text-background px-8 py-4 rounded-xl font-semibold shadow-lg hover:opacity-90 transition text-lg w-fit h-12">
          {t('view_souvenirs')}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold text-center">
            {t('title')}
          </DrawerTitle>
        </DrawerHeader>
        <DrawerFooter className="overflow-scroll md:overflow-auto">
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            {categories.map((category) => {
              const isSoon =
                category.id === 3 || category.id === 4 || category.id === 5;
              return (
                <Link
                  href={isSoon ? '#' : `/${category.type}s/catalog`} // Use English type
                  key={category.type}
                  className={isSoon ? 'pointer-events-none' : ''}
                  aria-disabled={isSoon ? 'true' : 'false'}
                  tabIndex={isSoon ? -1 : 0}
                >
                  <div
                    className={
                      'flex flex-col items-center justify-center p-4 rounded-lg shadow-md border min-w-[200px] h-auto ' +
                      (isSoon
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-lg hover:bg-popover/50 transition cursor-pointer')
                    }
                    role="button"
                    onKeyDown={(e) => {
                      if (!isSoon && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        window.location.href = `/${category.type}s/catalog`;
                      }
                    }}
                  >
                    {category.type === 'card' ? (
                      <WalletCards className="w-24 h-24 mb-2 text-primary" />
                    ) : category.type === 'statue' ? (
                      <Box className="w-24 h-24 mb-2 text-primary" />
                    ) : category.type === 'ball' ? (
                      <Globe className="w-24 h-24 mb-2 text-primary" />
                    ) : (
                      <img
                        src={
                          category.type === 'magnet'
                            ? `/magnets/01.avif`
                            : category.type === 'plate'
                              ? `/plates/110.avif`
                              : category.placeholder
                        }
                        alt={category.name}
                        className="w-24 h-24 object-contain mb-2"
                      />
                    )}
                    <span className="flex items-center text-lg font-medium text-primary">
                      {category.name}
                      {isSoon && <Soon className="ml-2" />}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="mt-4 w-full sm:w-32 mx-auto cursor-pointer"
            >
              {t('close')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
