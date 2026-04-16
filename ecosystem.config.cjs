// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'kanway-api',
      script: './dist/app.js',
      env: {
        NODE_ENV: 'production',
        HTTPS_PROXY: 'socks5h://127.0.0.1:1080',
        HTTP_PROXY: 'socks5h://127.0.0.1:1080',
      },
    },
    {
      name: 'kanway-worker-agent',
      script: './dist/infrastructure/workers/RunAgentWorker.js',
      env: {
        NODE_ENV: 'production',
        HTTPS_PROXY: 'socks5h://127.0.0.1:1080',
      },
    },
    {
      name: 'kanway-worker-subs',
      script: './dist/infrastructure/workers/SubscriptionWorker.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
