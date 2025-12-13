'use client';

import { Title } from '@/components/shared/title';
import { Card, CardContent } from '@/components/ui/card';
import {
  Database,
  Shield,
  FileText,
  User,
  RefreshCw,
  Mail,
} from 'lucide-react';

interface PrivacyPolicyContentProps {
  translations: {
    title: string;
    introduction: string;
    contact: string;
    lastUpdated: string;
    sections: Array<{
      id: string;
      title: string;
      text: string;
      items?: string[];
    }>;
  };
}

export default function PrivacyPolicyContent({
  translations,
}: PrivacyPolicyContentProps) {
  const icons = {
    dataCollection: <Database className="w-6 h-6 text-primary" />,
    dataUsage: <Shield className="w-6 h-6 text-primary" />,
    dataSharing: <FileText className="w-6 h-6 text-primary" />,
    dataStorage: <User className="w-6 h-6 text-primary" />,
    userRights: <User className="w-6 h-6 text-primary" />,
    changes: <RefreshCw className="w-6 h-6 text-primary" />,
  };

  return (
    <>
      <Title
        text={translations.title}
        className="w-full text-4xl! font-bold mb-8 text-center animate-gradient-flow wrap-break-word"
      />

      <p className="text-muted-foreground text-center mb-12">
        {translations.introduction}
      </p>

      <div className="space-y-8">
        {translations.sections.map((section) => (
          <Card key={section.id} id={section.id} className="shadow-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {icons[section.id as keyof typeof icons]}
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
        {translations.contact} <Mail className="inline w-4 h-4 ml-1" />
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {translations.lastUpdated}: 22 August 2025
      </p>
    </>
  );
}
