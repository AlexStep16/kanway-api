import WebSocket from 'ws'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { Server, Socket } from 'socket.io'
import { initializeDependencies } from '../di/initializeDependencies.js'

const dependencies = initializeDependencies()

export function setupOpenAISocket(io: Server) {
  const openAIRealtimeUrl = 'wss://api.openai.com/v1/realtime?intent=transcription'
  const agent = new SocksProxyAgent('socks5h://127.0.0.1:1080')

  io.on('connection', (socket: Socket) => {
    let recordingTimer: NodeJS.Timeout | null = null
    let isForwarding = false

    const stopAndCommit = (reason: string) => {
      if (!isForwarding) return
      isForwarding = false
      console.log('Останавливаем и коммитим аудио. Причина:', reason)
      if (recordingTimer) clearTimeout(recordingTimer)

      if (openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      }

      socket.emit('recording-stopped-by-server', { reason })
    }

    const openaiWs = new WebSocket(openAIRealtimeUrl, {
      agent: process.env.NODE_ENV === 'development' ? undefined : agent,
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'OpenAI-Beta': 'realtime=v1',
      },
    })

    openaiWs.on('open', () => {
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
      try {
        const response = JSON.parse(data)

        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          isForwarding = false
          if (recordingTimer) clearTimeout(recordingTimer)
        }

        socket.emit('openai-response', response)

        if (response.usage) {
          const tokensUsed = response.usage.total_tokens || 0

          dependencies.services.userService.appendUsedAudioTokens(tokensUsed, socket.data.userId)
        }
      } catch {
        console.log('Не удалось разобрать ответ OpenAI:', data)
      }
    })

    openaiWs.on('close', () => {
      socket.disconnect(true)
    })

    socket.on('audio-chunk', (data: Buffer) => {
      const base64Chunk = data.toString('base64')

      if (!isForwarding) {
        isForwarding = true

        recordingTimer = setTimeout(() => {
          stopAndCommit('Лимит времени')
        }, 30000)
      }

      if (isForwarding && openaiWs?.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Chunk,
          }),
        )
      }
    })

    socket.on('commit-audio', () => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      }
      stopAndCommit('Пользователь нажал стоп')
    })

    socket.on('disconnect', () => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
        openaiWs.send(JSON.stringify({ type: 'response.create' }))

        setTimeout(() => openaiWs.close(), 1000)
      }
      stopAndCommit('Пользователь отключился')
    })
  })
}
