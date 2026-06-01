import { tool } from '@langchain/core/tools'
import { SuccessToolResult } from './helpers/ToolResult/SuccessToolResult.js'
import z from 'zod'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { CallTaskManagerScheme } from './schemes/CallTaskManagerScheme.js'
import { Configurable } from '../interfaces/Configurable.js'
import { RunnableConfig } from '@langchain/core/runnables'

export function initOrchestratorTools(
  dependencies: AgentDependencies,
  config: RunnableConfig<Configurable>,
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

  const getSelectionDetails = tool(
    async (data) => {
      const configurable = config.configurable as Configurable

      return await dependencies.services.generalToolsExecutor.getSelectionDetails(
        data.selection_id,
        configurable.user.id,
      )
    },
    {
      name: 'get_selection_details',
      schema: z
        .object({
          selection_id: z.string(),
        })
        .describe(
          'Use this tool to retrieve the actual text content (titles, descriptions, names) of a previously searched dataset (selection_id). ' +
            'Use it ONLY when the user asks you to read, analyze, summarize, or list the specific items in that selection. ' +
            'NEVER use it if you are simply passing the selection to a Sub-Agent for bulk mutation.',
        ),
    },
  )

  return [callTaskManagerAgent, getSelectionDetails]
}
