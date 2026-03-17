import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.ts'
import { StateGraph } from 'node_modules/@langchain/langgraph/dist/graph/state.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.ts'
import { END, START } from 'node_modules/@langchain/langgraph/dist/constants.js'
import { makeCoderNode } from './nodes/makeCoderNode.ts'
import { makeEnricherNode } from './nodes/makeEnricherNode.ts'
import { makeSkillerNode } from './nodes/makeSkillerNode.ts'
import { makeEnricherToolNode } from './nodes/makeEnricherToolNode.ts'
import { makeSkillerToolNode } from './nodes/makeSkillerToolNode.ts'
import { makeCoderExecutionNode } from './nodes/makeCoderExecutionNode.ts'
import { routeEnricherOutput } from './edges/routeEnricherOutput.ts'
import { routeEnricherToolOutput } from './edges/routeEnricherToolOutput.ts'
import { routeSkillerToolOutput } from './edges/routeSkillerToolOutput.ts'
import { makeCoderHumanReviewNode } from './nodes/makeCoderHumanReviewNode.ts'
import { routeCoderHumanReviewOutput } from './edges/routeCoderHumanReviewOutput.ts'
import { makeCoderInternalToolNode } from './nodes/makeCoderInternalToolNode.ts'
import { makeResponderNode } from './nodes/makeResponderNode.ts'
import { routeCoderExecutionOutput } from './edges/routeCoderExecutionOutput.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const enricherNode = makeEnricherNode(dependencies)
  const skillerNode = makeSkillerNode(dependencies)
  const coderNode = makeCoderNode(dependencies)
  const responderNode = makeResponderNode(dependencies)

  const enricherToolNode = makeEnricherToolNode()
  const skillerToolNode = makeSkillerToolNode()

  const coderExecutionNode = makeCoderExecutionNode()
  const coderInternalToolNode = makeCoderInternalToolNode(dependencies)
  const coderHumanReviewNode = makeCoderHumanReviewNode()

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Enricher', enricherNode)
    .addNode('EnricherTool', enricherToolNode)

    .addNode('Skiller', skillerNode)
    .addNode('SkillerTool', skillerToolNode)

    .addNode('Coder', coderNode)
    .addNode('CoderExecution', coderExecutionNode)
    .addNode('CoderInternalTool', coderInternalToolNode)
    .addNode('CoderHumanReview', coderHumanReviewNode)

    .addNode('Responder', responderNode)

    .addEdge(START, 'Enricher')
    .addConditionalEdges('Enricher', routeEnricherOutput, {
      EnricherTool: 'EnricherTool',
      Responder: 'Responder',
    })
    .addConditionalEdges('EnricherTool', routeEnricherToolOutput, {
      Enricher: 'Enricher',
      Skiller: 'Skiller',
    })
    .addEdge('Skiller', 'SkillerTool')
    .addConditionalEdges('SkillerTool', routeSkillerToolOutput, {
      Skiller: 'Skiller',
      Coder: 'Coder',
    })
    .addEdge('Coder', 'CoderExecution')
    .addConditionalEdges('CoderExecution', routeCoderExecutionOutput, {
      Coder: 'Coder',
      CoderInternalTool: 'CoderInternalTool',
    })
    .addEdge('CoderInternalTool', 'CoderHumanReview')
    .addConditionalEdges('CoderHumanReview', routeCoderHumanReviewOutput, {
      Coder: 'Coder',
      CoderExecution: 'CoderExecution',
      CoderInternalTool: 'CoderInternalTool',
      Responder: 'Responder',
    })
    .addEdge('Responder', END)

  return graphBuilder.compile({ checkpointer })
}
