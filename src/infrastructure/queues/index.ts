import { Queue, QueueEvents } from 'bullmq'

export const langgraphQueue = new Queue('langgraph-tasks')
export const langgraphQueueEvents = new QueueEvents('langgraph-tasks')
