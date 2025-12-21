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
import { useCartStore } from '@/store/cart-store';
import { usePartner } from '@/app/providers/partner-provider';
import { Button } from '../ui/button';
import { useTranslations } from 'next-intl';
import { NoImageIcon } from './no-image-icon';
import { useRouter } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { useDropboxImage } from '@/lib/hooks/useDropboxImage';

// Types match Prisma enums
type ProductType = string;

interface ProductDTO {
  id: number;
  number: string;
  type: ProductType;
  group?: {
    id: number;
    slug: string;
    translations: unknown;
  } | null;
  image: string;
  country: string;
}

interface Props {
  product: ProductDTO;
  modelUrls: Record<string, string>;
  getPrice: (p: ProductDTO) => number | null;
}

export function ProductCard({ product, getPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);

  const { imgSrc, loading } = useDropboxImage(product.image);

  const { isPartner } = usePartner();
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const t = useTranslations('Catalog');

  const rawPrice = getPrice(product);
  const price = rawPrice ?? 0;

  const hasImage = !imgError && product.image && product.image.trim();

  const total = price * quantity;

  const tiltImage = useMemo(
    () => (
      <Tilt scale={1.05} tiltMaxAngleX={15} tiltMaxAngleY={15} className="mb-4">
        {!hasImage || loading || !imgSrc ? (
          <NoImageIcon className="w-full max-w-md h-64 md:h-80 text-primary" />
        ) : imgSrc.includes('dropboxusercontent.com') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={product.number}
            className="w-full max-w-md h-64 md:h-80 object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <Image
            width={800}
            height={800}
            src={imgSrc}
            alt={product.number}
            className="w-full max-w-md h-64 md:h-80 object-contain"
            onError={() => setImgError(true)}
          />
        )}
      </Tilt>
    ),
    [imgSrc, product.number, hasImage, loading]
  );

  const handleQuantity = (v: number) => setQuantity(Math.max(1, v));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="border hover:bg-popover/50 rounded-lg p-4 flex flex-col items-center hover:scale-102 transition-all cursor-pointer">
          {!hasImage || loading || !imgSrc ? (
            <NoImageIcon className="md:w-64 md:h-64 w-32 h-32 text-primary mb-2" />
          ) : imgSrc.includes('dropboxusercontent.com') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={product.number}
              className="md:w-64 md:h-64 w-32 h-32 object-contain mb-2"
              onError={() => setImgError(true)}
            />
          ) : (
            <Image
              width={500}
              height={500}
              src={imgSrc}
              alt={product.number}
              className="md:w-64 md:h-64 w-32 h-32 object-contain mb-2"
              onError={() => setImgError(true)}
            />
          )}

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

        {isPartner ? (
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
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg">
            <Handshake className="w-16 h-16 text-primary" />
            <div className="text-center">
              <h3 className="font-bold text-lg mb-2">
                {t('partner_cta_title')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('partner_cta_description')}
              </p>
            </div>
            <Button
              onClick={() => {
                setOpen(false);
                router.push('/partnership');
              }}
              className="w-full"
            >
              {t('partner_cta_button')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
