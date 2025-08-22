'use client';

import { Container } from '@/components/shared/container';
import { useTranslations } from 'next-intl';
import { Title } from '@/components/shared/title';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  User,
  FileText,
  RefreshCw,
  Mail,
  Database,
} from 'lucide-react';

export default function PrivacyPolicyPage() {
  const t = useTranslations('PrivacyPolicy');

  const sections = [
    {
      id: 'dataCollection',
      title: t('dataCollection.title'),
      text: t('dataCollection.description'),
      icon: <Database className="w-6 h-6 text-primary" />,
      items: [
        t('dataCollection.cookies'),
        t('dataCollection.usageData'),
        t('dataCollection.contactData'),
      ],
    },
    {
      id: 'dataUsage',
      title: t('dataUsage.title'),
      text: t('dataUsage.description'),
      icon: <Shield className="w-6 h-6 text-primary" />,
    },
    {
      id: 'dataSharing',
      title: t('dataSharing.title'),
      text: t('dataSharing.description'),
      icon: <FileText className="w-6 h-6 text-primary" />,
    },
    {
      id: 'dataStorage',
      title: t('dataStorage.title'),
      text: t('dataStorage.description'),
      icon: <User className="w-6 h-6 text-primary" />,
    },
    {
      id: 'userRights',
      title: t('userRights.title'),
      text: t('userRights.description'),
      icon: <User className="w-6 h-6 text-primary" />,
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

        <div className="space-y-8 ">
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
          {t('contact')} <Mail className="inline w-4 h-4 ml-1" />
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('lastUpdated')}: 22 August 2025
        </p>
      </Container>
    </main>
  );
}
