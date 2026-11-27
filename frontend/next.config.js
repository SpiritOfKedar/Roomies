/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'contribution.usercontent.google.com' },
    ],
  },
  // The landing page is a static HTML page (public/landing/index.html) built with the
  // taste-skill kit in public/assets; its scripts rewrite the DOM, so it is served as a
  // plain document rather than hydrated by React.
  async rewrites() {
    return [{ source: '/', destination: '/landing/index.html' }];
  },
};

module.exports = nextConfig;
