import dayjs from 'dayjs'
import { ObjectId } from 'mongodb'
import { Types } from 'mongoose'

interface StringFilter {
  equal?: string
  not_equal?: string
  contains?: string
  starts_with?: string
  ends_with?: string
}

interface DateTimeFilter {
  equal?: string
  greater_than?: string
  greater_than_equal?: string
  less_than?: string
  less_than_equal?: string
}

interface NumberFilter {
  equal?: number
  not_equal?: number
  greater_than?: number
  greater_than_equal?: number
  less_than?: number
  less_than_equal?: number
}

interface ArrayFilter {
  contains?: string[]
  contains_all?: string[]
  equals?: string[]
}

interface Filter {
  ids?: string[]
  categoryIds?: string[]
  boardIds?: string[]
  workspaceIds?: string[]
  and?: Filter[]
  or?: Filter[]
  name?: StringFilter
  description?: StringFilter
  dueDate?: DateTimeFilter
  time?: DateTimeFilter
  isCompleted?: boolean
  categoryId?: string
  tags?: ArrayFilter
  color?: StringFilter
  order?: NumberFilter
}

export async function validateFilter(
  filter: Filter,
  entity_type: 'task' | 'category' | 'board' | 'workspace',
  user_id: Types.ObjectId
): Promise<string> {
  // Implement your validation logic here
  const baseFilterFields = ['ids', 'name', 'order', 'is_archived']

  const baseStringFilterFields = ['equal', 'not_equal', 'contains', 'starts_with', 'ends_with']
  const baseDateTimeFilterFields = [
    'equal',
    'greater_than',
    'greater_than_equal',
    'less_than',
    'less_than_equal',
  ]
  const baseNumberFilterFields = [
    'equal',
    'not_equal',
    'greater_than',
    'greater_than_equal',
    'less_than',
    'less_than_equal',
  ]
  const baseArrayFilterFields = ['contains', 'contains_all', 'equals']

  const availableTaskFilterFields = [
    ...baseFilterFields,
    'description',
    'due_date',
    'time',
    'is_completed',
    'category_ids',
    'board_ids',
    'workspace_ids',
    'tags',
    'color',
  ]
  const availableCategoryFilterFields = [...baseFilterFields, 'board_ids', 'workspace_ids']
  const availableBoardFilterFields = [...baseFilterFields, 'workspace_ids']
  const availableWorkspaceFilterFields = [...baseFilterFields]

  const filterFields = Object.keys(filter) as (keyof Filter)[]

  let errorMsg = ''

  if (filterFields.length === 0) {
    throw new Error('Filter cannot be empty.')
  }

  for (const field of filterFields) {
    if (['and', 'or'].includes(field.toLowerCase())) {
      if (!Array.isArray((filter as any)[field]) || (filter as any)[field].length === 0) {
        errorMsg += `${field} must be a non-empty array\n`
      }

      for (const subFilter of (filter as any)[field]) {
        errorMsg += validateFilter(subFilter, entity_type, user_id)
      }

      continue
    }

    if (entity_type === 'task' && !availableTaskFilterFields.includes(field)) {
      errorMsg += `Invalid filter field for task: ${field}\n`
    } else if (entity_type === 'category' && !availableCategoryFilterFields.includes(field)) {
      errorMsg += `Invalid filter field for category: ${field}\n`
    } else if (entity_type === 'board' && !availableBoardFilterFields.includes(field)) {
      errorMsg += `Invalid filter field for board: ${field}\n`
    } else if (entity_type === 'workspace' && !availableWorkspaceFilterFields.includes(field)) {
      errorMsg += `Invalid filter field for workspace: ${field}\n`
    }

    if (
      field === 'ids' ||
      field === 'categoryIds' ||
      field === 'boardIds' ||
      field === 'workspaceIds'
    ) {
      const filterObj = filter[field] as ArrayFilter
      if (filterObj && Array.isArray(filterObj)) {
        if (filterObj.length === 0) {
          errorMsg += `${field} must not be an empty array\n`
        } else {
          for (const id of filterObj) {
            if (!ObjectId.isValid(id)) {
              errorMsg += `${field} with value ${id} must be a valid ObjectId\n`
            } else {
              if (field === 'ids') {
                errorMsg += (
                  await BaseValidator.getExistEntitesErrors(id, entity_type, user_id)
                ).join('\n')
              } else if (field === 'categoryIds') {
                errorMsg += (
                  await BaseValidator.getExistEntitesErrors(id, 'category', user_id)
                ).join('\n')
              } else if (field === 'boardIds') {
                errorMsg += (await BaseValidator.getExistEntitesErrors(id, 'board', user_id)).join(
                  '\n'
                )
              } else if (field === 'workspaceIds') {
                errorMsg += (
                  await BaseValidator.getExistEntitesErrors(id, 'workspace', user_id)
                ).join('\n')
              }
            }
          }
        }
      }
    }

    if (field === 'name' || field === 'description' || field === 'color') {
      const filterObj = filter[field] as StringFilter

      if (filterObj) {
        const filterObjKeys = Object.keys(filterObj)
        const invalidFields = filterObjKeys.filter((key) => !baseStringFilterFields.includes(key))

        if (invalidFields.length > 0) {
          errorMsg += `Invalid string filter fields for ${field}: ${invalidFields.join(', ')}\n`
        }

        filterObjKeys.forEach((key) => {
          const value = (filterObj as any)[key]

          if (typeof value !== 'string') {
            try {
              value.toString()
            } catch {
              errorMsg += `${field}.${key} must be a string\n`
            }
          } else {
            if (value.trim().length === 0) {
              errorMsg += `${field}.${key} must not be an empty string\n`
            }
          }
        })
      }
    }

    if (field === 'dueDate' || field === 'time') {
      const filterObj = filter[field] as DateTimeFilter

      if (filterObj) {
        const filterObjKeys = Object.keys(filterObj)
        const invalidFields = filterObjKeys.filter((key) => !baseDateTimeFilterFields.includes(key))

        if (invalidFields.length > 0) {
          errorMsg += `Invalid date filter fields for ${field}: ${invalidFields.join(', ')}\n`
        }

        filterObjKeys.forEach((key) => {
          const value = (filterObj as any)[key]
          if (typeof value !== 'string') {
            errorMsg += `${field}.${key} must be a string\n`
          } else {
            if (value.trim().length === 0) {
              errorMsg += `${field}.${key} must not be an empty string\n`
            }

            if (field === 'dueDate' || field === 'time') {
              const validDateFormats = [
                'YYYY-MM-DDTHH:mm:ssZ',
                'YYYY-MM-DDTHH:mm:ss',
                'YYYY-MM-DDTHH:mm',
                'YYYY-MM-DD',
              ]

              const validTimeFormats = ['HH:mm:ss', 'HH:mm']

              if (field === 'dueDate') {
                if (!dayjs(value, validDateFormats, true).isValid()) {
                  errorMsg += `due_date must be in ISO formats (${validDateFormats.join(', ')})\n`
                }
              } else if (field === 'time') {
                if (!dayjs(value, validTimeFormats, true).isValid()) {
                  errorMsg += `time must be in formats (${validTimeFormats.join(', ')})\n`
                }
              }
            }
          }
        })
      }
    }

    if (field === 'isCompleted') {
      const value = filter[field]
      if (typeof value !== 'boolean') {
        if (typeof value === 'string') {
          if (['true', 'false'].includes((value as string).toLowerCase())) {
            errorMsg += `isCompleted must be a boolean\n`
          }
        } else {
          errorMsg += `isCompleted must be a boolean\n`
        }
      }
    }

    if (field === 'tags') {
      const filterObj = filter[field] as ArrayFilter

      if (filterObj) {
        const filterObjKeys = Object.keys(filterObj)
        const invalidFields = filterObjKeys.filter((key) => !baseArrayFilterFields.includes(key))

        if (invalidFields.length > 0) {
          errorMsg += `Invalid array filter fields for ${field}: ${invalidFields.join(', ')}\n`
        }

        filterObjKeys.forEach((key) => {
          const value = (filterObj as any)[key]
          if (!Array.isArray(value)) {
            errorMsg += `${field}.${key} must be an array\n`
          } else {
            if (value.length > 0) {
              value.forEach((item) => {
                if (typeof item !== 'string') {
                  errorMsg += `${field}.${key} must be an array of strings\n`
                }
              })
            }
          }
        })
      }
    }

    if (field === 'order') {
      const filterObj = filter[field] as NumberFilter

      if (filterObj) {
        const filterObjKeys = Object.keys(filterObj)
        const invalidFields = filterObjKeys.filter((key) => !baseNumberFilterFields.includes(key))

        if (invalidFields.length > 0) {
          errorMsg += `Invalid number filter fields for ${field}: ${invalidFields.join(', ')}\n`
        }

        filterObjKeys.forEach((key) => {
          const value = (filterObj as any)[key]
          if (typeof value !== 'number') {
            if (typeof value === 'string') {
              const parsedValue = parseFloat(value)
              if (isNaN(parsedValue)) {
                errorMsg += `${field}.${key} must be a number\n`
              }
            } else {
              errorMsg += `${field}.${key} must be a number\n`
            }
          }
        })
      }
    }

    if (field === 'color') {
      const filterObj = filter[field] as StringFilter

      if (filterObj) {
        const filterObjKeys = Object.keys(filterObj)

        filterObjKeys.forEach((key) => {
          const value = (filterObj as any)[key]

          if (typeof value === 'string') {
            if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
              errorMsg += `${field}.${key} must be a valid HEX color code starting with '#'\n`
            }
          }
        })
      }
    }
  }

  return errorMsg
}
