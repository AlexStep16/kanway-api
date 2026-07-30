import AuthController from '@controllers/AuthController.js'
import { AuthService } from '@application/services/AuthService.js'
import { UserService } from '@application/services/UserService.js'
import UserRepository from '@repositories/UserRepository.js'
import { EmailService } from '@infrastructure/services/EmailService.js'
import { TokenService } from '@application/services/TokenService.js'
import WorkspaceController from '@controllers/WorkspaceController.js'
import { WorkspaceService } from '@application/services/WorkspaceService.js'
import WorkspaceRepository from '@repositories/WorkspaceRepository.js'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.js'
import { OperationLogService } from '@application/services/OperationLogService.js'
import OperationLogRepository from '@repositories/OperationLogRepository.js'
import { BoardService } from '@application/services/BoardService.js'
import BoardRepository from '@repositories/BoardRepository.js'
import BoardController from '@controllers/BoardController.js'
import { ColumnService } from '@application/services/ColumnService.js'
import ColumnRepository from '@repositories/ColumnRepository.js'
import ColumnController from '@controllers/ColumnController.js'
import TaskRepository from '@application/repositories/TaskRepository.js'
import { TaskService } from '@application/services/TaskService.js'
import TaskController from '@controllers/TaskController.js'
import ArchiveController from '@controllers/ArchiveController.js'
import { UserController } from '@controllers/UserController.js'
import SettingRepository from '@repositories/SettingRepository.js'
import { SettingService } from '@application/services/SettingService.js'
import { SettingController } from '@controllers/SettingController.js'
import SubscriptionRepository from '@repositories/SubscriptionRepository.js'
import { SubscriptionService } from '@application/services/SubscriptionService.js'
import { SubscriptionController } from '@controllers/SubscriptionController.js'
import PaymentRepository from '@repositories/PaymentRepository.js'
import { PaymentService } from '@application/services/PaymentService.js'
import { PaymentController } from '@controllers/PaymentController.js'
import PaymentMethodRepository from '@repositories/PaymentMethodRepository.js'
import ChatMessageRepository from '@repositories/ChatMessageRepository.js'
import { PaymentMethodService } from '@application/services/PaymentMethodService.js'
import { PaymentMethodController } from '@controllers/PaymentMethodController.js'
import { IRevertableService } from '@interfaces/traits/IRevertableService.js'
import { OperationLogController } from '@controllers/OperationLogController.js'
import { VectorSearchService } from '@/application/services/VectorSearchService.js'
import { MongoClient } from 'mongodb'
import { ChatMessageService } from '@application/services/ChatMessageService.js'
import { ChatService } from '@application/services/ChatService.js'
import ChatRepository from '@application/repositories/ChatRepository.js'
import ChatController from '@controllers/ChatController.js'
import ChatMessageController from '@controllers/ChatMessageController.js'
import SupportController from '../api/controllers/SupportController.js'
import SupportRepository from '@/application/repositories/SupportRepository.js'
import { BaseService } from '@/application/services/BaseService.js'
import { LimitService } from '@/application/services/LimitService.js'
import { TaskToolsExecutorService } from '@/application/ai/services/TaskToolsExecutorService.js'
import CheckpointWriteRepository from '@/application/repositories/CheckpointWriteRepository.js'
import CheckpointRepository from '@/application/repositories/CheckpointRepository.js'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.js'
import { SelectionService } from '@/application/ai/services/SelectionService.js'
import { GeneralToolsExecutor } from '@/application/ai/services/GeneralToolsExecutor.js'
import SelectionRepository from '@/application/repositories/SelectionRepository.js'
import { ColumnToolsExecutorService } from '@/application/ai/services/ColumnToolsExecutorService.js'
import { BoardToolsExecutorService } from '@/application/ai/services/BoardToolsExecutorService.js'
import { WorkspaceToolsExecutorService } from '@/application/ai/services/WorkspaceToolsExecutorService.js'
import { TranscriptionService } from '@/infrastructure/services/TranscriptionService.js'
import { TranscriptionController } from '@controllers/TranscriptionController.js'

