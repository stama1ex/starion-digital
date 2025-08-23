'use client';

import { motion } from 'framer-motion';
import { Title } from '@/components/shared/title';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import VantaFogBackground from '@/components/ui/vanta-background';
import { HomeIcon } from 'lucide-react';

interface NotFoundContentProps {
  translations: {
    title: string;
    description: string;
    home_button: string;
  };
}

export default function NotFoundContent({
  translations,
}: NotFoundContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <Title
        text={translations.title}
        className="w-full !text-4xl md:!text-6xl font-extrabold mb-8 animate-gradient-flow"
      />
      <motion.p
        className="text-md md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      >
        {translations.description}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
      >
        <Link href="/">
          <Button
            variant="default"
            size="lg"
            className="flex items-center gap-2 mx-auto cursor-pointer"
          >
            <HomeIcon className="w-5 h-5" />
            {translations.home_button}
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
