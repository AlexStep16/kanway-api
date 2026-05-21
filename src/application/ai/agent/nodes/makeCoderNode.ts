import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { CoderPrompt } from '../../prompts/CoderPrompt.js'
import { Types } from 'mongoose'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { Configurable } from '../../interfaces/Configurable.js'
import { AIMessage } from '@langchain/core/messages'
import { extractPythonCode } from '@/utils/extractPythonCode.js'
import { STEP_MESSAGES } from '@/constants/STEP_MESSAGES.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import dayjs from 'dayjs'

export const makeCoderNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const stepIndex = state.coder_steps_count % STEP_MESSAGES.Coder.length
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: STEP_MESSAGES.Coder[stepIndex],
    })

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      coder_messages: state.coder_messages,
      coder_code: '',
      coder_ambiguities: null,
      internal_tool_call_results: [],
      pending_internal_tool_calls: [],
      coder_has_confirmations: false,
      coder_has_ambiguities: false,
      internal_tool_calls_have_error: false,
      coder_steps_count: state.coder_steps_count + 1,
    }

    const { CODER, CODER_PRO } = deps.models

    const modelToUse = configurable.modelType === ModelsEnum.KANWAY_PRO ? CODER_PRO : CODER

    const history = state.coder_messages.slice(-50)

    const prompt = ChatPromptTemplate.fromMessages([['system', CoderPrompt], ...history])

    const chain = prompt.pipe(modelToUse)

    const currentDate = dayjs(configurable.currentDate)

    const response = await chain.invoke({
      board: configurable.activeBoard,
      workspace: configurable.activeWorkspace,
      current_timestamp: configurable.currentDate,
      current_day_of_week: currentDate.format('dddd'),
      payload: state.current_payload,
    })

    outputs.coder_messages!.push(new AIMessage(response.text))
    outputs.coder_code = extractPythonCode(response.text)

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    return outputs
  }
}
