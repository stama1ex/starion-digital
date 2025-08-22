'use client';

import { Container } from '@/components/shared/container';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export default function ContactsPage() {
  const t = useTranslations('ContactsPage');

  return (
    <main className="min-h-screen flex items-center bg-background">
      <Container className="w-full">
        <div className="flex flex-col md:flex-row gap-16 items-center w-full">
          <motion.div
            className="flex-1 flex flex-col gap-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <motion.h1
              className="text-4xl mt-12 text-center md:text-start md:mt-0 md:text-6xl font-extrabold leading-tight animate-gradient-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            >
              {t('title')}
            </motion.h1>
            <motion.p
              className="text-center md:text-start text-md md:text-lg font-normal text-muted-foreground max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
            >
              {t('description')}
            </motion.p>
          </motion.div>

          <motion.div
            className="flex-1 w-full max-w-xl mx-auto flex justify-center"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
          >
            <Image
              src="/stamat-yuri.webp"
              alt={t('title')}
              width={400}
              height={400}
              className="rounded-2xl object-cover w-full max-w-xs h-auto"
              priority
            />
          </motion.div>
        </div>

        <hr className="mb-12" />

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut', delay: 1 }}
        >
          <div>
            <h2 className="text-2xl font-bold mb-4 text-center md:text-start">
              {t('contact_title')}
            </h2>
            <ul className="space-y-2 text-muted-foreground text-center md:text-start">
              <li>{t('phone')}</li>
              <li>{t('email')}</li>
              <li>{t('telegram')}</li>
              <li>{t('instagram')}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 text-center md:text-start">
              {t('services_title')}
            </h2>
            <ul className="space-y-2 text-muted-foreground text-center md:text-start mb-12">
              <li>{t('services.ar_souvenirs')}</li>
              <li>{t('services.ar_vr_consulting')}</li>
              <li>{t('services.souvenir_design')}</li>
              <li>{t('services.workshops')}</li>
            </ul>
          </div>
        </motion.div>
      </Container>
    </main>
  );
}
