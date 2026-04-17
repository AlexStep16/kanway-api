import WebSocket from 'ws'
import { SocksProxyAgent } from 'socks-proxy-agent'

const openAIRealtimeUrl = 'wss://api.openai.com/v1/realtime?intent=transcription'
const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080')
console.log(process.env.OPENAI_API_KEY)

const openaiWs = new WebSocket(openAIRealtimeUrl, {
  agent: agent,
  headers: {
    Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
    'OpenAI-Beta': 'realtime=v1',
  },
})

openaiWs.on('open', () => {
  console.log('-----------------CONNNECTED-------------------')
  openaiWs.send(
    JSON.stringify({
      type: 'transcription_session.update',
      session: {
        input_audio_transcription: {
          language: 'ru',
          model: 'gpt-4o-transcribe',
          prompt: "Respond in Russian and don't hallucinate. Be as accurate as possible.",
        },
        turn_detection: {
          type: 'semantic_vad',
        },
      },
    }),
  )
})
openaiWs.on('error', (err) => console.error('Ошибка OpenAI WS:', err))
