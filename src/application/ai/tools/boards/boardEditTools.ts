import { tool } from '@langchain/core/tools'
import { BoardEditToolAdapter } from '../adapters/boards/BoardEditToolAdapter.ts'
import {
  EditBoardsNameSchema,
  EditBoardsOrderSchema,
  FavoriteBoardsSchema,
  MoveBoardsSchema,
} from '../schemes/update/boardEditSchemes.ts'

export function createEditBoardTools(adapter: BoardEditToolAdapter) {
  const updateBoardsName = tool((args, config) => adapter.updateBoardsName(args, config), {
    name: 'updateBoardsName',
    schema: EditBoardsNameSchema,
  })

  const updateBoardsOrder = tool((args, config) => adapter.updateBoardsOrder(args, config), {
    name: 'updateBoardsOrder',
    schema: EditBoardsOrderSchema,
  })

  const moveBoards = tool((args, config) => adapter.moveBoards(args, config), {
    name: 'moveBoards',
    schema: MoveBoardsSchema,
  })

  const favoriteBoards = tool((args, config) => adapter.favoriteBoards(args, config), {
    name: 'favoriteBoards',
    schema: FavoriteBoardsSchema,
  })

  return [updateBoardsName, updateBoardsOrder, moveBoards, favoriteBoards]
}
