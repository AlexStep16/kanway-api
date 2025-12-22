import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { compileReActAgent } from '@application/ai/agents/ReActGraph.ts'
import { MongoClient } from 'mongodb'

const mongoClient = new MongoClient(process.env.MONGODB_URI || '')
const checkpointer = new MongoDBSaver({
  client: mongoClient,
  dbName: process.env.DATABASE_NAME || 'production',
})

const agent = compileReActAgent(checkpointer)

export { agent }
