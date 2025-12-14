import { Metadata } from 'next';
import PartnershipContent from './partnership-content';

export const metadata: Metadata = {
  title: 'Партнерство | Starion Digital',
  description:
    'Станьте партнером Starion Digital. Подайте заявку на сотрудничество и получите доступ к оптовым ценам на сувенирную продукцию.',
  keywords: [
    'партнерство',
    'сотрудничество',
    'оптовые цены',
    'заявка партнера',
    'стать партнером',
  ],
  openGraph: {
    title: 'Партнерство | Starion Digital',
    description: 'Подайте заявку на партнерство с Starion Digital',
    type: 'website',
  },
};

export default function PartnershipPage() {
  return <PartnershipContent />;
}
