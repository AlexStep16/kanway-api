import express from 'express'

const router = express.Router()

router
  .post('/', TaskValidator.create, TaskController.createTask)
  .put('/:taskId', TaskValidator.edit, TaskController.editTask)
  .put('/clone/:taskId', TaskController.cloneTask)
  .put('/recover/:taskId', TaskController.recoverTask)
  .put('/transfer/:categoryId', TaskController.transferTasks)
  .put('/', TaskController.editTasks)
  .get('/deleted', TaskController.getDeletedTasks)
  .post('/:taskId/archive', TaskController.archiveTask)
  .delete('/:taskId', TaskController.deleteTask)

export default router
