import WebSocket, { WebSocketServer } from 'ws'
import { SocksProxyAgent } from 'socks-proxy-agent'

export function startOpenAIProxy(port: number) {
  const wss = new WebSocketServer({ port })
  const openAIRealtimeUrl = 'wss://api.openai.com/v1/realtime?intent=transcription'
  const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080')
  console.log('Ключ OpenAI:', process.env.OPENAI_API_KEY ? 'Присутствует' : 'ОТСУТСТВУЕТ')
  function floatTo16BitPCM(float32Buffer: Float32Array): Buffer {
    const pcm16Buffer = Buffer.alloc(float32Buffer.length * 2)
    for (let i = 0; i < float32Buffer.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Buffer[i]))
      s = s < 0 ? s * 0x8000 : s * 0x7fff
      pcm16Buffer.writeInt16LE(s, i * 2)
    }
    return pcm16Buffer
  }

  wss.on('connection', (clientWs) => {
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

    openaiWs.on('message', (data: string) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          const response = JSON.parse(data)

          clientWs.send(JSON.stringify(response))
        } catch {
          console.log('Не удалось разобрать ответ OpenAI:', data)
        }
      }
    })

    openaiWs.on('close', (code) => {
      console.log('Соединение с OpenAI закрыто. Код:', code)
      try {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(code)
      } catch {
        clientWs.close()
      }
    })

    clientWs.on('message', (message: any) => {
      if (openaiWs.readyState !== WebSocket.OPEN) return

      if (Buffer.isBuffer(message)) {
        const alignedBuffer = Buffer.from(message)

        const float32Array = new Float32Array(
          alignedBuffer.buffer,
          alignedBuffer.byteOffset,
          alignedBuffer.length / 4,
        )

        const pcm16Buffer = floatTo16BitPCM(float32Array)

        const base64Chunk = pcm16Buffer.toString('base64')

        openaiWs.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Chunk,
          }),
        )
      } else {
        try {
          const command = JSON.parse(message)
          if (command.action === 'commit') {
            openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
          }
        } catch {
          console.log('Не удалось разобрать команду клиента:', message)
        }
      }
    })

    clientWs.on('close', () => {
      console.log('Клиент отключился.')
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
        openaiWs.send(JSON.stringify({ type: 'response.create' }))

        setTimeout(() => openaiWs.close(), 1000)
      }
    })
  })
}
