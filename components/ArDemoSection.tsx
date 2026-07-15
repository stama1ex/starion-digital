// components/ArDemoSection.tsx
'use client';

import { motion } from 'framer-motion';
import ExampleBlock from '@/components/shared/example-block';

interface ArDemoSectionProps {
  title: string;
  subtitle: string;
  souvenir: {
    number: string;
    image: string;
    country: string;
    type: string;
  };
  modelUrl: string;
}

export default function ArDemoSection({
  title,
  subtitle,
  souvenir,
  modelUrl,
}: ArDemoSectionProps) {
  return (
    <div className="w-full">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <h2 className="text-3xl md:text-4xl font-extrabold">{title}</h2>
        <p className="mt-3 text-muted-foreground text-md md:text-lg max-w-2xl mx-auto">
          {subtitle}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
      >
        <ExampleBlock souvenir={souvenir} modelUrl={modelUrl} />
      </motion.div>
    </div>
  );
}
