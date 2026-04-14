import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { CoderPrompt } from '../../prompts/CoderPrompt.ts'
import { Types } from 'mongoose'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { Configurable } from '../../interfaces/Configurable.ts'
import { AIMessage } from '@langchain/core/messages'
import { extractPythonCode } from '@/utils/extractPythonCode.ts'
import { STEP_MESSAGES } from '@/constants/STEP_MESSAGES.ts'

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

    const { coderModel } = deps.models

    const history = state.coder_messages.slice(-50)

    const prompt = ChatPromptTemplate.fromMessages([['system', CoderPrompt], ...history])

    const chain = prompt.pipe(coderModel)

    const response = await chain.invoke({
      board: configurable.activeBoard,
      workspace: configurable.activeWorkspace,
      current_date: configurable.currentDate,
      payload: state.current_payload,
    })

    outputs.coder_messages!.push(new AIMessage(response.text))
    outputs.coder_code = extractPythonCode(response.text)

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    return outputs
  }
}
