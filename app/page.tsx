// app/page.tsx
import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { SITE_URL, SITE_NAME } from '@/lib/site';
import { Container } from '@/components/shared/container';
import { prisma } from '@/lib/db';
import { getModelUrl } from '@/lib/models';
import HomeContent from './home-content';
import ArDemoSection from '@/components/ArDemoSection';

// Обновляем чаще, т.к. временная ссылка на 3D-модель от Dropbox недолговечна
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
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
      url: SITE_URL,
      images: [{ url: '/og-image-home.jpg', width: 1200, height: 630 }],
    },
    // Языковых версий по разным адресам нет: локаль хранится в куке, префикса
    // в маршруте не существует — поэтому и alternates.languages здесь не место.
    alternates: {
      canonical: SITE_URL,
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
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

export default async function Page() {
  const locale = await getLocale();
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
