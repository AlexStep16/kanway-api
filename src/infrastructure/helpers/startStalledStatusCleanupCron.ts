import * as Sentry from '@sentry/node'
import cron from 'node-cron'
import { ChatMessageService } from '@/application/services/ChatMessageService.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import ChatMessage from '@/domain/models/ChatMessage.js'
import { IUser } from '@/domain/entities/IUser.js'

export function startStalledStatusCleanupCron(chatMessageService: ChatMessageService) {
  return cron.schedule('*/3 * * * *', async () => {
    const timeoutThreshold = new Date(Date.now() - 3 * 60 * 1000)

    try {
      const stalledMessages = await ChatMessage.find({
        role: 'status',
        $or: [
          { 'content.state': StatusStatesEnum.IN_PROGRESS },
          { 'content.state': 'in_progress' },
        ],
        updatedAt: { $lt: timeoutThreshold },
      }).lean()

      if (!stalledMessages.length) return

      for (const message of stalledMessages) {
        try {
          const currentContent = (message.content || {}) as IStatus

          const updatedContent = {
            ...currentContent,
            state: StatusStatesEnum.FAILED,
            statusText: 'Инициализация агента',
            error: 'Время ожидания ответа истекло. Попробуйте повторить запрос.',
          }

          await chatMessageService.edit(
            {
              content: updatedContent,
            },
            { id: message._id.toString() },
            { id: message.user_id } as IUser,
          )
        } catch (itemError) {
          Sentry.captureException(itemError, {
            extra: { stalledMessageId: message._id, userId: message.user_id },
          })
        }
      }
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