export function initializeDependencies() {
  const mongoClient = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/kanway')

  const userRepository = new UserRepository()
  const workspaceRepository = new WorkspaceRepository()
  const operationLogRepository = new OperationLogRepository()
  const boardRepository = new BoardRepository()
  const columnRepository = new ColumnRepository()
  const taskRepository = new TaskRepository()
  const settingRepository = new SettingRepository()
  const subscriptionRepository = new SubscriptionRepository()
  const paymentRepository = new PaymentRepository()
  const paymentMethodRepository = new PaymentMethodRepository()
  const chatMessageRepository = new ChatMessageRepository()
  const chatRespository = new ChatRepository()
  const supportRepository = new SupportRepository()
  const checkpointRepository = new CheckpointRepository()
  const checkpointWriteRepository = new CheckpointWriteRepository()
  const selectionRepository = new SelectionRepository()

  /* MOCK SERVICES START */
  const mockColumnService = {} as ColumnService
  const mockBoardService = {} as BoardService
  const mockTaskService = {} as TaskService
  const mockWorkspaceService = {} as WorkspaceService
  /* MOCK SERVICES END */

  const embeddingService = new EmbeddingService()
  const operationLogService = new OperationLogService(
    operationLogRepository,
    new Map<string, IRevertableService>([
      ['tasks', mockTaskService],
      ['columns', mockColumnService],
      ['boards', mockBoardService],
      ['workspaces', mockWorkspaceService],
    ]),

    mockColumnService,
    mockBoardService,
    mockWorkspaceService,
  )
  const vectorSearchService = new VectorSearchService(embeddingService, mongoClient)

  const limitService = new LimitService(
    mockBoardService,
    mockColumnService,
    mockTaskService,
    mockWorkspaceService,
  )

  /* SETTING SERVICES START */
  const settingService = new SettingService(settingRepository)
  /* SETTING SERVICES END */

  /* SUBSCRIPTION SERVICES START */
  const subscriptionService = new SubscriptionService(subscriptionRepository)
  /* SUBSCRIPTION SERVICES END */

  /* AUTH SERVICES START */
  const tokenService = new TokenService()
  const emailService = new EmailService(tokenService)
  const userService = new UserService(userRepository, emailService)
  const authService = new AuthService(userService, emailService, tokenService, settingService)
  /* AUTH SERVICES END */

  /* PAYMENT SERVICES START */
  const paymentMethodService = new PaymentMethodService(paymentMethodRepository, userService)
  const paymentService = new PaymentService(
    paymentRepository,
    userService,
    paymentMethodService,
    emailService,
  )
  /* PAYMENT SERVICES END */

  /* TASK SERVICES START */
  const taskService = new TaskService(
    taskRepository,
    embeddingService,
    operationLogService,
    mockColumnService,
    mockBoardService,
    mockWorkspaceService,
    limitService,
  )
  /* TASK SERVICES END */

  /* COLUMN SERVICES START */
  const columnService = new ColumnService(
    columnRepository,
    embeddingService,
    operationLogService,
    mockWorkspaceService,
    mockBoardService,
    taskService,
    limitService,
  )
  /* COLUMN SERVICES END */

  /* BOARD SERVICES START */
  const boardService = new BoardService(
    boardRepository,
    embeddingService,
    operationLogService,
    mockWorkspaceService,
    columnService,
    taskService,
    limitService,
  )
  /* BOARD SERVICES END */

  /* WORKSPACE SERVICES START */
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    embeddingService,
    operationLogService,
    boardService,
    columnService,
    taskService,
    limitService,
    userService,
  )
  /* WORKSPACE SERVICES END */

  const baseMethodsToCopy = Object.getOwnPropertyNames(BaseService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of baseMethodsToCopy) {
    const method = (taskService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockTaskService as any)[methodName] = method.bind(taskService)
      ;(mockColumnService as any)[methodName] = method.bind(columnService)
      ;(mockBoardService as any)[methodName] = method.bind(boardService)
      ;(mockWorkspaceService as any)[methodName] = method.bind(workspaceService)
    }
  }

  const columnMethodsToCopy = Object.getOwnPropertyNames(ColumnService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of columnMethodsToCopy) {
    const method = (columnService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockColumnService as any)[methodName] = method.bind(columnService)
    }
  }
  const boardMethodsToCopy = Object.getOwnPropertyNames(BoardService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of boardMethodsToCopy) {
    const method = (boardService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockBoardService as any)[methodName] = method.bind(boardService)
    }
  }

  const taskMethodsToCopy = Object.getOwnPropertyNames(TaskService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of taskMethodsToCopy) {
    const method = (taskService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockTaskService as any)[methodName] = method.bind(taskService)
    }
  }

  const workspaceMethodsToCopy = Object.getOwnPropertyNames(WorkspaceService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of workspaceMethodsToCopy) {
    const method = (workspaceService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockWorkspaceService as any)[methodName] = method.bind(workspaceService)
    }
  }

  Object.assign(mockColumnService, columnService)
  Object.assign(mockBoardService, boardService)
  Object.assign(mockTaskService, taskService)
  Object.assign(mockWorkspaceService, workspaceService)

  /** AI SERVICES START */
  const chatMessageService = new ChatMessageService(chatMessageRepository, operationLogService)
  const transcriptionService = new TranscriptionService()
  const chatService = new ChatService(
    chatRespository,
    userService,
    operationLogService,
    chatMessageService,
    settingService,
    taskService,
    columnService,
    boardService,
    workspaceService,
    checkpointWriteRepository,
    checkpointRepository,
  )
  /** AI SERVICES END */
  const selectionService = new SelectionService(selectionRepository)

  const filterToMongoQueryService = new FilterToMongoQueryService(
    taskService,
    columnService,
    boardService,
    workspaceService,
    selectionService,
  )

  const taskToolsExecutorService = new TaskToolsExecutorService(
    taskRepository,
    taskService,
    vectorSearchService,
    columnService,
    filterToMongoQueryService,
    selectionService,
  )

  const columnToolsExecutorService = new ColumnToolsExecutorService(
    columnRepository,
    columnService,
    boardService,
    filterToMongoQueryService,
    selectionService,
  )

  const boardToolsExecutorService = new BoardToolsExecutorService(
    boardRepository,
    boardService,
    workspaceService,
    filterToMongoQueryService,
    selectionService,
  )

  const workspaceToolsExecutorService = new WorkspaceToolsExecutorService(
    workspaceRepository,
    workspaceService,
    filterToMongoQueryService,
    selectionService,
  )

  const generalToolsExecutor = new GeneralToolsExecutor(operationLogService)

  const authController = new AuthController(authService, userService)
  const workspaceController = new WorkspaceController(workspaceService)
  const boardController = new BoardController(boardService)
  const columnController = new ColumnController(columnService)
  const taskController = new TaskController(taskService)
  const archiveController = new ArchiveController(
    taskService,
    columnService,
    boardService,
    workspaceService,
  )
  const userController = new UserController(userService, emailService, authService)
  const settingController = new SettingController(settingService)
  const subscriptionController = new SubscriptionController(subscriptionService)
  const paymentController = new PaymentController(paymentService)
  const paymentMethodController = new PaymentMethodController(paymentMethodService)
  const operationLogController = new OperationLogController(operationLogService)
  const chatController = new ChatController(chatService)
  const chatMessageController = new ChatMessageController(chatMessageService)
  const supportController = new SupportController(supportRepository, emailService)
  const transcriptionController = new TranscriptionController(transcriptionService, userService)

  return {
    services: {
      vectorSearchService,
      authService,
      userService,
      emailService,
      tokenService,
      workspaceService,
      columnService,
      boardService,
      taskService,
      settingService,
      subscriptionService,
      paymentService,
      paymentMethodService,
      operationLogService,
      taskToolsExecutorService,
      columnToolsExecutorService,
      boardToolsExecutorService,
      workspaceToolsExecutorService,
      generalToolsExecutor,
      chatMessageService,
      chatService,
      transcriptionService,
    },
    controllers: {
      authController,
      workspaceController,
      boardController,
      columnController,
      taskController,
      archiveController,
      userController,
      settingController,
      subscriptionController,
      paymentController,
      paymentMethodController,
      operationLogController,
      chatController,
      chatMessageController,
      supportController,
      transcriptionController,
    },
    repositories: {
      checkpointRepository,
      checkpointWriteRepository,
      selectionRepository,
    },
  }
}
