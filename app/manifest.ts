import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => ({
  name: 'FitnessJourni',
  short_name: 'FitnessJourni',
  description: 'Shared daily tracking and training sessions',
  start_url: '/',
  display: 'standalone',
  background_color: '#edf7fc',
  theme_color: '#edf7fc',
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
