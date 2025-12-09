import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.dropboxusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.dropboxusercontent.com',
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
