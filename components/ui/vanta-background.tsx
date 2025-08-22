'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import FOG from 'vanta/dist/vanta.fog.min';
import { useTheme } from 'next-themes'; // если используешь next-themes

interface VantaFogBackgroundProps {
  className?: string;
  children?: React.ReactNode;
}

const VantaFogBackground: React.FC<VantaFogBackgroundProps> = ({
  className,
  children,
}) => {
  const vantaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  const { theme } = useTheme(); // "light" | "dark"

  useEffect(() => {
    if (vantaRef.current) {
      // если уже есть эффект — уничтожаем его, чтобы пересоздать с новым baseColor
      if (vantaEffect) vantaEffect.destroy();

      const effect = FOG({
        el: vantaRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        highlightColor: 0x8600ff,
        midtoneColor: 0xd46b5e,
        lowlightColor: 0x1b00ff,
        baseColor: theme === 'light' ? 0xf9f9fb : 0x1b0b44,
        blurFactor: 0.9,
        speed: 2,
        zoom: 0.3,
      });
      setVantaEffect(effect);
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy();
    };
    // пересоздавать при смене темы
  }, [theme]);

  return (
    <div
      ref={vantaRef}
      className={`relative overflow-hidden rounded-lg ${className}`}
    >
      <div className="relative z-5">{children}</div>
    </div>
  );
};

export default VantaFogBackground;
