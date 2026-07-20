// components/LandingCarousel.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [cardImgs, setCardImgs] = useState<string[]>([]);
  const [currentImgs, setCurrentImgs] = useState<{ [key: string]: string[] }>({
    magnet: [],
    plate: [],
    card: [],
  });
  const controls = useAnimation();
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  // controls — один общий AnimationControls на все слайды карусели,
  // поэтому нельзя запускать exit/enter параллельно из двух мест
  // (смена слайда + таймер) — иначе они перебивают друг друга и
  // картинки резко меняются посреди анимации.
  const isCyclingRef = useRef(false);

  const getImageSrc = (imagePath: string) => {
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return '/' + imagePath.replace(/^public\//, '');
  };

  const imgsByType = useCallback(
    (type: string): string[] => {
      if (type === 'magnet') return magnetImgs;
      if (type === 'plate') return plateImgs;
      if (type === 'card') return cardImgs;
      return [];
    },
    [magnetImgs, plateImgs, cardImgs],
  );

  const cycleImages = useCallback(
    async (categoryType: string) => {
      if (!['magnet', 'plate', 'card'].includes(categoryType)) return;
      if (isCyclingRef.current) return;
      isCyclingRef.current = true;
      try {
        await controls.start('exit');
        setCurrentImgs((prev) => ({
          ...prev,
          [categoryType]: getRandomImgs(imgsByType(categoryType), 4),
        }));
        await controls.start('enter');
      } finally {
        isCyclingRef.current = false;
      }
    },
    [controls, imgsByType],
  );

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
      .catch((err) => console.error('Error loading magnets:', err));
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
      .catch((err) => console.error('Error loading plates:', err));
  }, []);

  // Открытки резолвятся через Dropbox и приходят по одной (NDJSON),
  // поэтому показываем анимацию, как только накопится первые 4,
  // не дожидаясь, пока догрузятся остальные.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/postcards/images');
        if (!res.ok || !res.body) throw new Error('Failed to fetch postcards');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const imgs: string[] = [];
        let buffer = '';
        let revealed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (!line.trim()) continue;

            try {
              imgs.push(JSON.parse(line));
            } catch {
              continue;
            }

            if (cancelled) return;
            setCardImgs([...imgs]);
            if (!revealed && imgs.length >= 4) {
              revealed = true;
              setCurrentImgs((prev) => ({
                ...prev,
                card: getRandomImgs(imgs, 4),
              }));
            }
          }
        }
      } catch (err) {
        if (!cancelled) console.error('Error loading postcards:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    const handleSelect = () => {
      const current = api.selectedScrollSnap();
      setCurrentSlide(current);
      void cycleImages(categories[current].type);
    };

    api.on('select', handleSelect);
    return () => {
      api.off('select', handleSelect);
    };
  }, [api, cycleImages, categories]);

  useEffect(() => {
    if (!api) return;
    const interval = setInterval(() => {
      void cycleImages(categories[currentSlide].type);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentSlide, cycleImages, categories, api]);

  return (
    <Carousel setApi={setApi} className="md:w-full w-[90vw] mx-auto">
      <CarouselContent>
        {categories.map((item, index) => {
          const imgs = currentImgs[item.type] || [];
          return (
            <CarouselItem key={index}>
              <div className="p-4 select-none">
                <Card className="relative flex flex-col items-center justify-center p-0 animate-shadow-flow">
                  <CardContent className="relative z-10 flex flex-col items-center justify-center gap-4 w-full md:h-125 h-75 bg-card rounded-lg overflow-hidden">
                    {[5, 6].includes(item.id) ? (
                      <span className="text-3xl md:text-5xl font-black text-center text-primary/50 z-5">
                        {item.name}
                      </span>
                    ) : (
                      <span className="text-3xl md:text-5xl font-black text-center animate-gradient-flow z-5">
                        {item.name}
                      </span>
                    )}

                    {[5, 6].includes(item.id) && <Soon className="text-xl" />}
                    {imgs.length >= 4 && (
                      <>
                        <motion.img
                          src={getImageSrc(imgs[0])}
                          alt={`${item.name} top-left`}
                          className="absolute top-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="top-left"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[1])}
                          alt={`${item.name} top-right`}
                          className="absolute top-0 right-0 w-24 h-24 sm:w-36 sm:h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="top-right"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[2])}
                          alt={`${item.name} bottom-left`}
                          className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                          custom="bottom-left"
                          variants={imageVariants}
                          initial="initial"
                          animate={controls}
                        />
                        <motion.img
                          src={getImageSrc(imgs[3])}
                          alt={`${item.name} bottom-right`}
                          className="absolute bottom-0 right-0 w-24 h-24 sm:w-36 sm:h-36 md:w-64 md:h-64 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
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
