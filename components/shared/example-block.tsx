/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';
import * as React from 'react';
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
import { cn } from '@/lib/utils';
import { Souvenir } from '@/types';
import VantaFogBackground from '../ui/vanta-background';
import Scene from '../scene';
import { useTranslations } from 'next-intl';
import { ExampleBlockSkeleton } from './example-block-skeleton';

interface ExampleBlockProps {
  souvenir: any;
  reverse?: boolean;
  className?: string;
  isLoading?: boolean;
  modelUrl: string; // New prop for the Dropbox temporary URL
}

interface SceneSettings {
  modelPath: string;
  scale: [number, number, number];
  objectPosition: [number, number, number];
  cameraPosition: [number, number, number];
  directionalLightIntensity: number;
  environmentPreset: string;
}

const ExampleBlock: React.FC<ExampleBlockProps> = ({
  souvenir,
  reverse = false,
  className,
  isLoading = false,
  modelUrl, // Receive the Dropbox URL
}) => {
  const t = useTranslations('ExampleBlock');

  if (isLoading) {
    return <ExampleBlockSkeleton reverse={reverse} className={className} />;
  }

  // Define scene settings based on souvenir type
  const sceneSettings: Record<string, SceneSettings> = {
    magnet: {
      modelPath: modelUrl, // Use the passed Dropbox URL
      scale: [5, 5, 5],
      objectPosition: [0, -1.5, 0],
      cameraPosition: [0, 0, 5],
      directionalLightIntensity: 10,
      environmentPreset: 'city',
    },
    plate: {
      modelPath: modelUrl, // Use the passed Dropbox URL
      scale: [3, 3, 3],
      objectPosition: [0, 0, 0],
      cameraPosition: [0, 0, 8],
      directionalLightIntensity: 10,
      environmentPreset: 'city',
    },
  };

  const settings = sceneSettings[souvenir.type] || sceneSettings.magnet;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <div className={cn('mx-4 md:mx-0 group', className)}>
          <VantaFogBackground className="shadow-md hover:shadow-lg transition cursor-pointer rounded-lg border">
            <div
              className={cn(
                'relative flex flex-col md:flex-row',
                reverse ? 'md:flex-row-reverse' : '',
                'items-center justify-between md:w-full'
              )}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                }
              }}
            >
              <div className="relative flex flex-col md:flex-row w-full">
                <div className="flex flex-col items-center md:items-start justify-center md:ml-12 md:w-2/3 my-8 mx-2">
                  <span className="text-2xl md:text-3xl font-semibold text-white mb-4 text-center drop-shadow">
                    {t('try_product')}
                  </span>
                  <ul className="text-center md:text-left">
                    <li className="flex items-start gap-3 text-md md:text-lg text-white dark:text-gray-200 drop-shadow">
                      <span className="text-blue-400">•</span>
                      {t('scan_qr')}
                    </li>
                    <li className="flex items-start gap-3 text-md md:text-lg text-white dark:text-gray-200 drop-shadow">
                      <span className="text-blue-400">•</span>
                      {t('hold_camera')}
                    </li>
                  </ul>
                </div>
                <img
                  src={`/examples/${souvenir.type}.png`}
                  alt={souvenir.name ?? 'Товар'}
                  className={cn(
                    'w-60 h-60 md:w-70 md:h-70 object-contain mx-auto drop-shadow group-hover:scale-105 transition duration-300 ease-in-out',
                    'md:absolute md:top-1/2 md:-translate-y-1/2 md:right-[-50rem]',
                    reverse ? 'md:right-[-2rem]' : 'md:left-[-2rem]'
                  )}
                />
              </div>
            </div>
          </VantaFogBackground>
        </div>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold text-center">
            {t('souvenir_number', { number: souvenir.number })}
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex items-center justify-center h-[75vh]">
          <div
            className="canvas-wrapper w-full h-full"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Scene
              modelPath={settings.modelPath}
              scale={settings.scale}
              objectPosition={settings.objectPosition}
              cameraPosition={settings.cameraPosition}
              directionalLightIntensity={settings.directionalLightIntensity}
              environmentPreset={settings.environmentPreset}
            />
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="w-full sm:w-32 mx-auto cursor-pointer"
            >
              {t('close')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ExampleBlock;
