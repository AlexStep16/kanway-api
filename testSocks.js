import https from 'https'
import { SocksProxyAgent } from 'socks-proxy-agent'

const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080')
https
  .get('https://api.openai.com/v1/models', { agent }, (res) => {
    console.log('Status:', res.statusCode)
  })
  .on('error', (e) => {
    console.error('Error:', e)
  })
