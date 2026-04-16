import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb'
import { createReActAgent } from '@/application/ai/agent/createReActAgent.js'
import { MongoClient } from 'mongodb'
import { CompiledStateGraph } from '@langchain/langgraph' // Тип скомпилированного графа
import { initAiModels } from './initAiModels.js'

// Переменная для хранения единственного экземпляра (Singleton)
let agentInstance: CompiledStateGraph<any, any, any> | null = null
let mongoClient: MongoClient | null = null

/**
 * Функция получения агента.
 * Инициализирует всё только при первом вызове.
 */
export async function getAgent(dependencies: any) {
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
        toolDispatcherService: dependencies.services.toolDispatcherService,
        //contextExternalFetchService: dependencies.services.contextExternalFetchService,
        //vectorSearchService: dependencies.services.vectorSearchService,
        //userService: dependencies.services.userService,
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
