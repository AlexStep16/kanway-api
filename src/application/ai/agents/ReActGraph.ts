import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentStateAnnotation } from '@application/ai/agents/AgentStateAnnotation.ts'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ToolCall,
  ToolMessage,
} from '@langchain/core/messages'
import { StateGraph, END, START, interrupt } from '@langchain/langgraph'
import { ChatFireworks } from '@langchain/community/chat_models/fireworks'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { RunnableConfig } from '@langchain/core/runnables'
import { getLastChatHistory } from '@application/ai/helpers/getLastChatHistory.ts'
import { ReActSystem } from '@application/ai/SystemMessages/ReAct.ts'
import { buildConfirmationContext } from '@application/ai/helpers/buildConfirmationContext.ts'
import { getLastIterationHistory } from '@application/ai/helpers/getLastIterationHistory.ts'
import { SynthesizeSystem } from '@application/ai/SystemMessages/Synthesize.ts'
import getlastAIToolCallsMessage from '@application/ai/helpers/getLastAIToolCallsMessage.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'
import { confirmationConfigs } from '@application/ai/configs/confirmationConfigs.ts'

const dependencies = initializeDependencies()

async function ReActNode(state: typeof AgentStateAnnotation.State, config?: any) {
  const tools = dependencies.services.toolExecutorService.tools
  const toolsByName = dependencies.services.toolExecutorService.toolsByName
  const hotTools = dependencies.services.toolExecutorService.hotTools

  const toolNamesToBind = state.relevant_tools || tools.map((t) => t.name)
  const toolObjects = toolNamesToBind.map((n) => toolsByName[n]).filter(Boolean)

  const activeBoardId = (config?.configurable as any)?.activeBoardId
  const activeWorkspaceId = (config?.configurable as any)?.activeWorkspaceId
  const currentDate = (config?.configurable as any)?.currentDate

  const chatHistory = getLastChatHistory(state.messages)

  if (!chatHistory) {
    // Handle case where there is no user message
    return {}
  }

  const prompt = ChatPromptTemplate.fromMessages([['system', ReActSystem], ...chatHistory])

  const ReActModel = new ChatFireworks({
    model: 'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct',
    temperature: 0,
  })

  const chain = prompt.pipe(ReActModel.bindTools([...toolObjects, ...hotTools]))

  const response = await chain.invoke({
    boardId: activeBoardId,
    workspaceId: activeWorkspaceId,
    currentDate: currentDate,
  })

  return {
    messages: [response],
  }
}

async function ReActCallToolNode(state: typeof AgentStateAnnotation.State, config: RunnableConfig) {
  await dispatchCustomEvent(AgentRoles.CALLING_TOOLS, null)

  const lastMessage: any = getlastAIToolCallsMessage(state.messages)
  const toolCalls: any[] = lastMessage?.tool_calls || []

  const relevantToolNames: string[] = state.relevant_tools || []

  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall: ToolCall) => {
      return dependencies.services.toolExecutorService.executeTool(
        toolCall,
        relevantToolNames,
        state.messages,
        config.configurable?.user
      )
    })
  )

  return { messages: toolResults, relevant_tools: relevantToolNames }
}

async function ReActReviewToolCallsNode(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig
) {
  const lastMessage: AIMessage | null = getlastAIToolCallsMessage(state.messages)
  const toolCalls: ToolCall[] = lastMessage?.tool_calls || []
  const toolCallsToConfirm = toolCalls.filter((tc) => confirmationConfigs[tc.name])
  const data: any[] = []

  for (const toolCall of toolCallsToConfirm) {
    const { title, contextData, entityType } = await buildConfirmationContext(
      toolCall,
      state,
      config
    )

    data.push({
      title,
      context: contextData,
      entityType,
      toolCall,
    })
  }

  const interruptData = {
    type: 'confirmation',
    data,
  }

  const review = interrupt(interruptData)

  return {
    tools_confirmed: review.toolsConfirmed,
    tools_cancelled: review.toolsCancelled,
  }
}

async function SynthesizeResponseNode(state: typeof AgentStateAnnotation.State) {
  await dispatchCustomEvent(AgentRoles.SYNTHESIZE_START, null)

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

  return {
    messages: [response],
  }
}

async function ReActCallToolReviewNode(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig
) {
  await dispatchCustomEvent(AgentRoles.CALLING_TOOLS, null)

  const lastMessage: AIMessage | null = getlastAIToolCallsMessage(state.messages)
  const toolCalls: ToolCall[] = lastMessage?.tool_calls || []

  const confirmedToolIds = state.tools_confirmed || []
  const cancelledToolIds = state.tools_cancelled || []

  const confirmedTools = toolCalls.filter((tc) => tc.id && confirmedToolIds.includes(tc.id))
  const cancelledTools = toolCalls.filter((tc) => tc.id && cancelledToolIds.includes(tc.id))

  const toolResults = await Promise.all(
    confirmedTools.map(async (toolCall: ToolCall) => {
      return dependencies.services.toolExecutorService.executeTool(
        toolCall,
        [],
        state.messages,
        config.configurable?.user
      )
    })
  )

  const toolCancelResults = cancelledTools.map((toolCall: ToolCall) => {
    return new ToolMessage({
      tool_call_id: toolCall.id || '',
      content: 'Пользователь отменил выполнение функции. Не предлагай выполнить её снова',
    })
  })

  return { messages: [...toolResults, ...toolCancelResults] }
}

export function compileReActAgent(checkpointer: MongoDBSaver) {
  // Создаем билдер графа с этим состоянием
  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('ReAct', ReActNode)
    .addNode('ReActCallTool', ReActCallToolNode)
    .addNode('ReActReviewToolCalls', ReActReviewToolCallsNode)
    .addNode('ReActCallToolReview', ReActCallToolReviewNode)
    .addNode('SynthesizeResponse', SynthesizeResponseNode)

    .addEdge(START, 'ReAct')
    .addEdge('ReActCallTool', 'ReAct')
    .addEdge('ReActReviewToolCalls', 'ReActCallToolReview')
    .addEdge('ReActCallToolReview', 'ReAct')
    .addEdge('SynthesizeResponse', END)
    .addConditionalEdges('ReAct', async (state: typeof AgentStateAnnotation.State) => {
      const lastMessage: BaseMessage | undefined = state.messages.at(-1)

      if (lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk) {
        const toolCalls: any[] = lastMessage?.tool_calls || []

        if (toolCalls.length > 0) {
          if (toolCalls.some((tc) => tc.name === 'finishResponse')) return 'SynthesizeResponse'

          const toolCallsToConfirm = toolCalls.filter((tc) => confirmationConfigs[tc.name])

          if (toolCallsToConfirm.length > 0) return 'ReActReviewToolCalls'

          return 'ReActCallTool'
        }

        return 'SynthesizeResponse'
      }

      return END
    })

  return graphBuilder.compile({ checkpointer })
}
