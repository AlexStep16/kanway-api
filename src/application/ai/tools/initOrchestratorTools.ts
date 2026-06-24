import { tool } from '@langchain/core/tools'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { CallManagerScheme } from './schemes/CallManagerScheme.js'
import { Configurable } from '../interfaces/Configurable.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { UndoOperationsScheme } from './schemes/UndoOperationsScheme.js'

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

  return [callManagerAgent, undoOperations]
}
