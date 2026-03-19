import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Types } from 'mongoose'
import { ResponderPrompt } from '../../prompts/ResponderPrompt.ts'
import { SystemMessage } from '@langchain/core/messages'

export const makeResponderNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Готовлю ответ',
    })

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const history = getLastMessages(state.messages)
    const executionOutputs: SystemMessage[] = []

    if (state.execution_output) {
      executionOutputs.push(
        new SystemMessage(`Code execution result (print): ${state.execution_output}`),
      )
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', ResponderPrompt],
      ...history,
      ...executionOutputs,
    ])

    const chain = prompt.pipe(agentModel)

    await dispatchCustomEvent(CustomEvents.SYNTHESIZE_START, {})

    const response = await chain.invoke({
      aiName: configurable.aiName,
    })

    await dispatchCustomEvent(CustomEvents.FINAL_RESPONSE, response)

    return {
      messages: [response],
    }
  }
}
