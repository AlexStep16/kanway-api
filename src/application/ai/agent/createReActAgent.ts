import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.js'
import { makeSummarizerNode } from './nodes/makeSummarizerNode.js'
import { END, START, StateGraph } from '@langchain/langgraph'
import { makeChatNameNode } from './nodes/makeChatNameNode.js'
import { makeTaskManagerAgentNode } from './nodes/makeTaskManagerAgentNode.js'
import { makeOrchestratorNode } from './nodes/makeOrchestratorNode.js'
import { makeOrchestratorToolNode } from './nodes/makeOrchestratorToolNode.js'
import { makeTaskManagerAgentToolNode } from './nodes/makeTaskManagerAgentToolNode.js'
import { routeOrchestratorOutput } from './edges/routeOrchestratorOutput.js'
import { routeOrchestratorToolOutput } from './edges/routeOrchestratorToolOutput.js'
import { routeTaskManagerAgentOutput } from './edges/routeTaskManagerAgentOutput.js'
import { routeTaskManagerAgentToolOutput } from './edges/routeTaskManagerAgentToolOutput.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.js'
import { makeTaskManagerAgentHumanReviewNode } from './nodes/makeTaskManagerAgentHumanReviewNode.js'
import { routeTaskManagerAgentHumanReviewOutput } from './edges/routeTaskManagerAgentHumanReviewOutput.js'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const orchestratorNode = makeOrchestratorNode(dependencies)
  const orchestratorToolNode = makeOrchestratorToolNode(dependencies)
  const taskManagerAgentNode = makeTaskManagerAgentNode(dependencies)
  const taskManagerAgentToolNode = makeTaskManagerAgentToolNode(dependencies)
  const taskManagerAgentHumanReviewNode = makeTaskManagerAgentHumanReviewNode()
  const chatNameNode = makeChatNameNode(dependencies)

  const summarizerNode = makeSummarizerNode(dependencies)

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Orchestrator', orchestratorNode)
    .addNode('OrchestratorTool', orchestratorToolNode)

    .addNode('TaskManagerAgent', taskManagerAgentNode)
    .addNode('TaskManagerAgentTool', taskManagerAgentToolNode)
    .addNode('TaskManagerAgentHumanReview', taskManagerAgentHumanReviewNode)

    .addNode('Summarizer', summarizerNode)

    .addNode('ChatName', chatNameNode)

    .addEdge(START, 'Summarizer')
    .addEdge('Summarizer', 'Orchestrator')
    .addConditionalEdges('Orchestrator', routeOrchestratorOutput, {
      OrchestratorTool: 'OrchestratorTool',
      ChatName: 'ChatName',
    })
    .addConditionalEdges('OrchestratorTool', routeOrchestratorToolOutput, {
      Orchestrator: 'Orchestrator',
      TaskManagerAgent: 'TaskManagerAgent',
      ChatName: 'ChatName',
    })
    .addConditionalEdges('TaskManagerAgent', routeTaskManagerAgentOutput, {
      TaskManagerAgentTool: 'TaskManagerAgentTool',
      Orchestrator: 'Orchestrator',
    })
    .addConditionalEdges('TaskManagerAgentTool', routeTaskManagerAgentToolOutput, {
      Orchestrator: 'Orchestrator',
      TaskManagerAgent: 'TaskManagerAgent',
      TaskManagerAgentHumanReview: 'TaskManagerAgentHumanReview',
    })
    .addConditionalEdges('TaskManagerAgentHumanReview', routeTaskManagerAgentHumanReviewOutput, {
      TaskManagerAgent: 'TaskManagerAgent',
      TaskManagerAgentTool: 'TaskManagerAgentTool',
    })
    .addEdge('ChatName', END)

  return graphBuilder.compile({ checkpointer })
}
