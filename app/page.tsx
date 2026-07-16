// app/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/shared/container';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import HomeContent from './home-content';
import ArDemoSection from '@/components/ArDemoSection';

// Обновляем чаще, т.к. временная ссылка на 3D-модель от Dropbox недолговечна
export const revalidate = 300;

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params; // 👈 деструктурируем из промиса
  const t = await getTranslations({
    locale,
    namespace: 'HomePage',
  });

  return {
    title: `${t('meta.title')} | Starion Digital`,
    description: t('meta.description'),
    keywords: [
      'augmented reality souvenirs',
      'AR souvenirs',
      'Starion Digital',
      'custom souvenirs',
    ],
    openGraph: {
      title: `${t('meta.title')} | Starion Digital`,
      description: t('meta.description'),
      url: `https://starion-digital.com/${locale}`,
      images: [{ url: '/og-image-home.jpg', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://starion-digital.com/${locale}`,
      languages: {
        ru: `https://starion-digital.com/ru`,
        en: `https://starion-digital.com/en`,
        ro: `https://starion-digital.com/ro`,
      },
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
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
      }),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params; // 👈 ждём промис
  const t = await getTranslations({
    locale,
    namespace: 'HomePage',
  });

  const translations = {
    title: t('title'),
    description: t('description'),
    choose: t('choose'),
    categories: t.raw('categories') as string[],
  };

  const exampleProduct = await prisma.product.findFirst({
    where: { type: 'MAGNET', isHidden: false },
    orderBy: { number: 'asc' },
  });

  const modelUrl = exampleProduct ? await getModelUrl('magnet.glb') : '';

  return (
    <main className="min-h-screen bg-background">
      <div className="min-h-screen flex items-center mx-4 md:mx-0">
        <Container>
          <HomeContent translations={translations} />
        </Container>
      </div>

      {exampleProduct && modelUrl && (
        <div className="mx-4 md:mx-0 pb-16 md:pb-24">
          <Container>
            <ArDemoSection
              title={t('ar_demo_title')}
              subtitle={t('ar_demo_subtitle')}
              souvenir={{
                number: exampleProduct.number,
                image: exampleProduct.image,
                country: exampleProduct.country,
                type: 'magnet',
              }}
              modelUrl={modelUrl}
            />
          </Container>
        </div>
      )}
    </main>
  );
}
