import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.js'
import { makeCoderNode } from './nodes/makeCoderNode.js'
import { makePlannerNode } from './nodes/makePlannerNode.js'
import { makePlannerToolNode } from './nodes/makePlannerToolNode.js'
import { makeCoderExecutionNode } from './nodes/makeCoderExecutionNode.js'
import { routePlannerToolOutput } from './edges/routePlannerToolOutput.js'
import { makeCoderHumanReviewNode } from './nodes/makeCoderHumanReviewNode.js'
import { routeCoderHumanReviewOutput } from './edges/routeCoderHumanReviewOutput.js'
import { makeCoderInternalToolNode } from './nodes/makeCoderInternalToolNode.js'
import { routeCoderExecutionOutput } from './edges/routeCoderExecutionOutput.js'
import { routePlannerOutput } from './edges/routePlannerOutput.js'
import { makeSummarizerNode } from './nodes/makeSummarizerNode.js'
import { END, START, StateGraph } from '@langchain/langgraph'
import { makeChatNameNode } from './nodes/makeChatNameNode.js'
import { routeCoderInternalToolOutput } from './edges/routeCoderInternalToolOutput.js'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const plannerNode = makePlannerNode(dependencies)
  const coderNode = makeCoderNode(dependencies)
  const chatNameNode = makeChatNameNode(dependencies)

  const plannerToolNode = makePlannerToolNode()

  const coderExecutionNode = makeCoderExecutionNode()
  const coderInternalToolNode = makeCoderInternalToolNode(dependencies)
  const coderHumanReviewNode = makeCoderHumanReviewNode()

  const summarizerNode = makeSummarizerNode(dependencies)

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Planner', plannerNode)
    .addNode('PlannerTool', plannerToolNode)

    .addNode('Coder', coderNode)
    .addNode('CoderExecution', coderExecutionNode)
    .addNode('CoderInternalTool', coderInternalToolNode)
    .addNode('CoderHumanReview', coderHumanReviewNode)

    .addNode('Summarizer', summarizerNode)

    .addNode('ChatName', chatNameNode)

    .addEdge(START, 'Summarizer')
    .addEdge('Summarizer', 'Planner')
    .addConditionalEdges('Planner', routePlannerOutput, {
      PlannerTool: 'PlannerTool',
      ChatName: 'ChatName',
    })
    .addConditionalEdges('PlannerTool', routePlannerToolOutput, {
      Planner: 'Planner',
      Coder: 'Coder',
      ChatName: 'ChatName',
    })
    .addEdge('Coder', 'CoderExecution')
    .addConditionalEdges('CoderExecution', routeCoderExecutionOutput, {
      Planner: 'Planner',
      Coder: 'Coder',
      CoderInternalTool: 'CoderInternalTool',
    })
    .addConditionalEdges('CoderInternalTool', routeCoderInternalToolOutput, {
      CoderHumanReview: 'CoderHumanReview',
      Coder: 'Coder',
    })
    .addConditionalEdges('CoderHumanReview', routeCoderHumanReviewOutput, {
      CoderExecution: 'CoderExecution',
      CoderInternalTool: 'CoderInternalTool',
      Planner: 'Planner',
    })
    .addEdge('ChatName', END)

  return graphBuilder.compile({ checkpointer })
}
