import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { CoderPrompt } from '../../prompts/CoderPrompt.ts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { skillMap } from '../../skillMap.ts'
import { toolSchemesMap } from '../../toolSchemesMap.ts'
import { entitySchemesMap } from '../../entitySchemesMap.ts'
import { SystemMessage } from 'node_modules/@langchain/core/dist/messages/system.js'
import { Types } from 'mongoose'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Configurable } from '../../interfaces/Configurable.ts'

export const makeCoderNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Работаю',
    })

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      coder_messages: [],
      coder_code: '',
      coder_ambiguities: null,
      internal_tool_call_results: [],
      pending_internal_tool_calls: [],
      coder_has_confirmations: false,
      coder_has_ambiguities: false,
      internal_tool_calls_have_error: false,
    }

    const { agentModel } = deps.models

    const history = getLastMessages(state.coder_messages, 50)
    const skillNames = state.related_skill_names || []

    const skills = skillNames.map((name) => skillMap[name as keyof typeof skillMap]).filter(Boolean)

    const relatedToolNames = new Set(skills.flatMap((skill) => skill.relatedTools))
    const relatedEntities = new Set(skills.flatMap((skill) => skill.relatedEntities))

    const availableTools = Array.from(relatedToolNames).map(
      (name) => toolSchemesMap[name as keyof typeof toolSchemesMap],
    )

    const availableSchemes = Array.from(relatedEntities).map(
      (name) => entitySchemesMap[name as keyof typeof entitySchemesMap],
    )

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', CoderPrompt],
      ...state.last_execution_messages,
      new SystemMessage(state.current_plan[state.current_step_index || 0]),
      ...history,
    ])

    const chain = prompt.pipe(agentModel)

    const response = await chain.invoke({
      available_tools: availableTools.join('\n'),
      available_schemes: availableSchemes.join('\n'),
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
    })

    outputs.coder_messages!.push(new SystemMessage(response.text))
    outputs.coder_code = response.text

    return outputs
  }
}
