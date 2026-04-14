import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.ts'
import { AgentStateAnnotation } from './AgentStateAnnotation.ts'
import { makeCoderNode } from './nodes/makeCoderNode.ts'
import { makePlannerNode } from './nodes/makePlannerNode.ts'
import { makePlannerToolNode } from './nodes/makePlannerToolNode.ts'
import { makeCoderExecutionNode } from './nodes/makeCoderExecutionNode.ts'
import { routePlannerToolOutput } from './edges/routePlannerToolOutput.ts'
import { makeCoderHumanReviewNode } from './nodes/makeCoderHumanReviewNode.ts'
import { routeCoderHumanReviewOutput } from './edges/routeCoderHumanReviewOutput.ts'
import { makeCoderInternalToolNode } from './nodes/makeCoderInternalToolNode.ts'
import { routeCoderExecutionOutput } from './edges/routeCoderExecutionOutput.ts'
import { routePlannerOutput } from './edges/routePlannerOutput.ts'
import { makeSummarizerNode } from './nodes/makeSummarizerNode.ts'
import { END, START, StateGraph } from '@langchain/langgraph'
import { makeChatNameNode } from './nodes/makeChatNameNode.ts'
import { routeCoderInternalToolOutput } from './edges/routeCoderInternalToolOutput.ts'

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
