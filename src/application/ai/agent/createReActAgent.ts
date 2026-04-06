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
import { makeReplannerNode } from './nodes/makeReplannerNode.ts'
import { makeReplannerToolNode } from './nodes/makeReplannerToolNode.ts'
import { routeReplannerToolOutput } from './edges/routeReplannerToolOutput.ts'
import { routePlannerOutput } from './edges/routePlannerOutput.ts'
import { routeReplannerOutput } from './edges/routeReplannerOutput.ts'
import { makeSummarizerNode } from './nodes/makeSummarizerNode.ts'
import { END, START, StateGraph } from '@langchain/langgraph'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const plannerNode = makePlannerNode(dependencies)
  const replannerNode = makeReplannerNode(dependencies)
  const coderNode = makeCoderNode(dependencies)

  const plannerToolNode = makePlannerToolNode()
  const replannerToolNode = makeReplannerToolNode()

  const coderExecutionNode = makeCoderExecutionNode()
  const coderInternalToolNode = makeCoderInternalToolNode(dependencies)
  const coderHumanReviewNode = makeCoderHumanReviewNode()

  const summarizerNode = makeSummarizerNode(dependencies)

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Planner', plannerNode)
    .addNode('PlannerTool', plannerToolNode)

    .addNode('Replanner', replannerNode)
    .addNode('ReplannerTool', replannerToolNode)

    .addNode('Coder', coderNode)
    .addNode('CoderExecution', coderExecutionNode)
    .addNode('CoderInternalTool', coderInternalToolNode)
    .addNode('CoderHumanReview', coderHumanReviewNode)

    .addNode('Summarizer', summarizerNode)

    .addEdge(START, 'Summarizer')
    .addEdge('Summarizer', 'Planner')
    .addConditionalEdges('Planner', routePlannerOutput, {
      PlannerTool: 'PlannerTool',
      [END]: END,
    })
    .addConditionalEdges('PlannerTool', routePlannerToolOutput, {
      Planner: 'Planner',
      Coder: 'Coder',
      [END]: END,
    })
    .addEdge('Coder', 'CoderExecution')
    .addConditionalEdges('CoderExecution', routeCoderExecutionOutput, {
      Replanner: 'Replanner',
      Coder: 'Coder',
      CoderInternalTool: 'CoderInternalTool',
    })
    .addConditionalEdges('Replanner', routeReplannerOutput, {
      ReplannerTool: 'ReplannerTool',
      [END]: END,
    })
    .addConditionalEdges('ReplannerTool', routeReplannerToolOutput, {
      Replanner: 'Replanner',
      Coder: 'Coder',
      [END]: END,
    })
    .addEdge('CoderInternalTool', 'CoderHumanReview')
    .addConditionalEdges('CoderHumanReview', routeCoderHumanReviewOutput, {
      CoderExecution: 'CoderExecution',
      CoderInternalTool: 'CoderInternalTool',
      Replanner: 'Replanner',
    })

  return graphBuilder.compile({ checkpointer })
}
