'use client';

import { Container } from '@/components/shared/container';
import LandingDrawer from '@/components/LandingDrawer';
import LandingCarousel from '@/components/LandingCarousel';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('HomePage'); // ✅ указываем namespace HomePage

  return (
    <main className="min-h-screen flex items-center bg-background mx-4 md:mx-0">
      <Container>
        <div className="flex flex-col md:flex-row gap-16 items-center w-full max-w-full">
          {/* Левая часть: текст + кнопка */}
          <motion.div
            className="flex-1 flex flex-col gap-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <motion.h1
              className="text-4xl mt-12 text-center md:text-start md:mt-0 md:text-6xl font-extrabold leading-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            >
              {t('title')}
              <span className="animate-gradient-flow">Starion Digital</span>
            </motion.h1>

            <motion.p
              className="text-center md:text-start text-md md:text-lg text-muted-foreground max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 }}
            >
              {t('description')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
              className="flex justify-center md:justify-start"
            >
              <LandingDrawer />
            </motion.div>
          </motion.div>

          {/* Правая часть: карусель */}
          <motion.div
            className="flex-1 w-full max-w-xl mx-auto"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'backOut', delay: 0.6 }}
          >
            <LandingCarousel />
          </motion.div>
        </div>
      </Container>
    </main>
  );
}
