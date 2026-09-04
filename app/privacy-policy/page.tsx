import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { SITE_URL } from '@/lib/site';
import { Container } from '@/components/shared/container';
import PrivacyPolicyContent from './privacy-policy-content';

// Metadata generation (server-side)
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: 'PrivacyPolicy',
  });
  return {
    title: `${t('title')} - Starion Digital`,
    description: t('meta.description'),
    keywords: [
      'Starion Digital privacy policy',
      'AR souvenirs privacy',
      'data protection',
      'website privacy policy',
      locale === 'ru'
        ? 'Политика конфиденциальности Starion Digital'
        : locale === 'ro'
          ? 'Politica de confidențialitate Starion Digital'
          : 'Starion Digital privacy policy',
    ],
    openGraph: {
      title: `${t('title')} - Starion Digital`,
      description: t('meta.description'),
      url: `${SITE_URL}/privacy-policy`,
      type: 'website',
      images: [
        {
          url: '/og-image-privacy.jpg',
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('title')} - Starion Digital`,
      description: t('meta.description'),
      images: ['/og-image-privacy.jpg'],
    },
    alternates: {
      canonical: `${SITE_URL}/privacy-policy`,
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: t('title'),
        description: t('meta.description'),
        url: `${SITE_URL}/privacy-policy`,
        publisher: {
          '@type': 'Organization',
          name: 'Starion Digital',
          url: SITE_URL,
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+373 680 33 007',
            contactType: 'Customer Service',
            email: 'info@stariondigital.com',
          },
        },
      }),
    },
  };
}

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: 'PrivacyPolicy',
  });

  const translations = {
    title: t('title'),
    introduction: t('introduction'),
    contact: t('contact'),
    lastUpdated: t('lastUpdated'),
    sections: [
      {
        id: 'dataCollection',
        title: t('dataCollection.title'),
        text: t('dataCollection.description'),
        items: [
          t('dataCollection.cookies'),
          t('dataCollection.usageData'),
          t('dataCollection.contactData'),
        ],
      },
      {
        id: 'dataUsage',
        title: t('dataUsage.title'),
        text: t('dataUsage.description'),
      },
      {
        id: 'dataSharing',
        title: t('dataSharing.title'),
        text: t('dataSharing.description'),
      },
      {
        id: 'dataStorage',
        title: t('dataStorage.title'),
        text: t('dataStorage.description'),
      },
      {
        id: 'userRights',
        title: t('userRights.title'),
        text: t('userRights.description'),
      },
      {
        id: 'changes',
        title: t('changes.title'),
        text: t('changes.description'),
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background py-12 px-4 md:px-0">
      <Container className="max-w-4xl mx-auto">
        <PrivacyPolicyContent translations={translations} />
      </Container>
    </main>
  );
}
