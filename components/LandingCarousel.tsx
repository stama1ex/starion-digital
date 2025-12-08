// components/LandingCarousel.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { getCategories } from '@/lib/categories';
import { imageVariants } from '@/lib/imageVariants';
import { getRandomImgs } from '@/lib/utils';
import { Soon } from './shared/soon';
import { useTranslations } from 'next-intl';

interface Product {
  id: number;
  number: string;
  type: string;
  material: string;
  image: string;
  country: string;
}

export default function LandingCarousel() {
  const tCategories = useTranslations('Categories');
  const categories = getCategories().map((category) => ({
    ...category,
    name: tCategories(`${category.nameKey}.name`),
  }));
  const [magnetImgs, setMagnetImgs] = useState<string[]>([]);
  const [plateImgs, setPlateImgs] = useState<string[]>([]);
  const [currentImgs, setCurrentImgs] = useState<{ [key: string]: string[] }>({
    magnet: [],
    plate: [],
  });
  const controls = useAnimation();
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const getImageSrc = (imagePath: string) => {
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return '/' + imagePath.replace(/^public\//, '');
  };

  useEffect(() => {
    fetch('/magnets.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch magnets');
        return res.json();
      })
      .then((data: Product[]) => {
        const imgs = data.map((m) => m.image);
        setMagnetImgs(imgs);
        setCurrentImgs((prev) => ({ ...prev, magnet: getRandomImgs(imgs, 4) }));
      })
      .catch((err) => console.error(err));
    fetch('/plates.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch plates');
        return res.json();
      })
      .then((data: Product[]) => {
        const imgs = data.map((p) => p.image);
        setPlateImgs(imgs);
        setCurrentImgs((prev) => ({ ...prev, plate: getRandomImgs(imgs, 4) }));
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!api) return;
    const handleSelect = async () => {
      const current = api.selectedScrollSnap();
      setCurrentSlide(current);
      const categoryType = categories[current].type;
      if (categoryType === 'magnet' || categoryType === 'plate') {
        await controls.start('exit');
        setCurrentImgs((prev) => ({
          ...prev,
          [categoryType]: getRandomImgs(
            categoryType === 'magnet' ? magnetImgs : plateImgs,
            4
          ),
        }));
        await controls.start('enter');
      }
    };

    api.on('select', handleSelect);
    return () => {
      api.off('select', handleSelect);
    };
  }, [api, magnetImgs, plateImgs, controls, categories]);

  useEffect(() => {
    if (!api) return;
    const updateImages = async () => {
      const categoryType = categories[currentSlide].type;
      if (categoryType === 'magnet' || categoryType === 'plate') {
        await controls.start('exit');
        setCurrentImgs((prev) => ({
          ...prev,
          [categoryType]: getRandomImgs(
            categoryType === 'magnet' ? magnetImgs : plateImgs,
            4
          ),
        }));
        await controls.start('enter');
      }
    };

    const interval = setInterval(updateImages, 5000);
    return () => clearInterval(interval);
  }, [currentSlide, magnetImgs, plateImgs, controls, categories, api]);

  return (
    <Carousel setApi={setApi} className="md:w-full w-[90vw] mx-auto">
      <CarouselContent>
        {categories.map((item, index) => {
          const imgs = currentImgs[item.type] || [];
          return (
            <CarouselItem key={index}>
              <div className="p-4 select-none">
                <Card className="relative flex flex-col items-center justify-center p-0 animate-shadow-flow">
                  <CardContent className="relative z-10 flex flex-col items-center justify-center gap-4 w-full md:h-[500px] h-[300px] bg-card rounded-lg overflow-hidden">
                    {[3, 4, 5].includes(item.id) ? (
                      <span className="text-3xl md:text-5xl font-black text-center text-primary/50 z-5">
                        {item.name}
                      </span>
                    ) : (
                      <span className="text-3xl md:text-5xl font-black text-center animate-gradient-flow z-5">
                        {item.name}
                      </span>
                    )}

                    {[3, 4, 5].includes(item.id) && (
                      <Soon className="text-xl" />
                    )}
                    {imgs.length >= 4 && (
                      <>
                        <motion.img
                          src={getImageSrc(imgs[0])}
                          alt={`${item.name} top-left`}
                          className="absolute top-0 left-0 w-36 h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="top-left"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[1])}
                          alt={`${item.name} top-right`}
                          className="absolute top-0 right-0 w-36 h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="top-right"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[2])}
                          alt={`${item.name} bottom-left`}
                          className="absolute bottom-0 left-0 w-36 h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="bottom-left"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[3])}
                          alt={`${item.name} bottom-right`}
                          className="absolute bottom-0 right-0 w-36 h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="bottom-right"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 z-5" />
      <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 z-5" />
    </Carousel>
  );
}
