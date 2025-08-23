'use client';

import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import Tilt from 'react-parallax-tilt';
import ExampleBlock from '@/components/shared/example-block';
import { Skeleton } from '@/components/ui/skeleton';
import { Souvenir } from '@/types';
import { useTranslations } from 'next-intl';

interface CatalogProps {
  title: string;
  dataSource: string;
  exampleProductNumber?: string;
  className?: string;
  products?: Souvenir[];
  modelUrls: Record<string, string>; // New prop for Dropbox URLs
}

const Catalog: React.FC<CatalogProps> = ({
  title,
  dataSource,
  exampleProductNumber,
  className,
  products: initialProducts,
  modelUrls, // Receive Dropbox URLs
}) => {
  const t = useTranslations('Catalog');
  const [products, setProducts] = useState<Souvenir[]>(initialProducts || []);
  const [selectedProduct, setSelectedProduct] = useState<Souvenir | null>(null);
  const [exampleProduct, setExampleProduct] = useState<Souvenir | null>(null);
  const [isLoading, setIsLoading] = useState(!initialProducts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialProducts) {
      setIsLoading(true);
      fetch(dataSource)
        .then((res) => {
          if (!res.ok)
            throw new Error(t('fetch_error', { type: title.toLowerCase() }));
          return res.json();
        })
        .then((data: Souvenir[]) => {
          setProducts(data);
          if (exampleProductNumber) {
            const foundProduct = data.find(
              (product) => product.number === exampleProductNumber
            );
            setExampleProduct(foundProduct || null);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
    } else if (exampleProductNumber) {
      const foundProduct = initialProducts.find(
        (product) => product.number === exampleProductNumber
      );
      setExampleProduct(foundProduct || null);
    }
  }, [dataSource, exampleProductNumber, title, t, initialProducts]);

  if (error) return <div>{t('error', { message: error })}</div>;

  return (
    <div className={className}>
      <Container>
        {exampleProduct && (
          <ExampleBlock
            key={exampleProduct.number}
            souvenir={exampleProduct}
            reverse={false}
            className="my-6 md:my-12"
            modelUrl={modelUrls[exampleProduct.type] || ''} // Pass the correct model URL
          />
        )}
        <hr className="my-12" />
        <div className="flex justify-center w-full h-full">
          <Title
            text={title}
            className="text-[28px] md:text-6xl font-extrabold leading-tight animate-gradient-flow text-center"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 my-8 px-4 md:px-0">
          {isLoading
            ? Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton
                  key={idx}
                  className="h-[340px] w-full rounded-lg flex flex-col items-center p-4"
                >
                  <div className="w-64 h-64 bg-muted rounded mb-4 animate-pulse" />
                  <div className="w-24 h-6 bg-muted rounded mb-2 animate-pulse" />
                  <div className="w-16 h-4 bg-muted rounded animate-pulse" />
                </Skeleton>
              ))
            : products.map((product) => (
                <Dialog
                  key={product.number}
                  open={selectedProduct?.number === product.number}
                  onOpenChange={(open) =>
                    setSelectedProduct(open ? product : null)
                  }
                >
                  <DialogTrigger asChild>
                    <div className="border hover:bg-popover/50 rounded-lg p-4 flex flex-col items-center hover:scale-102 transition-all duration-300 ease-in-out cursor-pointer">
                      <Image
                        width={500}
                        height={500}
                        src={
                          product.image
                            ? `/${product.image.replace('public/', '')}`
                            : '/fallback-image.jpg'
                        }
                        alt={`${title} ${product.number}`}
                        className="w-64 h-64 object-contain mb-2"
                      />
                      <div className="font-semibold">
                        {t('number', { number: product.number })}
                      </div>
                      <div className="text-xs text-primary/60">
                        {product.country.toUpperCase()}
                      </div>
                    </div>
                  </DialogTrigger>

                  <DialogContent showCloseButton>
                    <DialogTitle>
                      {t(`type`)} №{product.number}
                    </DialogTitle>
                    <div className="flex flex-col items-center">
                      <Tilt
                        scale={1.05}
                        tiltMaxAngleX={15}
                        tiltMaxAngleY={15}
                        className="mb-4"
                      >
                        <Image
                          width={800}
                          height={800}
                          src={
                            product.image
                              ? `/${product.image.replace('public/', '')}`
                              : '/fallback-image.jpg'
                          }
                          alt={`${title} ${product.number}`}
                          className="w-128 h-128 object-contain"
                        />
                      </Tilt>
                      <div className="font-semibold text-lg mb-2">
                        {t('number', { number: product.number })}
                      </div>
                      <div className="text-xs text-primary/60 mb-2">
                        {product.country.toUpperCase()}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
        </div>
      </Container>
    </div>
  );
};

export default Catalog;
