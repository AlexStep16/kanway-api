import {
  BoardMoveSkill,
  BoardsArchiveSkill,
  BoardsCloneSkill,
  BoardsCreateSkill,
  BoardsDeleteSkill,
  BoardsReadSkill,
  BoardsRecoverSkill,
  BoardsUpdateSkill,
} from './agent/skills/boardSkills.ts'
import {
  CategoriesArchiveSkill,
  CategoriesCloneSkill,
  CategoriesCreateSkill,
  CategoriesDeleteSkill,
  CategoriesReadSkill,
  CategoriesRecoverSkill,
  CategoriesUpdateSkill,
  CategoryMoveSkill,
} from './agent/skills/categorySkills.ts'
import { UndoOperationSkill } from './agent/skills/generalSkills.ts'
import {
  TaskMoveSkill,
  TasksCreateSkill,
  TasksReadSkill,
  TasksUpdateSkill,
  TasksDeleteSkill,
  TasksArchiveSkill,
  TasksRecoverSkill,
  TasksCloneSkill,
} from './agent/skills/taskSkills.ts'
import {
  WorkspaceMoveSkill,
  WorkspacesArchiveSkill,
  WorkspacesCreateSkill,
  WorkspacesDeleteSkill,
  WorkspacesRecoverSkill,
  WorkspacesReadSkill,
  WorkspacesUpdateSkill,
  WorkspacesCloneSkill,
} from './agent/skills/workspaceSkills.ts'

export const skillMap = {
  UndoOperation: UndoOperationSkill,

  TasksRead: TasksReadSkill,
  TasksCreate: TasksCreateSkill,
  TasksUpdate: TasksUpdateSkill,
  TaskMove: TaskMoveSkill,
  TasksDelete: TasksDeleteSkill,
  TasksArchive: TasksArchiveSkill,
  TasksRecover: TasksRecoverSkill,
  TasksClone: TasksCloneSkill,

  CategoriesRead: CategoriesReadSkill,
  CategoriesCreate: CategoriesCreateSkill,
  CategoriesUpdate: CategoriesUpdateSkill,
  CategoryMove: CategoryMoveSkill,
  CategoriesDelete: CategoriesDeleteSkill,
  CategoriesArchive: CategoriesArchiveSkill,
  CategoriesRecover: CategoriesRecoverSkill,
  CategoriesClone: CategoriesCloneSkill,

  BoardsRead: BoardsReadSkill,
  BoardsCreate: BoardsCreateSkill,
  BoardsUpdate: BoardsUpdateSkill,
  BoardMove: BoardMoveSkill,
  BoardsDelete: BoardsDeleteSkill,
  BoardsArchive: BoardsArchiveSkill,
  BoardsRecover: BoardsRecoverSkill,
  BoardsClone: BoardsCloneSkill,

  WorkspacesRead: WorkspacesReadSkill,
  WorkspacesCreate: WorkspacesCreateSkill,
  WorkspacesUpdate: WorkspacesUpdateSkill,
  WorkspaceMove: WorkspaceMoveSkill,
  WorkspacesDelete: WorkspacesDeleteSkill,
  WorkspacesArchive: WorkspacesArchiveSkill,
  WorkspacesRecover: WorkspacesRecoverSkill,
  WorkspacesClone: WorkspacesCloneSkill,
}
