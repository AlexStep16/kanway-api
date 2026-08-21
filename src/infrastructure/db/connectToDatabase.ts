import { connect } from 'mongoose'
import dotenv from 'dotenv'
import { ensureTaskVectorIndex } from '@/infrastructure/helpers/ensureTaskVectorIndex.js'
import { ensureColumnVectorIndex } from '@/infrastructure/helpers/ensureColumnVectorIndex.js'
import { ensureBoardVectorIndex } from '@/infrastructure/helpers/ensureBoardVectorIndex.js'
import { ensureWorkspaceVectorIndex } from '@/infrastructure/helpers/ensureWorkspaceVectorIndex.js'

dotenv.config()

const connectToDatabase = async () => {
  try {
    await connect(process.env.MONGO_URL || 'mongodb://localhost:27017/kanway')

    await ensureTaskVectorIndex()
    await ensureColumnVectorIndex()
    await ensureBoardVectorIndex()
    await ensureWorkspaceVectorIndex()

    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB', error)
  }
}

export default connectToDatabase
