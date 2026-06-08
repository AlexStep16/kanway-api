import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { MongoClient } from 'mongodb'
import { CompiledStateGraph } from '@langchain/langgraph' // Тип скомпилированного графа
import { initAiModels } from './initAiModels.js'
import { createReActAgent } from '@/application/ai/agent/createReActAgent.js'
import { initializeDependencies } from '../di/initializeDependencies.js'

// Переменная для хранения единственного экземпляра (Singleton)
let agentInstance: CompiledStateGraph<any, any, any> | null = null
let mongoClient: MongoClient | null = null

/**
 * Функция получения агента.
 * Инициализирует всё только при первом вызове.
 */
export async function getAgent(dependencies: ReturnType<typeof initializeDependencies>) {
  // 1. Если агент уже создан — возвращаем его (кэширование)
  if (agentInstance) {
    return agentInstance
  }

  // 3. Подключаемся к Mongo (безопасно)
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGO_URL || '')
    await mongoClient.connect() // Явное ожидание подключения
    console.log('✅ Connected to MongoDB for Agent Checkpoints')
  }

  // 4. Создаем чекпоинтер
  const checkpointer = new MongoDBSaver({
    client: mongoClient,
    dbName: process.env.DATABASE_NAME || 'production',
  })

  // 6. Собираем агента через нашу фабрику
  agentInstance = createReActAgent(
    {
      services: {
        taskToolsExecutorService: dependencies.services.taskToolsExecutorService,
        columnToolsExecutorService: dependencies.services.columnToolsExecutorService,
        boardToolsExecutorService: dependencies.services.boardToolsExecutorService,
        workspaceToolsExecutorService: dependencies.services.workspaceToolsExecutorService,
        generalToolsExecutor: dependencies.services.generalToolsExecutor,
      },
      models: {
        ...initAiModels(),
      },
    },
    checkpointer,
  )

  return agentInstance
}

/**
 * Функция для корректного завершения работы (Graceful Shutdown)
 * Вызывается при остановке сервера
 */
export async function closeAgentResources() {
  if (mongoClient) {
    await mongoClient.close()
    mongoClient = null
    agentInstance = null // Сбрасываем инстанс
    console.log('🛑 MongoDB connection closed')
  }
}
