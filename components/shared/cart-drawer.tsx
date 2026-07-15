'use client';

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '@/store/cart-store';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useDropboxImage } from '@/lib/hooks/useDropboxImage';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { usePartner } from '@/app/providers/partner-provider';

interface CartDrawerProps {
  isOutline?: boolean;
}

function CartItemImage({ image, alt }: { image?: string | null; alt: string }) {
  const { imgSrc, loading } = useDropboxImage(image);

  if (!image || loading || !imgSrc) {
    return <div className="h-15 w-15 rounded-md bg-muted animate-pulse" />;
  }

  if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imgSrc}
        width={60}
        height={60}
        className="rounded-md object-cover h-15 w-15"
        alt={alt}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      width={60}
      height={60}
      className="rounded-md object-cover"
      alt={alt}
    />
  );
}

export default function CartDrawer({ isOutline = true }: CartDrawerProps) {
  const t = useTranslations('Cart');
  const { items, removeItem, clear } = useCartStore();
  const { address: partnerAddress, isVip } = usePartner();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [address, setAddress] = useState('');
  const addressInitialized = useRef(false);

  useEffect(() => {
    if (!addressInitialized.current && partnerAddress) {
      setAddress(partnerAddress);
      addressInitialized.current = true;
    }
  }, [partnerAddress]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmit = async (
    orderType: 'regular' | 'realization' = 'regular',
  ) => {
    if (!items.length || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.id,
          qty: i.quantity,
        })),
        comment,
        address: address.trim() || undefined,
        orderType, // 'regular' или 'realization'
      };

      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(t('toast_error'));
        return;
      }

      clear();
      setComment('');
      toast.success(t('success'));
      window.location.replace('/my-orders');
    } catch {
      toast.error(t('toast_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant={isOutline ? 'outline' : 'default'}>
          <ShoppingCart />
          {t('cart')} ({totalItems})
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[80vh]">
        <div className="mx-auto w-full max-w-7xl">
          <DrawerHeader>
            <DrawerTitle>{t('cart')}</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 flex flex-col gap-3 overflow-y-auto max-h-[55vh]">
            {!items.length && (
              <p className="text-sm text-muted-foreground md:text-center">
                {t('empty')}
              </p>
            )}

            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border rounded-md p-2"
                >
                  <div className="flex items-center gap-3">
                    <CartItemImage image={item.image} alt={item.number} />
                    <div>
                      <div className="text-sm font-medium">{`Souvenir ${item.number}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('qty')}: {item.quantity}
                      </div>
                      <div className="text-xs text-primary font-semibold">
                        {item.price} × {item.quantity} ={' '}
                        {item.price * item.quantity} MDL
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                  >
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="px-4 mt-3">
            <Label htmlFor="cart-address" className="mb-1">
              {t('address_label')}
            </Label>
            <Input
              id="cart-address"
              type="text"
              placeholder={t('address_placeholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="px-4 mt-3">
            <textarea
              className="w-full text-sm border rounded-md p-2 bg-background"
              placeholder={t('comment_placeholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <DrawerFooter>
            <div className="flex flex-col text-sm text-muted-foreground gap-1 w-full">
              <div className="flex justify-between md:justify-center">
                <span>{t('positions')}:</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between md:justify-center font-semibold text-primary mb-4">
                <span>{t('total_price')}:</span>
                <span>{totalPrice} MDL</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-2">
              <Button
                disabled={!items.length || isSubmitting}
                onClick={() => handleSubmit('regular')}
              >
                {isSubmitting ? t('sending') : 'Оформить заказ'}
              </Button>

              {isVip && (
                <div className="relative inline-flex">
                  <Button
                    variant="secondary"
                    disabled={!items.length || isSubmitting}
                    onClick={() => handleSubmit('realization')}
                  >
                    {t('realization_button')}
                  </Button>
                  <InfoTooltip
                    text={t('realization_info')}
                    className="absolute -top-2 -right-2"
                  />
                </div>
              )}

              <DrawerClose asChild>
                <Button variant="outline">{t('close')}</Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
