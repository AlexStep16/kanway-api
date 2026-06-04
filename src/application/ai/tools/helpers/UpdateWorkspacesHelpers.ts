import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { getStringUpdateHumanReadableFilter, resolveStringUpdate } from './UpdateHelpers.js'
import { IWorkspace } from '@/domain/entities/IWorkspace.js'
import { UpdateWorkspacesDTO } from '../schemes/WorkspaceManager/UpdateWorkspacesScheme.js'
import { WorkspaceEditDTO } from '@/application/dtos/WorkspaceEditDTO.js'
import { SearchFilterOperator } from '@/application/types/SearchFilter.js'
import { BASE_COLORS, BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'
import { getWorkspaceRuColorName } from '@/utils/getWorkspaceRuColorName.js'

function resolveWorkspaceColorNameToValue(colorName: string): (typeof BASE_COLORS)[number] {
  const normalizedColorName = colorName.toLowerCase()

  for (const [colorValue, colorData] of Object.entries(BASE_COLORS_MAP)) {
    if (colorData.name.toLowerCase() === normalizedColorName) {
      return colorValue as (typeof BASE_COLORS)[number]
    }
  }

  throw new Error(`Invalid color value for workspace update: ${colorName}`)
}

export function transformRawUpdateToDTO(
  workspaces: IWorkspace[],
  updates: UpdateWorkspacesDTO['updates'],
): WorkspaceEditDTO[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No workspace fields to update')
  }

  return workspaces.map((workspace) => {
    const update: WorkspaceEditDTO = {
      id: workspace.id.toString(),
    }

    if (typeof updates.name !== 'undefined') {
      const name = resolveStringUpdate(workspace.name, updates.name)

      if (name === null) {
        throw new Error('Workspace name cannot be removed')
      }

      update.name = name
    }

    if (typeof updates.is_favorite !== 'undefined') {
      update.isFavorite = updates.is_favorite
    }

    if (typeof updates.color !== 'undefined') {
      update.color = resolveWorkspaceColorNameToValue(updates.color)
    }

    return update
  })
}

export function getWorkspaceColorHumanFilter(operator: SearchFilterOperator): ITextValue {
  const colorName = operator.eq || operator.neq

  const colorNameValueMap = new Map<string, string>()

  for (const [key, value] of Object.entries(BASE_COLORS_MAP)) {
    colorNameValueMap.set(value.name.toLowerCase(), key)
  }

  if (typeof colorName !== 'string' || !colorNameValueMap.has(colorName.toLowerCase())) {
    throw new Error(`Invalid color value for workspace filter: ${JSON.stringify(operator)}`)
  }

  const ruColorName = getWorkspaceRuColorName(
    colorNameValueMap.get(colorName.toLowerCase()) as keyof typeof BASE_COLORS_MAP,
  )

  if (operator.eq) {
    return { text: 'Цвет', value: ruColorName }
  } else {
    return { text: 'Цвет не', value: ruColorName }
  }
}

export function getWorkspaceColorHumanUpdate(colorName: string | null): ITextValue {
  if (colorName === null) {
    return { text: 'Убрать цвет' }
  }

  const ruColorName = getWorkspaceRuColorName(resolveWorkspaceColorNameToValue(colorName))

  return { text: 'Цвет', value: ruColorName }
}

export function transformRawUpdateToHumanReadableFilters(
  updates: UpdateWorkspacesDTO['updates'],
): ITextValue[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No workspace fields to update')
  }

  const filters: ITextValue[] = []

  if (typeof updates.name !== 'undefined') {
    filters.push(getStringUpdateHumanReadableFilter('название', updates.name))
  }

  if (typeof updates.is_favorite !== 'undefined') {
    filters.push({
      text: updates.is_favorite ? 'Добавить в избранное' : 'Убрать из избранного',
    })
  }

  if (typeof updates.color !== 'undefined') {
    if (typeof updates.color !== 'string' && updates.color !== null) {
      throw new Error(`Invalid color value for workspace update: ${JSON.stringify(updates.color)}`)
    }

    filters.push(getWorkspaceColorHumanUpdate(updates.color))
  }

  return filters
}
