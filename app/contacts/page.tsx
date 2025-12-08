// app/contacts/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import ContactsContent from './contacts-content';

type PageProps = {
  params: Promise<{ locale: string }>;
};

// Metadata generation (server-side)
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'ContactsPage',
  });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: [
      'Yuri Stamat',
      'Starion Digital contact',
      'AR souvenirs',
      'AR/VR consulting',
      locale === 'ru'
        ? 'Контакты Starion Digital'
        : locale === 'ro'
        ? 'Contact Starion Digital'
        : 'Starion Digital contact',
    ],
    openGraph: {
      title: `${t('meta.title')} - Contact Starion Digital`,
      description: t('meta.description'),
      url: `https://starion-digital.com/${locale}/contacts`,
      images: [{ url: '/stamat-yuri.webp', width: 400, height: 400 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${locale}/contacts`,
      languages: {
        ru: `https://starion-digital.com/ru/contacts`,
        en: `https://starion-digital.com/en/contacts`,
        ro: `https://starion-digital.com/ro/contacts`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Yuri Stamat',
        jobTitle: 'Founder of Starion Digital',
        telephone: '+373 680 33 007',
        email: 'stamat2000@gmail.com',
        url: `https://starion-digital.com/${locale}/contacts`,
        sameAs: [
          'https://t.me/Viar_tech',
          'https://www.instagram.com/magnetar_souvenir',
        ],
      }),
    },
  };
}

export default async function ContactsPage({ params }: PageProps) {
  const { locale } = await params; // 👈 здесь тоже await
  const t = await getTranslations({
    locale,
    namespace: 'ContactsPage',
  });

  const translations = {
    title: t('title'),
    description: t('description'),
    contact_title: t('contact_title'),
    phone: t('phone'),
    email: t('email'),
    telegram: t('telegram'),
    instagram: t('instagram'),
    services_title: t('services_title'),
    services: {
      ar_souvenirs: t('services.ar_souvenirs'),
      ar_vr_consulting: t('services.ar_vr_consulting'),
      souvenir_design: t('services.souvenir_design'),
    },
  };

  return (
    <main className="min-h-screen flex items-center bg-background">
      <Container className="w-full">
        <ContactsContent translations={translations} />
      </Container>
    </main>
  );
}
