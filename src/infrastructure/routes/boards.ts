import express from 'express'

const router = express.Router()

router
  .get('/', BoardController.getBoards)
  .get('/deleted', BoardController.getDeletedBoards)
  .get('/board/:boardId', BoardController.getBoard)
  .post('/', BoardValidator.create, BoardController.createBoard)
  .put('/:boardId', BoardValidator.edit, BoardController.editBoard)
  .post('/:boardId/archive', BoardController.archiveBoard)
  .delete('/:boardId', BoardController.deleteBoard)
  .put('/:boardId/transfer/:workspaceId', BoardController.transferBoardApi)
  .put('/clone/:boardId', BoardController.cloneBoard)
  .put('/recover/:boardId', BoardController.recoverBoard)

export default router
