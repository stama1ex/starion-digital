'use client';

import { cn } from '@/lib/utils';
import { Container } from './container';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Globe, Menu } from 'lucide-react';
import * as React from 'react';
import { ThemeToggleButton } from './theme-toggle-button';
import ReactCountryFlag from 'react-country-flag';
import { Soon } from './soon';
import { DialogTitle } from '../ui/dialog';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocaleStore } from '@/store/useLocaleStore';
import { HeaderSkeleton } from './header-skeleton';
import CartDrawer from './cart-drawer';
import { toast } from 'sonner';
import { usePartner } from '@/app/providers/partner-provider';

interface Props {
  className?: string;
}

const categories = [
  { title: 'magnet', href: '/magnets/catalog' },
  { title: 'plate', href: '/plates/catalog' },
  { title: 'card', href: '/cards/catalog' },
  { title: 'statue', href: '#' },
  { title: 'ball', href: '#' },
];

const languages = [
  { full: 'Русский', short: 'ru' },
  { full: 'English', short: 'en' },
  { full: 'Română', short: 'ro' },
];

export const Header: React.FC<Props> = ({ className }) => {
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const t = useTranslations('Header');
  const tCategories = useTranslations('Categories');
  const setLocale = useLocaleStore((state) => state.setLocale);

  const { isPartner } = usePartner();

  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <HeaderSkeleton />;

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('cart-storage');
    window.location.reload();
    toast.success('Вы вышли');
  };

  const isActive = (href: string) => {
    // Remove locale prefix (e.g., /en, /ru) from pathname for comparison
    const normalizedPathname = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
    // Handle root path
    if (href === '/') {
      return normalizedPathname === '/' || normalizedPathname === '';
    }
    // Check if the current pathname starts with the href or matches it
    return (
      normalizedPathname === href || normalizedPathname.startsWith(href + '/')
    );
  };

  const changeLocale = (newLocale: string) => {
    setLocale(newLocale);
    window.location.reload();
  };

  // Check if any category is active to highlight the Categories trigger
  const isAnyCategoryActive = categories.some((item) => isActive(item.href));

  return (
    <header
      className={cn(
        'border-b border-border sticky top-0 z-10 backdrop-blur-xl',
        className
      )}
    >
      <Container className="flex items-center justify-between py-4 sm:py-6 gap-4 relative">
        {/* Logo */}
        <div className="relative flex items-center justify-between w-full sm:w-auto">
          <Link href="/" className="hidden sm:flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl uppercase font-black text-foreground">
              {t('logo')}
            </h1>
          </Link>
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 sm:hidden flex items-center gap-2"
          >
            <h1 className="text-lg uppercase font-black text-foreground">
              {t('logo')}
            </h1>
          </Link>

          {/* Burger Menu for Mobile */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden ml-auto mr-3 text-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={t('open_menu')}
              >
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[80vw] max-w-[400px] h-full rounded-none bg-background text-card-foreground overflow-scroll"
            >
              <DialogTitle className="hidden">{t('menu')}</DialogTitle>
              <div className="flex flex-col gap-4 p-4 mt-4">
                {/* Home link */}
                <Link
                  href="/"
                  className={cn(
                    'font-semibold text-lg',
                    isActive('/') && 'text-primary font-bold'
                  )}
                >
                  {t('home')}
                </Link>

                {/* Categories */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="categories">
                    <AccordionTrigger
                      className={cn(
                        'font-semibold text-lg',
                        isAnyCategoryActive && 'text-primary font-bold'
                      )}
                    >
                      {t('categories')}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="flex flex-col first:border-t">
                        {categories.map((item, idx) => {
                          const isSoon = idx >= 2;
                          return (
                            <li key={item.title}>
                              <Link
                                href={isSoon ? '#' : item.href}
                                className={cn(
                                  'block p-2 hover:bg-accent border-b',
                                  isSoon &&
                                    'pointer-events-none opacity-50 cursor-not-allowed',
                                  isActive(item.href) &&
                                    'text-primary font-bold'
                                )}
                              >
                                <div className="font-bold my-1 flex items-center gap-2">
                                  {tCategories(`${item.title}.name`)}
                                  {isSoon && <Soon />}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {tCategories(`${item.title}.description`)}
                                </p>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Contacts */}
                <Link
                  href="/contacts"
                  className={cn(
                    'font-semibold text-lg',
                    isActive('/contacts') && 'text-primary font-bold'
                  )}
                >
                  {t('contacts')}
                </Link>

                {/* Languages */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="languages">
                    <AccordionTrigger className="font-semibold text-lg">
                      {t('language')}
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="flex flex-col first:border-t">
                        {languages.map((lang) => (
                          <li key={lang.short}>
                            <button
                              onClick={() => changeLocale(lang.short)}
                              className="block px-2 py-4 hover:bg-accent border-b w-full text-left"
                            >
                              <div className="flex items-center font-medium">
                                <ReactCountryFlag
                                  countryCode={
                                    lang.short === 'en' ? 'us' : lang.short
                                  }
                                  svg
                                  className="mr-2"
                                />
                                {lang.full}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Theme toggle */}
                <div className="flex justify-start">
                  <ThemeToggleButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              {/* Home */}
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    isActive('/') && 'text-primary font-bold'
                  )}
                >
                  <Link href="/" className="font-semibold bg-transparent">
                    {t('home')}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Categories */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    'font-semibold bg-transparent transition-colors duration-200',
                    isAnyCategoryActive && 'text-primary font-bold'
                  )}
                >
                  {t('categories')}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background/70 backdrop-blur-xl border border-border rounded-md shadow-lg">
                  <ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px] p-2">
                    {categories.map((item, idx) => {
                      const isSoon = idx >= 2;
                      return (
                        <li key={item.title}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={isSoon ? '#' : item.href}
                              className={cn(
                                'block rounded-md p-3 bg-transparent transition-colors duration-200',
                                isSoon &&
                                  'pointer-events-none opacity-50 cursor-not-allowed',
                                isActive(item.href) &&
                                  'bg-accent text-primary font-bold'
                              )}
                            >
                              <div className="font-[950] text-primary flex items-center gap-2">
                                {tCategories(`${item.title}.name`)}
                                {isSoon && <Soon />}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {tCategories(`${item.title}.description`)}
                              </p>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      );
                    })}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Contacts */}
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    isActive('/contacts') && 'text-primary font-bold'
                  )}
                >
                  <Link
                    href="/contacts"
                    className="font-semibold bg-transparent"
                  >
                    {t('contacts')}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {/* Languages */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent transition-colors duration-200">
                  <Globe className="mr-2 h-4 w-4" />
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[100px] gap-2">
                    {languages.map((lang) => (
                      <li key={lang.short}>
                        <NavigationMenuLink asChild>
                          <button
                            onClick={() => changeLocale(lang.short)}
                            className="block rounded-md p-2 hover:bg-accent w-full text-left"
                          >
                            <div className="flex items-center font-medium">
                              <ReactCountryFlag
                                countryCode={
                                  lang.short === 'en' ? 'us' : lang.short
                                }
                                svg
                                className="mr-2"
                              />
                              {lang.full}
                            </div>
                          </button>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Theme toggle */}
              <NavigationMenuItem>
                <ThemeToggleButton />
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {isPartner && <CartDrawer />}
          {isPartner ? (
            <Button variant="outline" onClick={logout}>
              Выйти
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="outline">Я партнёр</Button>
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
};
