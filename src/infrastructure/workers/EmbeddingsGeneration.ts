import { Worker, type Job } from 'bullmq'
import * as Sentry from '@sentry/node'
import { Types } from 'mongoose'
import { initializeDependencies } from '../di/initializeDependencies.js'
import connectToDatabase from '../db/connectToDatabase.js'
import { OutboxEventStatusEnum } from '@/domain/enums/OutboxEventStatusEnum.js'

const dependencies = initializeDependencies()

await connectToDatabase()

export const EmbeddingsGeneration = new Worker(
  'embeddings-generation',
  async (
    job: Job<{
      task_ids?: string[]
      column_ids?: string[]
      board_ids?: string[]
      workspace_ids?: string[]
      user_id: Types.ObjectId
      outbox_event_id?: string
    }>,
  ) => {
    const { task_ids, column_ids, board_ids, workspace_ids, user_id, outbox_event_id } = job.data

    if (task_ids) {
      await dependencies.services.taskService.generateEmbeddingsForTasks(task_ids, user_id)
    }
    if (column_ids) {
      await dependencies.services.columnService.generateEmbeddingsForColumns(column_ids, user_id)
    }
    if (board_ids) {
      await dependencies.services.boardService.generateEmbeddingsForBoards(board_ids, user_id)
    }
    if (workspace_ids) {
      await dependencies.services.workspaceService.generateEmbeddingsForWorkspaces(
        workspace_ids,
        user_id,
      )
    }

    if (outbox_event_id) {
      await dependencies.services.outboxEventService.edit(
        {
          status: OutboxEventStatusEnum.COMPLETED,
          processed_at: new Date(),
        },
        {
          id: outbox_event_id,
        },
      )
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  },
)

EmbeddingsGeneration.on('failed', (job, err) => {
  Sentry.captureException(err, {
    extra: { jobId: job?.id, data: job?.data },
  })
})
