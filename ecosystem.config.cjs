const path = require('path')
const envConfig =
  require('dotenv').config({
    path: path.join(__dirname, '.env'),
  }).parsed || {}

// eslint-disable-next-line
module.exports = {
  apps: [
    {
      name: 'kanway-api',
      script: './dist/app.js',
      env_file: '.env',
      env: {
        ...envConfig,
      },
    },
    {
      name: 'kanway-worker-agent',
      script: './dist/infrastructure/workers/RunAgentWorker.js',
      env_file: '.env',
      env: {
        ...envConfig,
      },
    },
    {
      name: 'kanway-worker-subs',
      script: './dist/infrastructure/workers/SubscriptionWorker.js',
      env_file: '.env',
      env: {
        ...envConfig,
      },
    },
    {
      name: 'kanway-worker-embeddings',
      script: './dist/infrastructure/workers/EmbeddingsGeneration.js',
      env_file: '.env',
      env: {
        ...envConfig,
      },
    },
  ],
}
