import { z } from 'zod'
import { OperationLogCreationSchema } from './OperationLogCreationDTO.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const OperationLogEditSchema = OperationLogCreationSchema.partial().extend({
  id: z.string().regex(objectIdRegex),
})

export type OperationLogEditDTO = z.infer<typeof OperationLogEditSchema>
