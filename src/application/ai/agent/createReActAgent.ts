import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from '@application/ai/agent/types/AgentDependencies.ts'
import { makeExecutorNode } from '@application/ai/agent/nodes/makeExecutorNode.ts'
import { makeToolsRetrievalNode } from '@/application/ai/agent/nodes/makeToolsRetrievalNode.ts'
import { makeHumanApprovalNode } from '@application/ai/agent/nodes/makeHumanApprovalNode.ts'
import { makeToolsExecutorNode } from '@application/ai/agent/nodes/makeToolsExecutorNode.ts'
import { makeSynthesizeNode } from '@application/ai/agent/nodes/makeSynthesizeNode.ts'
import { END, START, StateGraph } from '@langchain/langgraph'
import { AgentStateAnnotation } from '@application/ai/agent/AgentStateAnnotation.ts'
import { routeExecutorOutput } from '@application/ai/agent/edges/routeExecutorOutput.ts'
import { routePrepareToolCallsOutput } from '@/application/ai/agent/edges/routePrepareToolCallsOutput.ts'
import { makePlannerNode } from '@application/ai/agent/nodes/makePlannerNode.ts'
import { routePlannerOutput } from '@application/ai/agent/edges/routePlannerOutput.ts'
import { makeSummaryHistoryNode } from '@application/ai/agent/nodes/makeSummaryHistoryNode.ts'
import { makeChatbotNode } from '@application/ai/agent/nodes/makeChatbotNode.ts'
import { makePrepareToolCallsNode } from './nodes/makePrepareToolCallsNode.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const executorNode = makeExecutorNode(dependencies)
  const retrievalNode = makeToolsRetrievalNode(dependencies)
  const humanApprovalNode = makeHumanApprovalNode()
  const prepareToolCallsNode = makePrepareToolCallsNode(dependencies)
  const toolsExecutorNode = makeToolsExecutorNode(dependencies)
  const synthesizeNode = makeSynthesizeNode(dependencies)
  const plannerNode = makePlannerNode(dependencies)
  const summarizerNode = makeSummaryHistoryNode(dependencies)
  const chatbotNode = makeChatbotNode(dependencies)

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Planner', plannerNode)
    .addNode('Summarizer', summarizerNode)
    .addNode('Executor', executorNode)
    .addNode('ToolRetrieval', retrievalNode)
    .addNode('PrepareToolCalls', prepareToolCallsNode)
    .addNode('HumanApproval', humanApprovalNode)
    .addNode('ToolsExecutor', toolsExecutorNode)
    .addNode('Synthesize', synthesizeNode)
    .addNode('Chatbot', chatbotNode)

    .addEdge(START, 'Summarizer')
    .addEdge('Summarizer', 'Planner')

    .addConditionalEdges('Planner', routePlannerOutput, {
      executor: 'Executor',
      synthesize: 'Synthesize',
      planner: 'Planner',
      chatbot: 'Chatbot',
    })

    .addConditionalEdges('Executor', routeExecutorOutput, {
      retrieve: 'ToolRetrieval',
      synthesize: 'Synthesize',
      verify: 'PrepareToolCalls',
    })

    .addEdge('ToolRetrieval', 'Executor')

    .addConditionalEdges('PrepareToolCalls', routePrepareToolCallsOutput, {
      retry: 'Executor',
      approve: 'HumanApproval',
      execute: 'ToolsExecutor',
    })
    .addEdge('HumanApproval', 'ToolsExecutor')

    .addEdge('ToolsExecutor', 'Executor')

    .addEdge('Synthesize', END)
    .addEdge('Chatbot', END)

  return graphBuilder.compile({ checkpointer })
}
