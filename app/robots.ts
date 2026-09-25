import type { MetadataRoute } from 'next';

/** Private tracker — keep it out of search results entirely. */
const robots = (): MetadataRoute.Robots => ({
  rules: [{ userAgent: '*', disallow: '/' }],
});

export default robots;
