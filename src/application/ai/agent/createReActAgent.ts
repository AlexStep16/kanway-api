import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { AgentDependencies } from './types/AgentDependencies.ts'
import { StateGraph } from 'node_modules/@langchain/langgraph/dist/graph/state.js'
import { AgentStateAnnotation } from './AgentStateAnnotation.ts'
import { END, START } from 'node_modules/@langchain/langgraph/dist/constants.js'
import { makeCoderNode } from './nodes/makeCoderNode.ts'
import { makeBrainNode } from './nodes/makeBrainNode.ts'
import { makeSkillerNode } from './nodes/makeSkillerNode.ts'
import { makeBrainToolNode } from './nodes/makeBrainToolNode.ts'
import { makeSkillerToolNode } from './nodes/makeSkillerToolNode.ts'
import { makeCoderExecutionNode } from './nodes/makeCoderExecutionNode.ts'
import { routeBrainOutput } from './edges/routeBrainOutput.ts'
import { routeBrainToolOutput } from './edges/routeBrainToolOutput.ts'
import { routeSkillerToolOutput } from './edges/routeSkillerToolOutput.ts'
import { makeCoderHumanReviewNode } from './nodes/makeCoderHumanReviewNode.ts'
import { routeCoderHumanReviewOutput } from './edges/routeCoderHumanReviewOutput.ts'
import { makeCoderInternalToolNode } from './nodes/makeCoderInternalToolNode.ts'
import { makeResponderNode } from './nodes/makeResponderNode.ts'
import { routeCoderExecutionOutput } from './edges/routeCoderExecutionOutput.ts'

export function createReActAgent(dependencies: AgentDependencies, checkpointer: MongoDBSaver) {
  const brainNode = makeBrainNode(dependencies)
  const skillerNode = makeSkillerNode(dependencies)
  const coderNode = makeCoderNode(dependencies)
  const responderNode = makeResponderNode(dependencies)

  const brainToolNode = makeBrainToolNode()
  const skillerToolNode = makeSkillerToolNode()

  const coderExecutionNode = makeCoderExecutionNode()
  const coderInternalToolNode = makeCoderInternalToolNode(dependencies)
  const coderHumanReviewNode = makeCoderHumanReviewNode()

  const graphBuilder = new StateGraph(AgentStateAnnotation)
    .addNode('Brain', brainNode)
    .addNode('BrainTool', brainToolNode)

    .addNode('Skiller', skillerNode)
    .addNode('SkillerTool', skillerToolNode)

    .addNode('Coder', coderNode)
    .addNode('CoderExecution', coderExecutionNode)
    .addNode('CoderInternalTool', coderInternalToolNode)
    .addNode('CoderHumanReview', coderHumanReviewNode)

    .addNode('Responder', responderNode)

    .addEdge(START, 'Brain')
    .addConditionalEdges('Brain', routeBrainOutput, {
      BrainTool: 'BrainTool',
      Responder: 'Responder',
    })
    .addConditionalEdges('BrainTool', routeBrainToolOutput, {
      Brain: 'Brain',
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
