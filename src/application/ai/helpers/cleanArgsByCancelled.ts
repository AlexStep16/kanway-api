import { ToolCall } from '@langchain/core/messages'

export function cleanArgsByCancelled(toolCall: ToolCall, cancelledEntityIds: string[]) {
  const cleanedArgs: any = JSON.parse(JSON.stringify(toolCall.args))

  if (toolCall.name === 'createTasks' && cleanedArgs?.tasks) {
    cleanedArgs.tasks = cleanedArgs.tasks.filter((t: any) => !cancelledEntityIds.includes(t.tempId))

    cleanedArgs.tasks.forEach((t: any) => {
      delete t.tempId
    })
  } else if (toolCall.name === 'createCategories' && cleanedArgs?.categories) {
    cleanedArgs.categories = cleanedArgs.categories.filter(
      (c: any) => !cancelledEntityIds.includes(c.tempId),
    )

    cleanedArgs.categories.forEach((c: any) => {
      delete c.tempId
    })
  } else if (toolCall.name === 'createBoards' && cleanedArgs?.boards) {
    cleanedArgs.boards = cleanedArgs.boards.filter(
      (b: any) => !cancelledEntityIds.includes(b.tempId),
    )

    cleanedArgs.boards.forEach((b: any) => {
      delete b.tempId
    })
  } else if (toolCall.name === 'createWorkspaces' && cleanedArgs?.workspaces) {
    cleanedArgs.workspaces = cleanedArgs.workspaces.filter(
      (w: any) => !cancelledEntityIds.includes(w.tempId),
    )

    cleanedArgs.workspaces.forEach((w: any) => {
      delete w.tempId
    })
  } else if (
    ['editTasks', 'editCategories', 'editBoards', 'editWorkspaces'].includes(toolCall.name) &&
    cleanedArgs?.filter?.ids
  ) {
    cleanedArgs.filter.ids = cleanedArgs.filter.ids.filter(
      (id: string) => !cancelledEntityIds.includes(id),
    )
  } else if (
    ['archiveTasks', 'archiveCategories', 'archiveBoards', 'archiveWorkspaces'].includes(
      toolCall.name,
    ) &&
    cleanedArgs?.ids
  ) {
    cleanedArgs.ids = cleanedArgs.ids.filter((id: string) => !cancelledEntityIds.includes(id))
  } else if (
    ['deleteTasks', 'deleteCategories', 'deleteBoards', 'deleteWorkspaces'].includes(
      toolCall.name,
    ) &&
    cleanedArgs?.ids
  ) {
    cleanedArgs.ids = cleanedArgs.ids.filter((id: string) => !cancelledEntityIds.includes(id))
  } else if (
    ['recoverTasks', 'recoverCategories', 'recoverBoards', 'recoverWorkspaces'].includes(
      toolCall.name,
    ) &&
    cleanedArgs?.ids
  ) {
    cleanedArgs.ids = cleanedArgs.ids.filter((id: string) => !cancelledEntityIds.includes(id))
  } else if (
    ['cloneTasks', 'cloneCategories', 'cloneBoards', 'cloneWorkspaces'].includes(toolCall.name) &&
    cleanedArgs?.ids
  ) {
    cleanedArgs.ids = cleanedArgs.ids.filter((id: string) => !cancelledEntityIds.includes(id))
  }

  return cleanedArgs
}
