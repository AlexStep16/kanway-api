import { connect } from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const connectToDatabase = async () => {
  try {
    await connect(process.env.MONGO_URL || 'mongodb://localhost:27017/boardai')
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB', error)
  }
}

export default connectToDatabase
