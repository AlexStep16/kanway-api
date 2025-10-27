import express from 'express'

const router = express.Router()

router
  .get('/', WorkspaceController.getWorkspaces)
  .get('/deleted', WorkspaceController.getDeletedWorkspaces)
  .get('/check/exist', WorkspaceController.checkWorkspacesExist)
  .post('/', WorkspaceValidator.create, WorkspaceController.createWorkspace)
  .put('/:workspaceId', WorkspaceValidator.edit, WorkspaceController.editWorkspace)
  .put('/clone/:workspaceId', WorkspaceController.cloneWorkspace)
  .post('/:workspaceId/archive', WorkspaceController.archiveWorkspace)
  .delete('/:workspaceId', WorkspaceController.deleteWorkspace)
  .put('/recover/:workspaceId', WorkspaceController.recoverWorkspace)

export default router
