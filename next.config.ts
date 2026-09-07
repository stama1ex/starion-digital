import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Хост, с которого раздаются файлы из R2 (cdn.ar3d.io). next/image грузит
// картинки только с явно разрешённых доменов, поэтому без этой записи
// товары после переезда на R2 просто не отрисуются.
function r2Hostname(): string {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!raw) return 'cdn.ar3d.io';
  try {
    return new URL(raw).hostname;
  } catch {
    return 'cdn.ar3d.io';
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: r2Hostname(),
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Оптимизация сборки и кэширования
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-select',
    ],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
