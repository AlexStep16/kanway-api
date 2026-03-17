import { tool } from '@langchain/core/tools'
import { TaskEditToolAdapter } from '../adapters/tasks/TaskEditToolAdapter.ts'
import {
  CompleteTasksSchema,
  EditTasksColorSchema,
  EditTasksDescriptionSchema,
  EditTasksDueDateSchema,
  EditTasksDueTimeSchema,
  EditTasksNameSchema,
  EditTasksOrderSchema,
  EditTasksTagsSchema,
  MoveTasksSchema,
} from '../schemes/update/taskEditSchemes.ts'

export function createEditTaskTools(adapter: TaskEditToolAdapter) {
  const updateTasksName = tool((args, config) => adapter.updateTasksName(args, config), {
    name: 'updateTasksName',
    schema: EditTasksNameSchema,
  })

  const updateTasksDescription = tool(
    (args, config) => adapter.updateTasksDescription(args, config),
    {
      name: 'updateTasksDescription',
      schema: EditTasksDescriptionSchema,
    },
  )

  const updateTasksDueDate = tool((args, config) => adapter.updateTasksDate(args, config), {
    name: 'updateTasksDueDate',
    schema: EditTasksDueDateSchema,
  })

  const updateTasksDueTime = tool((args, config) => adapter.updateTasksTime(args, config), {
    name: 'updateTasksDueTime',
    schema: EditTasksDueTimeSchema,
  })

  const updateTasksTags = tool((args, config) => adapter.updateTasksTags(args, config), {
    name: 'updateTasksTags',
    schema: EditTasksTagsSchema,
  })

  const updateTasksColor = tool((args, config) => adapter.updateTasksColor(args, config), {
    name: 'updateTasksColor',
    schema: EditTasksColorSchema,
  })

  const updateTasksOrder = tool((args, config) => adapter.updateTasksOrder(args, config), {
    name: 'updateTasksOrder',
    schema: EditTasksOrderSchema,
  })

  const moveTasks = tool((args, config) => adapter.moveTasks(args, config), {
    name: 'moveTasks',
    schema: MoveTasksSchema,
  })

  const completeTasks = tool((args, config) => adapter.completeTasks(args, config), {
    name: 'completeTasks',
    schema: CompleteTasksSchema,
  })

  return [
    updateTasksName,
    updateTasksDescription,
    updateTasksDueDate,
    updateTasksDueTime,
    updateTasksTags,
    updateTasksColor,
    updateTasksOrder,
    moveTasks,
    completeTasks,
  ]
}
