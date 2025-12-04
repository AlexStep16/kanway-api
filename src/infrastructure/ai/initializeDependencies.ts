import { MongoDBSaver } from '@/infrastructure/ai/MongoDBSaver.ts'
import { compileReActAgent } from '@application/ai/agents/ReActGraph.ts'
import { OpenAIEmbeddings } from '@langchain/openai'
import { MongoClient } from 'mongodb'

const embeddingModel = new OpenAIEmbeddings({ model: 'text-embedding-3-large' })

const mongoClient = new MongoClient(process.env.MONGODB_URI || '')
const checkpointer = new MongoDBSaver({
  client: mongoClient,
  dbName: process.env.DATABASE_NAME || 'production',
})

const toolService = new ToolService(userService, taskService, boardService, workspaceService)

const agent = compileReActAgent(toolService, checkpointer)

export { agent, embeddingModel }
