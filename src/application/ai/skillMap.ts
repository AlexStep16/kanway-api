import {
  BoardMoveSkill,
  BoardsCreateSkill,
  BoardsReadSkill,
  BoardsUpdateSkill,
} from './agent/skills/boardSkills.ts'
import {
  CategoriesCreateSkill,
  CategoriesReadSkill,
  CategoriesUpdateSkill,
  CategoryMoveSkill,
} from './agent/skills/categorySkills.ts'
import {
  TaskMoveSkill,
  TasksCreateSkill,
  TasksReadSkill,
  TasksUpdateSkill,
} from './agent/skills/taskSkills.ts'
import {
  WorkspaceMoveSkill,
  WorkspacesCreateSkill,
  WorkspacesReadSkill,
  WorkspacesUpdateSkill,
} from './agent/skills/workspaceSkills.ts'

export const skillMap = {
  TasksRead: TasksReadSkill,
  TasksCreate: TasksCreateSkill,
  TasksUpdate: TasksUpdateSkill,
  TaskMove: TaskMoveSkill,

  CategoriesRead: CategoriesReadSkill,
  CategoriesCreate: CategoriesCreateSkill,
  CategoriesUpdate: CategoriesUpdateSkill,
  CategoryMove: CategoryMoveSkill,

  BoardsRead: BoardsReadSkill,
  BoardsCreate: BoardsCreateSkill,
  BoardsUpdate: BoardsUpdateSkill,
  BoardMove: BoardMoveSkill,

  WorkspacesRead: WorkspacesReadSkill,
  WorkspacesCreate: WorkspacesCreateSkill,
  WorkspacesUpdate: WorkspacesUpdateSkill,
  WorkspaceMove: WorkspaceMoveSkill,
}
