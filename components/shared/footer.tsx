// components/shared/footer.tsx
'use client';
import React from 'react';
import { FaFacebook, FaInstagram, FaLinkedin, FaTwitter } from 'react-icons/fa';
import { Container } from './container';
import { Soon } from './soon';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface FooterProps {
  logo?: {
    url: string;
    src: string;
    alt: string;
    title: string;
  };
  description?: string;
  socialLinks?: Array<{
    icon: React.ReactElement;
    href: string;
    label: string;
  }>;
  legalLinks?: Array<{
    name: string;
    href: string;
  }>;
}

const defaultLogo = {
  url: '/',
  src: '/logo.svg',
  alt: 'logo',
  title: 'Starion Digital',
};

const defaultSocialLinks = [
  { icon: <FaInstagram className="size-5" />, href: '#', label: 'Instagram' },
  { icon: <FaFacebook className="size-5" />, href: '#', label: 'Facebook' },
  { icon: <FaTwitter className="size-5" />, href: '#', label: 'Twitter' },
  { icon: <FaLinkedin className="size-5" />, href: '#', label: 'LinkedIn' },
];

const defaultLegalLinks = [
  { name: 'Terms and Conditions', href: '#' },
  { name: 'Privacy Policy', href: '#' },
];

const Footer: React.FC<FooterProps> = ({
  logo = defaultLogo,
  description = '',
  socialLinks = defaultSocialLinks,
  legalLinks = defaultLegalLinks,
}) => {
  const t = useTranslations('Footer');
  const tCategories = useTranslations('Categories');

  const sections = [
    {
      title: t('product'),
      links: [
        { id: 1, name: tCategories('magnet.name'), href: '/magnets/catalog' },
        { id: 2, name: tCategories('plate.name'), href: '/plates/catalog' },
        { id: 3, name: tCategories('card.name'), href: '#' },
        { id: 4, name: tCategories('statue.name'), href: '#' },
        { id: 5, name: tCategories('ball.name'), href: '#' },
      ],
    },
    {
      title: t('company'),
      links: [{ id: 6, name: t('contacts'), href: '/contacts' }],
    },
  ];

  return (
    <footer className="w-full bg-background border-t pt-10">
      <Container>
        <div className="flex w-full flex-col justify-between gap-10 lg:flex-row lg:items-start lg:text-left">
          <div className="flex w-full flex-col justify-between gap-6 items-center lg:items-start">
            <Link href="/">
              <div className="flex items-center gap-2">
                {/* <a href={logo.url} aria-label={logo.title}>
                <img
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.title}
                  className="h-8"
                />
              </a> */}
                <h2 className="text-xl font-semibold">{logo.title}</h2>
              </div>
            </Link>
            <p className="text-muted-foreground text-sm text-center lg:text-left">
              {description}
            </p>
            <ul className="text-muted-foreground flex items-center space-x-6">
              {socialLinks.map((social, idx) => (
                <li key={idx} className="hover:text-primary font-medium">
                  <a
                    href={social.href}
                    aria-label={social.label}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid w-full gap-6 md:grid-cols-2 lg:gap-20">
            {sections.map((section, sectionIdx) => (
              <div
                key={sectionIdx}
                className="flex flex-col items-center md:items-start"
              >
                <h3 className="mb-4 font-bold">{section.title}</h3>
                <ul className="text-muted-foreground space-y-3 text-sm text-center md:text-start">
                  {section.links.map((link, linkIdx) => {
                    const isSoon = link.id && [3, 4, 5].includes(link.id);
                    return (
                      <li
                        key={link.id || linkIdx}
                        className={
                          isSoon
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:text-primary font-medium'
                        }
                      >
                        <a
                          href={isSoon ? '#' : link.href}
                          tabIndex={isSoon ? -1 : 0}
                          aria-disabled={isSoon ? 'true' : 'false'}
                          className={isSoon ? 'pointer-events-none' : ''}
                        >
                          {link.name}
                          {isSoon && <Soon className="ml-2" />}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="text-muted-foreground mt-8 flex flex-col justify-between gap-4 border-t py-8 text-xs font-medium md:flex-row md:items-center md:gap-4">
          <p className="order-2 md:order-1 mx-auto">{t('copyright')}</p>
        </div>
      </Container>
    </footer>
  );
};

export { Footer };
