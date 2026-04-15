import { Types } from 'mongoose'
import { z } from 'zod'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const OperationLogCreationSchema = z.object({
  operationType: z.enum(OperationTypesEnum),
  collectionName: z.string().min(3).max(100),
  entitiesBefore: z.array(z.any()).optional(),
  entitiesAfter: z.array(z.any()).optional(),
  dependencies: z.array(z.string().regex(objectIdRegex)).transform((ids: string[]) => {
    return ids.map((id) => new Types.ObjectId(id))
  }),
  status: z.enum(OperationLogStatusesEnum).optional(),
  selectedIds: z.array(z.string()).optional(),
})

export type OperationLogCreationDTO = z.infer<typeof OperationLogCreationSchema>
