module.exports = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: {
    domains: ['localhost', 'yourstore.com']
  }
};
