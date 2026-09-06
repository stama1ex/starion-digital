// Отмена загрузок, которые не дошли до сохранения.
//
// Файл уезжает в R2 сразу, как его выбрали в форме — иначе он шёл бы через
// наш сервер и упёрся в лимит тела запроса Vercel. Поэтому если админ закрыл
// окно, не нажав «Сохранить», файл уже лежит в хранилище, а ссылки на него
// нет нигде: на сайте пусто, а место занято. Админка сообщает сюда пути,
// залитые в этой сессии окна, и мы их убираем.
//
// Метод POST, а не DELETE, намеренно: при закрытии вкладки браузер успевает
// отправить только navigator.sendBeacon, а тот умеет исключительно POST.
import { NextRequest, NextResponse } from 'next/server';
import { checkSuperAdminAuth } from '../../auth-utils';
import { releaseARAssets } from '@/lib/ar/cleanup';

export async function POST(request: NextRequest) {
  if (!(await checkSuperAdminAuth())) {
    return NextResponse.json(
      { error: 'Unauthorized - Super admin only' },
      { status: 401 }
    );
  }

  try {
    const data = await request.json().catch(() => ({}));
    const paths = Array.isArray(data?.paths) ? data.paths : [];
    if (!paths.length) return NextResponse.json({ removedFiles: 0 });

    // releaseARAssets сама отсеет всё, что не лежит в ar/, и не тронет файл,
    // на который ссылается хоть одно оживление — так что даже кривой список
    // от клиента ничего сохранённого не заденет.
    const removed = await releaseARAssets(
      paths.filter((p: unknown): p is string => typeof p === 'string')
    );

    return NextResponse.json({ removedFiles: removed.deleted });
  } catch (error) {
    console.error('Error discarding AR uploads:', error);
    return NextResponse.json(
      { error: 'Failed to discard uploads' },
      { status: 500 }
    );
  }
}
