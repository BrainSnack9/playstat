import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 시 타입/린트 체크 스킵 (CI에서 별도로 처리)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ISR/SSG 설정 (개발 환경에서는 캐시 최소화)
  experimental: {
    staleTimes: isDev ? {
      dynamic: 0,
      static: 0,
    } : {
      dynamic: 30,
      static: 180,
    },
  },

  // 이미지 최적화 설정
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.api-sports.io',
      },
      {
        protocol: 'https',
        hostname: 'media-*.api-sports.io',
      },
      {
        protocol: 'https',
        hostname: 'crests.football-data.org',
      },
      // 뉴스 이미지 소스
      {
        protocol: 'https',
        hostname: 'ichef.bbci.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: 'e0.365dm.com',
      },
      {
        protocol: 'https',
        hostname: '*.newsapi.org',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 보안 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // 리다이렉트
  async redirects() {
    return [
      {
        source: '/match',
        destination: '/matches/today',
        permanent: true,
      },
      {
        source: '/team',
        destination: '/teams',
        permanent: true,
      },
    ];
  },

  // Rewrites for subdomain routing (beforeFiles runs before middleware)
  async rewrites() {
    return {
      beforeFiles: [
        // football.playstat.space
        {
          source: '/',
          has: [{ type: 'host', value: 'football.playstat.space' }],
          destination: '/football',
        },
        {
          source: '/:locale(ko|en|es|ja|de)',
          has: [{ type: 'host', value: 'football.playstat.space' }],
          destination: '/:locale/football',
        },
        {
          source: '/:locale(ko|en|es|ja|de)/:path*',
          has: [{ type: 'host', value: 'football.playstat.space' }],
          destination: '/:locale/football/:path*',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'football.playstat.space' }],
          destination: '/football/:path*',
        },
        // basketball.playstat.space
        {
          source: '/',
          has: [{ type: 'host', value: 'basketball.playstat.space' }],
          destination: '/basketball',
        },
        {
          source: '/:locale(ko|en|es|ja|de)',
          has: [{ type: 'host', value: 'basketball.playstat.space' }],
          destination: '/:locale/basketball',
        },
        {
          source: '/:locale(ko|en|es|ja|de)/:path*',
          has: [{ type: 'host', value: 'basketball.playstat.space' }],
          destination: '/:locale/basketball/:path*',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'basketball.playstat.space' }],
          destination: '/basketball/:path*',
        },
        // baseball.playstat.space
        {
          source: '/',
          has: [{ type: 'host', value: 'baseball.playstat.space' }],
          destination: '/baseball',
        },
        {
          source: '/:locale(ko|en|es|ja|de)',
          has: [{ type: 'host', value: 'baseball.playstat.space' }],
          destination: '/:locale/baseball',
        },
        {
          source: '/:locale(ko|en|es|ja|de)/:path*',
          has: [{ type: 'host', value: 'baseball.playstat.space' }],
          destination: '/:locale/baseball/:path*',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'baseball.playstat.space' }],
          destination: '/baseball/:path*',
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
