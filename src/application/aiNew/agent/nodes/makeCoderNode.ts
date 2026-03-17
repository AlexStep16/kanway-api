import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/aiNew/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/aiNew/agent/AgentStateAnnotation.ts'
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
      name: 'Думаю',
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

    const history = getLastMessages(state.coder_messages)
    const skillNames = state.related_skill_names || []

    const skills = skillNames.map((name) => skillMap[name as keyof typeof skillMap]).filter(Boolean)

    const relatedToolNames = skills.flatMap((skill) => skill.relatedTools)
    const relatedEntities = skills.flatMap((skill) => skill.relatedEntities)

    const availableTools = relatedToolNames.map(
      (name) => toolSchemesMap[name as keyof typeof toolSchemesMap],
    )

    const availableSchemes = relatedEntities.map(
      (name) => entitySchemesMap[name as keyof typeof entitySchemesMap],
    )

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', CoderPrompt],
      new SystemMessage(state.enriched_message),
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
