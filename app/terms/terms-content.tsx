// components/TermsContent.tsx
'use client';

import { Title } from '@/components/shared/title';
import { Card, CardContent } from '@/components/ui/card';
import {
  Globe,
  FileText,
  Lock,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react';

interface TermsContentProps {
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

export default function TermsContent({ translations }: TermsContentProps) {
  const icons = {
    useOfSite: <Globe className="w-6 h-6 text-primary" />,
    intellectualProperty: <FileText className="w-6 h-6 text-primary" />,
    prohibited: <Lock className="w-6 h-6 text-primary" />,
    limitations: <AlertTriangle className="w-6 h-6 text-primary" />,
    governingLaw: <Shield className="w-6 h-6 text-primary" />,
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
        {translations.contact}
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {translations.lastUpdated}: 22 August 2025
      </p>
    </>
  );
}
