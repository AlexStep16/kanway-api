import { FilterQuery } from 'mongoose'

export function getFilterNameField(mongoFilter: FilterQuery<any>): string | null {
  if (typeof mongoFilter !== 'object' || mongoFilter === null) {
    return null
  }

  if ('name' in mongoFilter && typeof mongoFilter.name?.$eq === 'string') {
    return mongoFilter.name?.$eq
  }

  if ('$and' in mongoFilter && Array.isArray(mongoFilter.$and)) {
    for (const condition of mongoFilter.$and) {
      const nameField = getFilterNameField(condition)
      if (nameField) {
        return nameField
      }
    }
  }

  if ('$or' in mongoFilter && Array.isArray(mongoFilter.$or)) {
    for (const condition of mongoFilter.$or) {
      const nameField = getFilterNameField(condition)
      if (nameField) {
        return nameField
      }
    }
  }

  return null
}
