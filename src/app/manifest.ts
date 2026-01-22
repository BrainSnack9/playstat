import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PlayStat - AI Sports Analysis',
    short_name: 'PlayStat',
    description: 'AI-powered sports analysis platform for Football, NBA, and MLB',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#10b981',
    orientation: 'portrait-primary',
    categories: ['sports', 'news', 'entertainment'],
    icons: [
      {
        src: '/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
