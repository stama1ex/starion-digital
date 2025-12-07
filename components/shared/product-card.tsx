'use client';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import Tilt from 'react-parallax-tilt';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { Product } from '@prisma/client';
import { useCartStore } from '@/store/cart-store';
import { usePartner } from '@/app/providers/partner-provider';
import { Button } from '../ui/button';
import { useTranslations } from 'next-intl';

interface Props {
  product: Product;
  modelUrls: Record<string, string>;
  getPrice: (p: Product) => number | null;
}

export function ProductCard({ product, modelUrls, getPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { isPartner } = usePartner();
  const addItem = useCartStore((s) => s.addItem);
  const t = useTranslations('Catalog');

  const rawPrice = getPrice(product);
  const price = rawPrice ?? 0;

  const imgSrc = '/' + product.image.replace(/^public\//, '');

  const total = price * quantity;

  const tiltImage = useMemo(
    () => (
      <Tilt scale={1.05} tiltMaxAngleX={15} tiltMaxAngleY={15} className="mb-4">
        <Image
          width={800}
          height={800}
          src={imgSrc}
          alt={product.number}
          className="w-128 h-128 object-contain"
        />
      </Tilt>
    ),
    [imgSrc, product.number]
  );

  const handleQuantity = (v: number) => setQuantity(Math.max(1, v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="border hover:bg-popover/50 rounded-lg p-4 flex flex-col items-center hover:scale-102 transition-all cursor-pointer">
          <Image
            width={500}
            height={500}
            src={imgSrc}
            alt={product.number}
            className="w-64 h-64 object-contain mb-2"
          />

          <div className="font-semibold">
            {t('number', { number: product.number })}
          </div>

          {isPartner && (
            <div className="text-sm font-bold text-primary">{price} MDL</div>
          )}

          <div className="text-xs text-primary/60">
            {product.country.toUpperCase()}
          </div>
        </div>
      </DialogTrigger>

      <DialogContent showCloseButton>
        <DialogTitle>
          {t('type')} №{product.number}
        </DialogTitle>

        <div className="flex flex-col items-center">
          {tiltImage}
          <div className="font-semibold text-lg mb-2">
            {t('number', { number: product.number })}
          </div>
          <div className="text-xs text-primary/60 mb-2">
            {product.country.toUpperCase()}
          </div>
        </div>

        {isPartner && (
          <div className="flex flex-col justify-between w-full">
            <div className="text-lg font-bold text-center mb-2">
              {total} MDL
            </div>

            <div className="flex items-center gap-3 mb-4 mx-auto">
              <Button
                variant="outline"
                onClick={() => handleQuantity(quantity - 1)}
              >
                -
              </Button>

              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => handleQuantity(parseInt(e.target.value) || 1)}
                className="w-16 text-center border rounded py-1"
              />

              <Button
                variant="outline"
                onClick={() => handleQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>

            <Button
              onClick={() => {
                addItem({ ...product, price }, quantity);
                setOpen(false);
                setQuantity(1);
              }}
              className="py-2 transition-all"
            >
              {t('add_to_order')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
