'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface ContactsContentProps {
  translations: {
    title: string;
    description: string;
    contact_title: string;
    phone: string;
    email: string;
    telegram: string;
    instagram: string;
    services_title: string;
    services: {
      ar_souvenirs: string;
      ar_vr_consulting: string;
      souvenir_design: string;
      workshops: string;
    };
  };
}

export default function ContactsContent({
  translations,
}: ContactsContentProps) {
  return (
    <div className="w-full flex flex-col">
      {/* Заголовок + картинка */}
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
            {translations.title}
          </motion.h1>
          <motion.p
            className="text-center md:text-start text-md md:text-lg font-normal text-muted-foreground max-w-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
          >
            {translations.description}
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
            alt={translations.title}
            width={400}
            height={400}
            className="rounded-2xl object-cover w-full max-w-xs h-auto"
            priority
          />
        </motion.div>
      </div>

      {/* Разделитель */}
      <hr className="mb-12 w-full border-muted-foreground" />

      {/* Контакты + Услуги */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 1 }}
      >
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center md:text-start">
            {translations.contact_title}
          </h2>
          <ul className="space-y-2 text-muted-foreground text-center md:text-start">
            <li>{translations.phone}</li>
            <li>{translations.email}</li>
            <li>{translations.telegram}</li>
            <li>{translations.instagram}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4 text-center md:text-start">
            {translations.services_title}
          </h2>
          <ul className="space-y-2 text-muted-foreground text-center md:text-start mb-12">
            <li>{translations.services.ar_souvenirs}</li>
            <li>{translations.services.ar_vr_consulting}</li>
            <li>{translations.services.souvenir_design}</li>
            <li>{translations.services.workshops}</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
