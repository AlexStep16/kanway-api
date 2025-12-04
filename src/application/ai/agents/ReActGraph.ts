import { confirmationConfigs } from '../configs/confirmationConfigs.ts'
import { MongoDBSaver } from '@/infrastructure/ai/MongoDBSaver.ts'
import { AgentStateAnnotation } from './AgentStateAnnotation.ts'
import { ToolMessage } from '@langchain/core/messages'
import { StateGraph, END, START, interrupt } from '@langchain/langgraph'
import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { RunnableConfig } from '@langchain/core/runnables'
import { getLastChatHistory } from '../helpers/getLastChatHistory.ts'
import { tools, toolsByName, hotTools } from '../helpers/toolsHelper.ts'
import { ReActSystem } from '../SystemMessages/ReAct.ts'
import getlastAIToolCallsMessage from '../helpers/getlastAIToolCallsMessage.ts'
import { buildConfirmationContext } from '../helpers/buildConfirmationContext.ts'
import { getLastIterationHistory } from '../helpers/getLastIterationHistory.ts'
import { SynthesizeSystem } from '../SystemMessages/Synthesize.ts'

async function ReActNode(state: typeof AgentStateAnnotation.State, config?: any) {
  const toolNamesToBind = state.relevant_tools || tools.map((t) => t.name)
  const toolObjects = toolNamesToBind.map((n) => toolsByName[n]).filter(Boolean)

  const activeBoardId = (config?.configurable as any)?.active_board_id
  const activeWorkspaceId = (config?.configurable as any)?.active_workspace_id
  const currentDate = (config?.configurable as any)?.current_date

  const chatHistory = getLastChatHistory(state.messages)

  if (!chatHistory) {
    // Handle case where there is no user message
    return {}
  }

  const prompt = ChatPromptTemplate.fromMessages([['system', ReActSystem], ...chatHistory])

  const ReActModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-120b',
    temperature: 0,
  })

  const chain = prompt.pipe(ReActModel.bindTools([...toolObjects, ...hotTools]))

  const response = await chain.invoke({
    board_id: activeBoardId,
    workspace_id: activeWorkspaceId,
    current_date: currentDate,
  })

  return {
    messages: [response],
  }
}

async function ReActCallToolNode(state: typeof AgentStateAnnotation.State) {
  await dispatchCustomEvent('calling_tools_start', {})

  const lastMessage: any = getlastAIToolCallsMessage(state.messages)
  const toolCalls: any[] = lastMessage?.tool_calls || []

  const relevantToolNames: string[] = state.relevant_tools || []

  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall: any) => {
      return callTool(toolCall, relevantToolNames, state.messages)
    })
  )

  await dispatchCustomEvent('calling_tools_end', {})

  return { messages: toolResults, relevant_tools: relevantToolNames }
}

async function ReActReviewToolCallsNode(
  state: typeof AgentStateAnnotation.State,
  config?: RunnableConfig
) {
  const lastMessage: any = getlastAIToolCallsMessage(state.messages)
  const toolCalls: any[] = lastMessage?.tool_calls || []
  const toolCallsToConfirm = toolCalls.filter((tc) => confirmationConfigs[tc.name])
  const data: any[] = []

  for (const tool of toolCallsToConfirm) {
    const { tip, contextData } = await buildConfirmationContext(tool, state, config)

    data.push({
      content: tip,
      context_data: contextData,
      proposed_tool_call: tool,
    })
  }

  const interruptData = {
    type: 'confirmation',
    data,
  }

  const review = interrupt(interruptData)

  const cancelledTools: string[] = []
  const confirmedTools: string[] = []

  if (review && review.toolsReview) {
    const toolsReview = review.toolsReview

    if (Array.isArray(toolsReview)) {
      for (const review of toolsReview) {
        if (review.decision === 'cancel') {
          cancelledTools.push(review.tool_call_id)
        } else if (review.decision === 'confirm') {
          confirmedTools.push(review.tool_call_id)
        }
      }
    }
  }

  return {
    tools_confirmed: confirmedTools,
    tools_cancelled: cancelledTools,
  }
}

async function SynthesizeResponseNode(state: typeof AgentStateAnnotation.State) {
  await dispatchCustomEvent('synthesize_start', {})

  const chatHistory = getLastIterationHistory(state.messages)

  if (!chatHistory) {
    // Handle case where there is no user message
    return {}
  }

  const prompt = ChatPromptTemplate.fromMessages([['system', SynthesizeSystem], ...chatHistory])

  const SynthesizeModel = new ChatFireworks({
    model: 'accounts/fireworks/models/gpt-oss-20b',
    temperature: 0,
  })

  const chain = prompt.pipe(SynthesizeModel)

  const response = await chain.invoke({})

  await dispatchCustomEvent('synthesize_end', {})

  return {
    messages: [response],
  }
}

async function ReActCallToolReviewNode(state: typeof AgentStateAnnotation.State) {
  await dispatchCustomEvent('calling_tools_start', {})

  const lastMessage: any = getlastAIToolCallsMessage(state.messages)
  const toolCalls: any[] = lastMessage?.tool_calls || []

  const confirmedToolIds = state.tools_confirmed || []
  const cancelledToolIds = state.tools_cancelled || []

  const confirmedTools = toolCalls.filter((tc) => confirmedToolIds.includes(tc.id))
  const cancelledTools = toolCalls.filter((tc) => cancelledToolIds.includes(tc.id))

  const toolResults = await Promise.all(
    confirmedTools.map(async (toolCall: any) => {
      return callTool(toolCall, [], state.messages)
    })
  )
  const toolCancellResults = cancelledTools.map((toolCall: any) => {
    return new ToolMessage({
      tool_call_id: toolCall.id,
      content: 'Пользователь отменил выполнение функции. Не предлагай выполнить её снова',
    })
  })

  await dispatchCustomEvent('calling_tools_end', {})

  return { messages: [...toolResults, ...toolCancellResults] }
}

export function compileReActAgent(checkpointer: MongoDBSaver) {
  // Создаем билдер графа с этим состоянием
  const graphBuilder: any = new StateGraph(AgentStateAnnotation)

  // NODES
  graphBuilder.addNode('ReAct', ReActNode)
  graphBuilder.addNode('ReActCallTool', ReActCallToolNode)
  graphBuilder.addNode('ReActReviewToolCalls', ReActReviewToolCallsNode)
  graphBuilder.addNode('ReActCallToolReview', ReActCallToolReviewNode)
  graphBuilder.addNode('SynthesizeResponse', SynthesizeResponseNode)

  // EDGES
  graphBuilder.addEdge(START, 'ReAct')

  graphBuilder.addEdge('ReActCallTool', 'ReAct')

  graphBuilder.addEdge('ReActReviewToolCalls', 'ReActCallToolReview')
  graphBuilder.addEdge('ReActCallToolReview', 'ReAct')
  graphBuilder.addEdge('SynthesizeResponse', END)

  graphBuilder.addConditionalEdges('ReAct', async (state: typeof AgentStateAnnotation.State) => {
    const lastMessage: any = state.messages[state.messages.length - 1]
    const toolCalls: any[] = lastMessage?.tool_calls || []

    if (toolCalls.length > 0) {
      if (toolCalls.some((tc) => tc.name === 'finishResponse')) return 'SynthesizeResponse'

      const toolCallsToConfirm = toolCalls.filter((tc) => confirmationConfigs[tc.name])

      if (toolCallsToConfirm.length > 0) return 'ReActReviewToolCalls'

      return 'ReActCallTool'
    }

    return 'SynthesizeResponse'
  })

  return graphBuilder.compile({ checkpointer })
}
