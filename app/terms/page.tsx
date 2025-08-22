'use client';

import { Container } from '@/components/shared/container';
import { useTranslations } from 'next-intl';
import { Title } from '@/components/shared/title';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  Shield,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
} from 'lucide-react';

export default function TermsPage() {
  const t = useTranslations('Terms');

  const sections = [
    {
      id: 'useOfSite',
      title: t('useOfSite.title'),
      text: t('useOfSite.description'),
      icon: <Globe className="w-6 h-6 text-primary" />,
    },
    {
      id: 'intellectualProperty',
      title: t('intellectualProperty.title'),
      text: t('intellectualProperty.description'),
      icon: <FileText className="w-6 h-6 text-primary" />,
    },
    {
      id: 'prohibited',
      title: t('prohibited.title'),
      text: t('prohibited.description'),
      icon: <Lock className="w-6 h-6 text-primary" />,
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
      icon: <AlertTriangle className="w-6 h-6 text-primary" />,
    },
    {
      id: 'governingLaw',
      title: t('governingLaw.title'),
      text: t('governingLaw.description'),
      icon: <Shield className="w-6 h-6 text-primary" />,
    },
    {
      id: 'changes',
      title: t('changes.title'),
      text: t('changes.description'),
      icon: <RefreshCw className="w-6 h-6 text-primary" />,
    },
  ];

  return (
    <main className="min-h-screen bg-background py-12 mx-4 md:mx-0">
      <Container className="max-w-4xl mx-auto">
        <Title
          text={t('title')}
          className="w-full !text-4xl font-bold mb-8 text-center animate-gradient-flow"
        />

        <p className="text-muted-foreground text-center mb-12">
          {t('introduction')}
        </p>

        <div className="space-y-8">
          {sections.map((section) => (
            <Card key={section.id} id={section.id} className="shadow-md">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {section.icon}
                  <h2 className="text-2xl font-semibold">{section.title}</h2>
                </div>
                <p className="text-muted-foreground">{section.text}</p>
                {section.items && (
                  <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          {t('contact')}
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('lastUpdated')}: 22 August 2025
        </p>
      </Container>
    </main>
  );
}
