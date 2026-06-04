import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { BoardEditDTO } from '@/application/dtos/BoardEditDTO.js'
import { UpdateBoardsDTO } from '../schemes/BoardManager/UpdateBoardsScheme.js'
import { IBoard } from '@/domain/entities/IBoard.js'
import { getStringUpdateHumanReadableFilter, resolveStringUpdate } from './UpdateHelpers.js'

export function transformRawUpdateToDTO(
  boards: IBoard[],
  updates: UpdateBoardsDTO['updates'],
): BoardEditDTO[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No board fields to update')
  }

  return boards.map((board) => {
    const update: BoardEditDTO = {
      id: board.id.toString(),
    }

    if (typeof updates.name !== 'undefined') {
      const name = resolveStringUpdate(board.name, updates.name)

      if (name === null) {
        throw new Error('Board name cannot be removed')
      }

      update.name = name
    }

    if (typeof updates.is_favorite !== 'undefined') {
      update.isFavorite = updates.is_favorite
    }

    return update
  })
}

export function transformRawUpdateToHumanReadableFilters(
  updates: UpdateBoardsDTO['updates'],
): ITextValue[] {
  if (Object.values(updates).every((value) => typeof value === 'undefined')) {
    throw new Error('No board fields to update')
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

  return filters
}
