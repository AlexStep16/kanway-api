import { getStringUpdateHumanReadableFilter, resolveStringUpdate } from './UpdateHelpers.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { UpdateCategoriesDTO } from '../schemes/CategoryManager/UpdateCategoriesScheme.js'
import { ICategory } from '@/domain/entities/ICategory.js'
import { CategoryEditDTO } from '@/application/dtos/CategoryEditDTO.js'

export function transformRawUpdateToDTO(
  categories: ICategory[],
  updates: UpdateCategoriesDTO['updates'],
): CategoryEditDTO[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No category fields to update')
  }

  return categories.map((category) => {
    const update: CategoryEditDTO = {
      id: category.id.toString(),
    }

    if (typeof updates.name !== 'undefined') {
      const name = resolveStringUpdate(category.name, updates.name)

      if (name === null) {
        throw new Error('Category name cannot be removed')
      }

      update.name = name
    }

    return update
  })
}

export function transformRawUpdateToHumanReadableFilters(
  updates: UpdateCategoriesDTO['updates'],
): ITextValue[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No category fields to update')
  }

  const filters: ITextValue[] = []

  if (typeof updates.name !== 'undefined') {
    filters.push(getStringUpdateHumanReadableFilter('название', updates.name))
  }

  return filters
}
