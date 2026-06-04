import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/ToolResult/SuccessToolResult.js'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { CallTaskManagerScheme } from './schemes/CallTaskManagerScheme.js'
import { Configurable } from '../interfaces/Configurable.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { CallCategoryManagerScheme } from './schemes/CallCategoryManagerScheme.js'
import { CallBoardManagerScheme } from './schemes/CallBoardManagerScheme.js'
import { CallWorkspaceManagerScheme } from './schemes/CallWorkspaceManagerScheme.js'
import { UndoOperationsScheme } from './schemes/UndoOperationsScheme.js'
import { GetSelectionDetailsScheme } from './schemes/GetSelectionDetailsScheme.js'

export function initOrchestratorTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig<Configurable>,
) {
  const callTaskManagerAgent = tool(
    () => {
      return new SuccessToolResult('')
    },
    {
      name: 'call_task_manager_agent',
      schema: CallTaskManagerScheme,
    },
  )

  const callCategoryManagerAgent = tool(
    () => {
      return new SuccessToolResult('')
    },
    {
      name: 'call_category_manager_agent',
      schema: CallCategoryManagerScheme,
    },
  )

  const callBoardManagerAgent = tool(
    () => {
      return new SuccessToolResult('')
    },
    {
      name: 'call_board_manager_agent',
      schema: CallBoardManagerScheme,
    },
  )

  const callWorkspaceManagerAgent = tool(
    () => {
      return new SuccessToolResult('')
    },
    {
      name: 'call_workspace_manager_agent',
      schema: CallWorkspaceManagerScheme,
    },
  )

  const undoOperations = tool(
    async (data, config) => {
      return await dependencies.services.generalToolsExecutor.undoOperations(
        data.log_ids,
        runnableConfig,
        config.context,
      )
    },
    {
      name: 'undo_operations',
      schema: UndoOperationsScheme,
    },
  )

  const getSelectionDetails = tool(
    async (data) => {
      return await dependencies.services.generalToolsExecutor.getSelectionDetails(
        data,
        runnableConfig,
      )
    },
    {
      name: 'get_selection_details',
      schema: GetSelectionDetailsScheme,
    },
  )

  return [
    callTaskManagerAgent,
    callCategoryManagerAgent,
    callBoardManagerAgent,
    callWorkspaceManagerAgent,
    undoOperations,
    getSelectionDetails,
  ]
}
