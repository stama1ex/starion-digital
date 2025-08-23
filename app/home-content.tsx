// app/home-content.tsx
'use client';

import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import LandingDrawer from '@/components/LandingDrawer';
import LandingCarousel from '@/components/LandingCarousel';

interface HomeContentProps {
  translations: {
    title: string;
    description: string;
    choose: string;
    categories: string[];
  };
}

export default function HomeContent({ translations }: HomeContentProps) {
  return (
    <div className="flex flex-col md:flex-row gap-16 items-center w-full max-w-full">
      {/* Left side: Text + Button */}
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
          {translations.title}
          <span className="animate-gradient-flow !my-0">Starion Digital</span>
        </motion.h1>

        <motion.p
          className="text-center md:text-start text-md md:text-lg text-muted-foreground max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 }}
        >
          {translations.description}
        </motion.p>

        <motion.p
          className="text-center md:text-start text-md md:text-lg text-muted-foreground max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.6 }}
        >
          {translations.choose}{' '}
          <TypeAnimation
            sequence={translations.categories.flatMap((category) => [
              category,
              2000, // Задержка 2 секунды перед сменой
            ])}
            wrapper="span"
            speed={50}
            repeat={Infinity}
            className="font-bold text-primary"
          />
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.8 }}
          className="flex justify-center md:justify-start"
        >
          <LandingDrawer />
        </motion.div>
      </motion.div>

      {/* Right side: Carousel */}
      <motion.div
        className="flex-1 w-full max-w-xl mx-auto"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'backOut', delay: 0.6 }}
      >
        <LandingCarousel />
      </motion.div>
    </div>
  );
}
