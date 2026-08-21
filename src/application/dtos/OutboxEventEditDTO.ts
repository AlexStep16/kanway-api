import { z } from 'zod'
import { OutboxEventSchema } from './OutboxEventDTO.js'

export const OutboxEventEditSchema = OutboxEventSchema.partial()

export type OutboxEventEditDTO = z.infer<typeof OutboxEventEditSchema>
