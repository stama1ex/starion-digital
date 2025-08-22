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
import { Suspense } from 'react';
import { Progress } from '@/components/ui/progress';
import { Vector3 } from 'three';
import { useTranslations } from 'next-intl';

interface SceneProps {
  modelPath: string; // Path to the 3D model (e.g., '/3d/magnet.glb')
  scale?: number | [number, number, number]; // Scale of the model
  objectPosition?: Vector3 | [number, number, number]; // Position of the model
  cameraPosition?: Vector3 | [number, number, number]; // Camera position
  directionalLightIntensity?: number; // Intensity of directional light
  environmentPreset?: string; // Environment preset (e.g., 'dawn', 'studio')
}

const Model: React.FC<{
  url: string;
  scale: number | [number, number, number];
  position: Vector3 | [number, number, number];
}> = ({ url, scale, position }) => {
  const { scene } = useGLTF(url, true);
  return <primitive object={scene} scale={scale} position={position} />;
};

// Лоадер с прогресс-баром
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
        <Model url={modelPath} scale={scale} position={objectPosition} />
        <Environment preset={environmentPreset as any} />
      </Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  );
};

export default Scene;
