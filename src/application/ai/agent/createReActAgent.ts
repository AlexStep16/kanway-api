import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.ts'
import { StateGraph } from 'node_modules/@langchain/langgraph/dist/graph/state.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.ts'
import { END, START } from 'node_modules/@langchain/langgraph/dist/constants.js'
import { makeCoderNode } from './nodes/makeCoderNode.ts'
import { makePlannerNode } from './nodes/makePlannerNode.ts'
import { makeSkillerNode } from './nodes/makeSkillerNode.ts'
import { makePlannerToolNode } from './nodes/makePlannerToolNode.ts'
import { makeSkillerToolNode } from './nodes/makeSkillerToolNode.ts'
import { makeCoderExecutionNode } from './nodes/makeCoderExecutionNode.ts'
import { routePlannerToolOutput } from './edges/routePlannerToolOutput.ts'
import { routeSkillerToolOutput } from './edges/routeSkillerToolOutput.ts'
import { makeCoderHumanReviewNode } from './nodes/makeCoderHumanReviewNode.ts'
import { routeCoderHumanReviewOutput } from './edges/routeCoderHumanReviewOutput.ts'
import { makeCoderInternalToolNode } from './nodes/makeCoderInternalToolNode.ts'
import { makeResponderNode } from './nodes/makeResponderNode.ts'
import { routeCoderExecutionOutput } from './edges/routeCoderExecutionOutput.ts'
import { makeReplannerNode } from './nodes/makeReplannerNode.ts'
import { makeReplannerToolNode } from './nodes/makeReplannerToolNode.ts'
import { routeReplannerToolOutput } from './edges/routeReplannerToolOutput.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const plannerNode = makePlannerNode(dependencies)
  const replannerNode = makeReplannerNode(dependencies)
  const skillerNode = makeSkillerNode(dependencies)
  const coderNode = makeCoderNode(dependencies)
  const responderNode = makeResponderNode(dependencies)

  const plannerToolNode = makePlannerToolNode()
  const replannerToolNode = makeReplannerToolNode()
  const skillerToolNode = makeSkillerToolNode()

  const coderExecutionNode = makeCoderExecutionNode()
  const coderInternalToolNode = makeCoderInternalToolNode(dependencies)
  const coderHumanReviewNode = makeCoderHumanReviewNode()

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Planner', plannerNode)
    .addNode('PlannerTool', plannerToolNode)

    .addNode('Replanner', replannerNode)
    .addNode('ReplannerTool', replannerToolNode)

    .addNode('Skiller', skillerNode)
    .addNode('SkillerTool', skillerToolNode)

    .addNode('Coder', coderNode)
    .addNode('CoderExecution', coderExecutionNode)
    .addNode('CoderInternalTool', coderInternalToolNode)
    .addNode('CoderHumanReview', coderHumanReviewNode)

    .addNode('Responder', responderNode)

    .addEdge(START, 'Planner')
    .addEdge('Planner', 'PlannerTool')
    .addConditionalEdges('PlannerTool', routePlannerToolOutput, {
      Responder: 'Responder',
      Planner: 'Planner',
      Skiller: 'Skiller',
    })
    .addEdge('Skiller', 'SkillerTool')
    .addConditionalEdges('SkillerTool', routeSkillerToolOutput, {
      Skiller: 'Skiller',
      Coder: 'Coder',
    })
    .addEdge('Coder', 'CoderExecution')
    .addConditionalEdges('CoderExecution', routeCoderExecutionOutput, {
      Replanner: 'Replanner',
      Coder: 'Coder',
      CoderInternalTool: 'CoderInternalTool',
    })
    .addEdge('Replanner', 'ReplannerTool')
    .addConditionalEdges('ReplannerTool', routeReplannerToolOutput, {
      Responder: 'Responder',
      Replanner: 'Replanner',
      Skiller: 'Skiller',
    })
    .addEdge('CoderInternalTool', 'CoderHumanReview')
    .addConditionalEdges('CoderHumanReview', routeCoderHumanReviewOutput, {
      CoderExecution: 'CoderExecution',
      CoderInternalTool: 'CoderInternalTool',
      Replanner: 'Replanner',
    })
    .addEdge('Responder', END)

  return graphBuilder.compile({ checkpointer })
}
