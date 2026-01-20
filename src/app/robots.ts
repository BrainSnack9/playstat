import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { resolveBaseUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  const host = headers().get('host')
  const baseUrl = resolveBaseUrl(host)

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          '/private/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
