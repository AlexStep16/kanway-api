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
import { routePrepareToolCallsOutput } from '@/application/ai/agent/edges/routePrepareToolCallsOutput.ts'
import { makePlannerNode } from '@application/ai/agent/nodes/makePlannerNode.ts'
import { routePlannerOutput } from '@application/ai/agent/edges/routePlannerOutput.ts'
import { makeSummaryHistoryNode } from '@application/ai/agent/nodes/makeSummaryHistoryNode.ts'
import { makeChatbotNode } from '@application/ai/agent/nodes/makeChatbotNode.ts'
import { makePrepareToolCallsNode } from './nodes/makePrepareToolCallsNode.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const agentNode = makeAgentNode(dependencies)
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
    .addNode('Agent', agentNode)
    .addNode('ToolRetrieval', retrievalNode)
    .addNode('PrepareToolCalls', prepareToolCallsNode)
    .addNode('HumanApproval', humanApprovalNode)
    .addNode('ToolsExecutor', toolsExecutorNode)
    .addNode('Synthesize', synthesizeNode)
    .addNode('Chatbot', chatbotNode)

    .addEdge(START, 'Planner')

    .addConditionalEdges('Planner', routePlannerOutput, {
      summarizer: 'Summarizer',
      planner: 'Planner',
      chatbot: 'Chatbot',
    })

    .addEdge('Summarizer', 'Agent')

    .addConditionalEdges('Agent', routeAgentOutput, {
      retrieve: 'ToolRetrieval',
      synthesize: 'Synthesize',
      verify: 'PrepareToolCalls',
    })

    .addEdge('ToolRetrieval', 'Agent')

    .addConditionalEdges('PrepareToolCalls', routePrepareToolCallsOutput, {
      retry: 'Agent',
      approve: 'HumanApproval',
      execute: 'ToolsExecutor',
    })
    .addEdge('HumanApproval', 'ToolsExecutor')

    .addEdge('ToolsExecutor', 'Agent')

    .addEdge('Synthesize', END)
    .addEdge('Chatbot', END)

  return graphBuilder.compile({ checkpointer })
}
