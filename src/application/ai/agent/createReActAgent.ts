import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from '@application/ai/agent/types/AgentDependencies.ts'
import { makeAgentNode } from '@application/ai/agent/nodes/makeAgentNode.ts'
import { makeToolsRetrievalNode } from '@/application/ai/agent/nodes/makeToolsRetrievalNode.ts'
import { makeHumanApprovalNode } from '@application/ai/agent/nodes/makeHumanApprovalNode.ts'
import { makeToolsExecutorNode } from '@application/ai/agent/nodes/makeToolsExecutorNode.ts'
import { makeSynthesizeNode } from '@application/ai/agent/nodes/makeSynthesizeNode.ts'
import { END, START, StateGraph } from '@langchain/langgraph'
import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'
import { routeAgentOutput } from '@application/ai/agent/edges/routeAgentOutput.ts'
import { routeHumanApprovalOutput } from '@application/ai/agent/edges/routeHumanApprovalOutput.ts'
import { makePlannerNode } from '@application/ai/agent/nodes/makePlannerNode.ts'
import { routePlannerOutput } from '@application/ai/agent/edges/routePlannerOutput.ts'
import { makeSummaryHistoryNode } from '@application/ai/agent/nodes/makeSummaryHistoryNode.ts'
import { makeChatbotNode } from '@application/ai/agent/nodes/makeChatbotNode.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const agentNode = makeAgentNode(dependencies)
  const retrievalNode = makeToolsRetrievalNode(dependencies)
  const humanApprovalNode = makeHumanApprovalNode(dependencies)
  const toolsExecutorNode = makeToolsExecutorNode(dependencies)
  const synthesizeNode = makeSynthesizeNode(dependencies)
  const plannerNode = makePlannerNode(dependencies)
  const summarizerNode = makeSummaryHistoryNode(dependencies)
  const chatbotNode = makeChatbotNode(dependencies)

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    // --- Добавляем узлы ---
    .addNode('Planner', plannerNode)
    .addNode('Summarizer', summarizerNode)
    .addNode('Agent', agentNode)
    .addNode('ToolRetrieval', retrievalNode)
    .addNode('HumanApproval', humanApprovalNode)
    .addNode('ToolsExecutor', toolsExecutorNode)
    .addNode('Synthesize', synthesizeNode)
    .addNode('Chatbot', chatbotNode)

    // --- Добавляем Ребра (Логику переходов) ---

    // Старт -> Агент думает
    .addEdge(START, 'Planner')

    .addConditionalEdges('Planner', routePlannerOutput, {
      summarizer: 'Summarizer',
      planner: 'Planner',
      chatbot: 'Chatbot',
    })

    .addEdge('Summarizer', 'Agent')

    // Агент решил -> Развилка (Retrieve / Synthesize / Verify)
    .addConditionalEdges('Agent', routeAgentOutput, {
      retrieve: 'ToolRetrieval',
      synthesize: 'Synthesize',
      verify: 'HumanApproval',
    })

    // После поиска новых инструментов -> Снова думать
    .addEdge('ToolRetrieval', 'Agent')

    // После проверки -> Развилка (Retry / Execute)
    .addConditionalEdges('HumanApproval', routeHumanApprovalOutput, {
      retry: 'Agent', // Ошибка валидации -> Агент исправляет аргументы
      execute: 'ToolsExecutor', // Успех/Подтверждение -> Выполнение
    })

    // После выполнения инструментов -> Снова думать (с результатами)
    .addEdge('ToolsExecutor', 'Agent')

    // Синтез -> Конец
    .addEdge('Synthesize', END)
    .addEdge('Chatbot', END)

  // 5. Компилируем
  return graphBuilder.compile({ checkpointer })
}
