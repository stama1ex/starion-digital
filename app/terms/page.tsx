import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import TermsContent from './terms-content';

// Define the params type explicitly
interface PageParams {
  locale: string;
}

// Metadata generation (server-side)
export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>; // Use Promise<PageParams>
}): Promise<Metadata> {
  const resolvedParams = await params; // Await the Promise
  const t = await getTranslations({
    locale: resolvedParams.locale,
    namespace: 'Terms',
  });
  return {
    title: `${t('title')} - Starion Digital`,
    description: t('meta.description'),
    keywords: [
      'Starion Digital terms of use',
      'AR souvenirs terms',
      'website terms',
      resolvedParams.locale === 'ru'
        ? 'Условия использования Starion Digital'
        : resolvedParams.locale === 'ro'
          ? 'Termeni de utilizare Starion Digital'
          : 'Starion Digital terms of use',
    ],
    openGraph: {
      title: `${t('title')} - Starion Digital`,
      description: t('meta.description'),
      url: `https://starion-digital.com/${resolvedParams.locale}/terms`,
      type: 'website',
      images: [
        {
          url: '/og-image-terms.jpg',
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
      images: ['/og-image-terms.jpg'],
    },
    alternates: {
      canonical: `https://starion-digital.com/${resolvedParams.locale}/terms`,
      languages: {
        ru: `https://starion-digital.com/ru/terms`,
        en: `https://starion-digital.com/en/terms`,
        ro: `https://starion-digital.com/ro/terms`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: t('title'),
        description: t('meta.description'),
        url: `https://starion-digital.com/${resolvedParams.locale}/terms`,
        publisher: {
          '@type': 'Organization',
          name: 'Starion Digital',
          url: 'https://starion-digital.com',
          logo: 'https://starion-digital.com/logo.png',
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+373 680 33 007',
            contactType: 'Customer Service',
            email: 'stamat2000@gmail.com',
          },
        },
      }),
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<PageParams>; // Use Promise<PageParams>
}) {
  const resolvedParams = await params; // Await the Promise
  const t = await getTranslations({
    locale: resolvedParams.locale,
    namespace: 'Terms',
  });

  const translations = {
    title: t('title'),
    introduction: t('introduction'),
    contact: t('contact'),
    lastUpdated: t('lastUpdated'),
    sections: [
      {
        id: 'useOfSite',
        title: t('useOfSite.title'),
        text: t('useOfSite.description'),
      },
      {
        id: 'intellectualProperty',
        title: t('intellectualProperty.title'),
        text: t('intellectualProperty.description'),
      },
      {
        id: 'prohibited',
        title: t('prohibited.title'),
        text: t('prohibited.description'),
        items: [
          t('prohibited.illegal'),
          t('prohibited.spam'),
          t('prohibited.copy'),
        ],
      },
      {
        id: 'limitations',
        title: t('limitations.title'),
        text: t('limitations.description'),
      },
      {
        id: 'governingLaw',
        title: t('governingLaw.title'),
        text: t('governingLaw.description'),
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
        <TermsContent translations={translations} />
      </Container>
    </main>
  );
}
