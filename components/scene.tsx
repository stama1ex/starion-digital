/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import * as React from 'react';
import { Canvas } from '@react-three/fiber';
import {
  useGLTF,
  OrbitControls,
  Environment,
  Html,
  useProgress,
} from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Vector3 } from 'three';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner'; // ✅ sonner

interface SceneProps {
  modelPath: string;
  scale?: number | [number, number, number];
  objectPosition?: Vector3 | [number, number, number];
  cameraPosition?: Vector3 | [number, number, number];
  directionalLightIntensity?: number;
  environmentPreset?: string;
}

const Model: React.FC<{
  url: string;
  scale: number | [number, number, number];
  position: Vector3 | [number, number, number];
  onLoaded?: () => void;
}> = ({ url, scale, position, onLoaded }) => {
  const { scene } = useGLTF(url, true);

  useEffect(() => {
    if (onLoaded) onLoaded();
  }, [onLoaded]);

  return <primitive object={scene} scale={scale} position={position} />;
};

const Loader = () => {
  const { progress } = useProgress();
  const t = useTranslations('Scene');

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center p-4 rounded-xl">
        <p className="mb-2 text-md md:text-xl font-medium">
          {t('loading', { progress: progress.toFixed(0) })}
        </p>
        <Progress value={progress} className="md:w-[500px] w-[300px]" />
      </div>
    </Html>
  );
};

const Scene: React.FC<SceneProps> = ({
  modelPath,
  scale = [5, 5, 5],
  objectPosition = [0, -1.5, 0],
  cameraPosition = [0, 0, 5],
  directionalLightIntensity = 0.3,
  environmentPreset = 'dawn',
}) => {
  const t = useTranslations('Scene');
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    if (modelLoaded) {
      toast(t('tooltip'), {
        duration: 6000,
      });
    }
  }, [modelLoaded, t]);

  return (
    <Canvas
      style={{ height: '100%', width: '100%' }}
      camera={{ position: cameraPosition, fov: 50 }}
    >
      <ambientLight intensity={0} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={directionalLightIntensity}
      />
      <Suspense fallback={<Loader />}>
        <Model
          url={modelPath}
          scale={scale}
          position={objectPosition}
          onLoaded={() => setModelLoaded(true)}
        />
        <Environment preset={environmentPreset as any} />
      </Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  );
};

export default Scene;
