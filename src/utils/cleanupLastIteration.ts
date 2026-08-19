import { RunnableConfig } from '@langchain/core/runnables'
import { CompiledStateGraph, StateSnapshot } from '@langchain/langgraph'
import type { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { HumanMessage, RemoveMessage } from '@langchain/core/messages'
import getLastHumanMessage from '@/application/ai/helpers/getLastHumanMessage.js'

export async function cleanupLastIteration(
  agent: CompiledStateGraph<any, any>,
  config: RunnableConfig,
  currentState: StateSnapshot,
) {
  const messages = currentState.values.messages || []

  const configurable = config.configurable as Configurable

  if (messages.length === 0) {
    messages.push(new HumanMessage(configurable.userMessage))

    return await agent.updateState(config, {
      messages,
    })
  }

  const lastHumanMessage = getLastHumanMessage(messages)

  if (!lastHumanMessage) {
    throw new Error('No user message found to retry from.')
  }

  const lastHumanIndex = messages.findIndex((msg: any) => msg.id === lastHumanMessage.id)

  const messagesToDelete = messages.slice(lastHumanIndex + 1)

  if (messagesToDelete.length > 0) {
    const removeRequests = messagesToDelete.map((msg: any) => new RemoveMessage({ id: msg.id }))

    await agent.updateState(config, {
      messages: removeRequests,
    })
  }
}
