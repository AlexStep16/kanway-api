import { embeddingsQueue } from '@/infrastructure/queues/embeddingsQueue.js'
import * as Sentry from '@sentry/node'
import { OutboxEventStatusEnum } from '@/domain/enums/OutboxEventStatusEnum.js'
import OutboxEventRepository from '@/application/repositories/OutboxEventRepository.js'

export function startOutboxChangeStream(outboxEventRepository: OutboxEventRepository) {
  const changeStream = outboxEventRepository.watchPendingInserts()

  changeStream.on('change', async (change) => {
    if (change.operationType !== 'insert') return

    const event = change.fullDocument

    try {
      await embeddingsQueue.add(
        event.type,
        {
          ...event.payload,
          outbox_event_id: event._id.toString(),
        },
        {
          jobId: event._id.toString(),
          attempts: 3,
        },
      )

      await outboxEventRepository.updateMany(
        { _id: event._id },
        { status: OutboxEventStatusEnum.QUEUED, processedAt: new Date() },
      )
    } catch (error) {
      Sentry.captureException(error)
    }
  })
}
