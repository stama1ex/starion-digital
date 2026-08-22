'use client';

import { Title } from '@/components/shared/title';
import { usePartner } from '@/app/providers/partner-provider';

interface AdminPanelTitleProps {
  initialVisible: boolean;
}

// Переключатель видимости живёт в шапке сайта (кнопка "Админ панель"), а
// не здесь - этот компонент только читает общее состояние, чтобы заголовок
// скрывался/появлялся мгновенно и на этой странице, без перезагрузки.
// initialVisible - значение с сервера для первого рендера, пока контекст
// ещё не загрузился (иначе был бы флеш заголовка при loading=true).
export default function AdminPanelTitle({
  initialVisible,
}: AdminPanelTitleProps) {
  const { showAdminPanelTitle, loading } = usePartner();
  const visible = loading ? initialVisible : showAdminPanelTitle;

  if (!visible) return null;

  return (
    <div className="flex justify-center w-full h-full">
      <Title
        text="Админ панель"
        className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
      />
    </div>
  );
}
