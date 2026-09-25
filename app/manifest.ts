import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  name: 'FitnessJourni',
  short_name: 'FitnessJourni',
  description: 'Shared daily tracking and training sessions',
  start_url: '/',
  display: 'standalone',
  background_color: '#0b0b0c',
  theme_color: '#0b0b0c',
  icons: [
    {
      src: '/fitnessjourni-icon-192-v2.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/fitnessjourni-icon-512-v2.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/fitnessjourni-icon-512-v2.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
});

export default manifest;
