import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { SystemMessage } from '@langchain/core/messages'
import { initSkillerTools } from '../../tools/initSkillerTools.ts'
import { skillMap } from '../../skillMap.ts'
import { SkillerPrompt } from '../../prompts/SkillerPrompt.ts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'

export const makeSkillerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Выбираю инструменты',
    })

    const { agentModel } = deps.models

    const skillerTools = initSkillerTools()

    let availableSkills = ''

    for (const skillName in skillMap) {
      const skill = skillMap[skillName as keyof typeof skillMap]

      availableSkills = availableSkills.concat(`- ${skill.name}: ${skill.description}\n`)
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SkillerPrompt],
      new SystemMessage(state.current_plan[state.current_step_index || 0]),
      ...getLastMessages(state.skiller_messages, 50),
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(skillerTools))

    const response = await chain.invoke({
      available_skills: availableSkills,
    })

    return {
      tool_calls: response.tool_calls || [],
    }
  }
}
