import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { CallManagerScheme } from './schemes/CallManagerScheme.js'
import { Configurable } from '../interfaces/Configurable.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { UndoOperationsScheme } from './schemes/UndoOperationsScheme.js'
import { GetSelectionDetailsScheme } from './schemes/GetSelectionDetailsScheme.js'

export function initOrchestratorTools(
  dependencies: AgentDependencies,
  runnableConfig: RunnableConfig<Configurable>,
) {
  const callManagerAgent = tool((data) => data, {
    name: 'call_manager_agent',
    schema: CallManagerScheme,
  })

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

  return [callManagerAgent, undoOperations, getSelectionDetails]
}
