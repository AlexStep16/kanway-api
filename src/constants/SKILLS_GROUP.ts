import { SearchEntities } from '@/application/ai/agent/skills/baseSkills.ts'
import * as TaskSkills from '@/application/ai/agent/skills/taskSkills.ts'
import * as BoardSkills from '@/application/ai/agent/skills/boardSkills.ts'
import * as CategorySkills from '@/application/ai/agent/skills/categorySkills.ts'
import * as WorkspaceSkills from '@/application/ai/agent/skills/workspaceSkills.ts'

export const SKILLS_GROUP = {
  SEARCH: [
    SearchEntities,
    TaskSkills.SearchRelevantTasks,
    BoardSkills.SearchRelevantBoards,
    CategorySkills.SearchRelevantCategories,
    WorkspaceSkills.SearchRelevantWorkspaces,
  ],
  TASK_BASE: [
    TaskSkills.CloneTasks,
    TaskSkills.CreateTasks,
    TaskSkills.MoveTasks,
    TaskSkills.TaskLifecycle,
  ],
  TASK_UPDATE: [
    TaskSkills.UpdateTasksName,
    TaskSkills.UpdateTasksDescription,
    TaskSkills.UpdateTasksDueDate,
    TaskSkills.UpdateTasksDueTime,
    TaskSkills.UpdateTasksTags,
    TaskSkills.UpdateTasksColor,
    TaskSkills.UpdateTasksOrder,
  ],
  CATEGORY_BASE: [
    CategorySkills.CloneCategories,
    CategorySkills.CreateCategories,
    CategorySkills.MoveCategories,
    CategorySkills.CategoryLifecycle,
  ],
  CATEGORY_UPDATE: [CategorySkills.UpdateCategoriesName, CategorySkills.UpdateCategoriesOrder],
  BOARD_BASE: [
    BoardSkills.CloneBoards,
    BoardSkills.CreateBoards,
    BoardSkills.MoveBoards,
    BoardSkills.BoardLifecycle,
  ],
  BOARD_UPDATE: [
    BoardSkills.UpdateBoardsName,
    BoardSkills.UpdateBoardsOrder,
    BoardSkills.FavoriteBoards,
  ],
  WORKSPACE_BASE: [
    WorkspaceSkills.CloneWorkspaces,
    WorkspaceSkills.CreateWorkspaces,
    WorkspaceSkills.WorkspaceLifecycle,
  ],
  WORKSPACE_UPDATE: [
    WorkspaceSkills.UpdateWorkspacesName,
    WorkspaceSkills.UpdateWorkspacesOrder,
    WorkspaceSkills.FavoriteWorkspaces,
    WorkspaceSkills.UpdateWorkspacesColor,
  ],
}
