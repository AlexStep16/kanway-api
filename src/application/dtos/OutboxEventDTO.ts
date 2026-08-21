import { z } from 'zod'
import { OutboxEventTypeEnum } from '@/domain/enums/OutboxEventTypeEnum.js'
import { OutboxEventStatusEnum } from '@/domain/enums/OutboxEventStatusEnum.js'

export const OutboxEventSchema = z.object({
  type: z.enum(OutboxEventTypeEnum),
  payload: z.record(z.string(), z.any()),
  status: z.enum(OutboxEventStatusEnum).optional(),
  processed_at: z.date().optional(),
})

export type OutboxEventDTO = z.infer<typeof OutboxEventSchema>
