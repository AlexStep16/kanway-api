import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.js'
import { makeSummarizerNode } from './nodes/makeSummarizerNode.js'
import { END, START, StateGraph } from '@langchain/langgraph'
import { makeEntityManagerAgentNode } from './nodes/makeEntityManagerAgentNode.js'
import { makeOrchestratorNode } from './nodes/makeOrchestratorNode.js'
import { makeOrchestratorToolNode } from './nodes/makeOrchestratorToolNode.js'
import { makeEntityManagerAgentToolNode } from './nodes/makeEntityManagerAgentToolNode.js'
import { routeOrchestratorOutput } from './edges/routeOrchestratorOutput.js'
import { routeOrchestratorToolOutput } from './edges/routeOrchestratorToolOutput.js'
import { routeEntityManagerAgentOutput } from './edges/routeEntityManagerAgentOutput.js'
import { routeEntityManagerAgentToolOutput } from './edges/routeEntityManagerAgentToolOutput.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.js'
import { makeToolHumanReviewNode } from './nodes/makeToolHumanReviewNode.js'
import { routeToolHumanReviewOutput } from './edges/routeToolHumanReviewOutput.js'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const orchestratorNode = makeOrchestratorNode(dependencies)
  const orchestratorToolNode = makeOrchestratorToolNode(dependencies)
  const entityManagerAgentNode = makeEntityManagerAgentNode(dependencies)
  const entityManagerAgentToolNode = makeEntityManagerAgentToolNode(dependencies)
  const toolHumanReviewNode = makeToolHumanReviewNode()

  const summarizerNode = makeSummarizerNode()

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Orchestrator', orchestratorNode)
    .addNode('OrchestratorTool', orchestratorToolNode)

    .addNode('EntityManagerAgent', entityManagerAgentNode)
    .addNode('EntityManagerAgentTool', entityManagerAgentToolNode)
    .addNode('ToolHumanReview', toolHumanReviewNode)

    .addNode('Summarizer', summarizerNode)

    .addEdge(START, 'Summarizer')
    .addEdge('Summarizer', 'Orchestrator')
    .addConditionalEdges('Orchestrator', routeOrchestratorOutput, {
      OrchestratorTool: 'OrchestratorTool',
      _END: END,
    })
    .addConditionalEdges('OrchestratorTool', routeOrchestratorToolOutput, {
      Orchestrator: 'Orchestrator',
      ToolHumanReview: 'ToolHumanReview',
      EntityManagerAgent: 'EntityManagerAgent',
    })
    .addConditionalEdges('EntityManagerAgent', routeEntityManagerAgentOutput, {
      EntityManagerAgentTool: 'EntityManagerAgentTool',
      Orchestrator: 'Orchestrator',
    })
    .addConditionalEdges('EntityManagerAgentTool', routeEntityManagerAgentToolOutput, {
      EntityManagerAgent: 'EntityManagerAgent',
      ToolHumanReview: 'ToolHumanReview',
    })
    .addConditionalEdges('ToolHumanReview', routeToolHumanReviewOutput, {
      Orchestrator: 'Orchestrator',
      OrchestratorTool: 'OrchestratorTool',
      EntityManagerAgent: 'EntityManagerAgent',
      EntityManagerAgentTool: 'EntityManagerAgentTool',
    })

  return graphBuilder.compile({ checkpointer })
}
