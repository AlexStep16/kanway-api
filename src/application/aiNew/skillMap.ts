import {
  BoardsCreateSkill,
  BoardsReadSkill,
  BoardsUpdateSkill,
} from './agent/skills/boardSkills.ts'
import {
  CategoriesCreateSkill,
  CategoriesReadSkill,
  CategoriesUpdateSkill,
} from './agent/skills/categorySkills.ts'
import { TasksCreateSkill, TasksReadSkill, TasksUpdateSkill } from './agent/skills/taskSkills.ts'
import {
  WorkspacesCreateSkill,
  WorkspacesReadSkill,
  WorkspacesUpdateSkill,
} from './agent/skills/workspaceSkills.ts'

export const skillMap = {
  TasksRead: TasksReadSkill,
  TasksCreate: TasksCreateSkill,
  TasksUpdate: TasksUpdateSkill,

  CategoriesRead: CategoriesReadSkill,
  CategoriesCreate: CategoriesCreateSkill,
  CategoriesUpdate: CategoriesUpdateSkill,

  BoardsRead: BoardsReadSkill,
  BoardsCreate: BoardsCreateSkill,
  BoardsUpdate: BoardsUpdateSkill,

  WorkspacesRead: WorkspacesReadSkill,
  WorkspacesCreate: WorkspacesCreateSkill,
  WorkspacesUpdate: WorkspacesUpdateSkill,
}
