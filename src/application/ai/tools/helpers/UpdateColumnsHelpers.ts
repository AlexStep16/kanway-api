import { getStringUpdateHumanReadableFilter, resolveStringUpdate } from './UpdateHelpers.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { UpdateColumnsDTO } from '../schemes/ColumnManager/UpdateColumnsScheme.js'
import { IColumn } from '@/domain/entities/IColumn.js'
import { ColumnEditDTO } from '@/application/dtos/ColumnEditDTO.js'

export function transformRawUpdateToDTO(
  columns: IColumn[],
  updates: UpdateColumnsDTO['updates'],
): ColumnEditDTO[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No column fields to update')
  }

  return columns.map((column) => {
    const update: ColumnEditDTO = {
      id: column.id.toString(),
    }

    if (typeof updates.name !== 'undefined') {
      const name = resolveStringUpdate(column.name, updates.name)

      if (name === null) {
        throw new Error('Column name cannot be removed')
      }

      update.name = name
    }

    return update
  })
}

export function transformRawUpdateToHumanReadableFilters(
  updates: UpdateColumnsDTO['updates'],
): ITextValue[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No column fields to update')
  }

  const filters: ITextValue[] = []

  if (typeof updates.name !== 'undefined') {
    filters.push(getStringUpdateHumanReadableFilter('название', updates.name))
  }

  return filters
}
