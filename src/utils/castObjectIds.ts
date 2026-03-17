import { Types } from 'mongoose'

export const castObjectIds = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) return obj.map(castObjectIds)

  const processed: any = {}
  for (const key in obj) {
    const value = obj[key]

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      processed[key] = new Types.ObjectId(value)
    } else if (typeof value === 'object') {
      processed[key] = castObjectIds(value)
    } else {
      processed[key] = value
    }
  }
  return processed
}
