import { Queue } from 'bullmq'

export const langgraphQueue = new Queue('langgraph-tasks')
