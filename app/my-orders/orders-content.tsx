'use client';

import { useEffect, useState } from 'react';
import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Order {
  id: number;
  createdAt: string;
  status: string;
  totalPrice: number;
  items: {
    quantity: number;
    sum: number;
    product: {
      number: string;
      image: string | null;
      country: string;
    };
  }[];
}

export default function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/order')
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Container className="py-12">
        <p className="text-center text-muted-foreground">Загрузка заказов...</p>
      </Container>
    );

  if (!orders.length)
    return (
      <Container className="py-12">
        <Title text="Мои заказы" className="text-center mb-6" />
        <p className="text-center text-muted-foreground">
          У вас пока нет заказов.
        </p>
      </Container>
    );

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  let lastDate = '';

  return (
    <Container className="py-12">
      <div className="flex justify-center w-full h-full">
        <Title
          text="Мои заказы"
          className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
        />
      </div>

      <div className="flex flex-col gap-8">
        {orders.map((order) => {
          const dateStr = formatDate(order.createdAt);
          const showDate = dateStr !== lastDate;
          lastDate = dateStr;

          return (
            <div key={order.id}>
              {showDate && (
                <>
                  <hr className="my-6 border-muted/40" />
                  <div className="text-sm text-muted-foreground mb-3 font-medium">
                    {dateStr}
                  </div>
                </>
              )}

              <div className="border rounded-lg p-4 bg-popover/40 hover:bg-popover/60 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-semibold">
                    Заказ № {order.id}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium px-2 py-1 rounded-md',
                      order.status === 'NEW' &&
                        'bg-yellow-500/20 text-yellow-600',
                      order.status === 'APPROVED' &&
                        'bg-blue-500/20 text-blue-600',
                      order.status === 'DONE' &&
                        'bg-green-500/20 text-green-600',
                      order.status === 'CANCELLED' &&
                        'bg-red-500/20 text-red-600'
                    )}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {it.product.image && (
                          <Image
                            src={`/${it.product.image.replace('public/', '')}`}
                            width={50}
                            height={50}
                            className="rounded-md object-cover"
                            alt=""
                          />
                        )}
                        <div className="text-sm">
                          № {it.product.number} — {it.quantity} шт.
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary">
                        {it.sum} MDL
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-4 pt-3 flex justify-between text-sm font-semibold">
                  <span>Итого:</span>
                  <span className="text-primary">{order.totalPrice} MDL</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}
