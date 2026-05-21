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
import { CategoryService } from '@application/services/CategoryService.js'
import CategoryRepository from '@repositories/CategoryRepository.js'
import CategoryController from '@controllers/CategoryController.js'
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
import SandboxController from '../api/controllers/SandboxController.js'
import { ToolDispatcherService } from '@/application/ai/services/ToolDispatcherService.js'
import { CategoryToolsExecutorService } from '@/application/ai/services/CategoryToolsExecutorService.js'
import { TaskToolsExecutorService } from '@/application/ai/services/TaskToolsExecutorService.js'
import { BoardToolsExecutorService } from '@/application/ai/services/BoardToolsExecutorService.js'
import { WorkspaceToolsExecutorService } from '@/application/ai/services/WorkspaceToolsExecutorService.js'
import { GeneralToolsExecutor } from '@/application/ai/services/GeneralToolsExecutor.js'
import CheckpointWriteRepository from '@/application/repositories/CheckpointWriteRepository.js'
import CheckpointRepository from '@/application/repositories/CheckpointRepository.js'

export function initializeDependencies() {
  const mongoClient = new MongoClient(process.env.MONGO_URL || '')

  const userRepository = new UserRepository()
  const workspaceRepository = new WorkspaceRepository()
  const operationLogRepository = new OperationLogRepository()
  const boardRepository = new BoardRepository()
  const categoryRepository = new CategoryRepository()
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

  /* MOCK SERVICES START */
  const mockCategoryService = {} as CategoryService
  const mockBoardService = {} as BoardService
  const mockTaskService = {} as TaskService
  const mockWorkspaceService = {} as WorkspaceService
  /* MOCK SERVICES END */

  const embeddingService = new EmbeddingService()
  const operationLogService = new OperationLogService(
    operationLogRepository,
    new Map<string, IRevertableService>([
      ['tasks', mockTaskService],
      ['categories', mockCategoryService],
      ['boards', mockBoardService],
      ['workspaces', mockWorkspaceService],
    ]),

    mockCategoryService,
    mockBoardService,
    mockWorkspaceService,
  )
  const vectorSearchService = new VectorSearchService(embeddingService, mongoClient)

  const limitService = new LimitService(
    mockBoardService,
    mockCategoryService,
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
    mockCategoryService,
    mockBoardService,
    mockWorkspaceService,
    limitService,
  )
  /* TASK SERVICES END */

  /* CATEGORY SERVICES START */
  const categoryService = new CategoryService(
    categoryRepository,
    embeddingService,
    operationLogService,
    mockWorkspaceService,
    mockBoardService,
    taskService,
    limitService,
  )
  /* CATEGORY SERVICES END */

  /* BOARD SERVICES START */
  const boardService = new BoardService(
    boardRepository,
    embeddingService,
    operationLogService,
    mockWorkspaceService,
    categoryService,
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
    categoryService,
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
      ;(mockCategoryService as any)[methodName] = method.bind(categoryService)
      ;(mockBoardService as any)[methodName] = method.bind(boardService)
      ;(mockWorkspaceService as any)[methodName] = method.bind(workspaceService)
    }
  }

  const categoryMethodsToCopy = Object.getOwnPropertyNames(CategoryService.prototype).filter(
    (name) => name !== 'constructor',
  )

  for (const methodName of categoryMethodsToCopy) {
    const method = (categoryService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockCategoryService as any)[methodName] = method.bind(categoryService)
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

  Object.assign(mockCategoryService, categoryService)
  Object.assign(mockBoardService, boardService)
  Object.assign(mockTaskService, taskService)
  Object.assign(mockWorkspaceService, workspaceService)

  /** AI SERVICES START */
  const chatMessageService = new ChatMessageService(chatMessageRepository, operationLogService)
  const chatService = new ChatService(
    chatRespository,
    userService,
    operationLogService,
    chatMessageService,
    settingService,
    taskService,
    categoryService,
    boardService,
    workspaceService,
    checkpointWriteRepository,
    checkpointRepository,
  )
  /** AI SERVICES END */

  const taskToolsExecutorService = new TaskToolsExecutorService(
    taskRepository,
    taskService,
    categoryService,
    operationLogService,
    chatMessageService,
    vectorSearchService,
  )

  const categoryToolsExecutorService = new CategoryToolsExecutorService(
    categoryRepository,
    categoryService,
    boardService,
    operationLogService,
    chatMessageService,
    vectorSearchService,
  )

  const boardToolsExecutorService = new BoardToolsExecutorService(
    boardRepository,
    boardService,
    workspaceService,
    operationLogService,
    chatMessageService,
    vectorSearchService,
  )

  const workspaceToolsExecutorService = new WorkspaceToolsExecutorService(
    workspaceRepository,
    workspaceService,
    operationLogService,
    chatMessageService,
    vectorSearchService,
  )

  const generalToolsExecutor = new GeneralToolsExecutor(
    taskService,
    categoryService,
    boardService,
    workspaceService,
    chatMessageService,
    operationLogService,
  )

  const toolDispatcherService = new ToolDispatcherService(
    workspaceToolsExecutorService,
    boardToolsExecutorService,
    categoryToolsExecutorService,
    taskToolsExecutorService,
    generalToolsExecutor,
  )

  const authController = new AuthController(authService, userService)
  const workspaceController = new WorkspaceController(workspaceService)
  const boardController = new BoardController(boardService)
  const categoryController = new CategoryController(categoryService)
  const taskController = new TaskController(taskService)
  const archiveController = new ArchiveController(
    taskService,
    categoryService,
    boardService,
    workspaceService,
  )
  const userController = new UserController(userService, emailService)
  const settingController = new SettingController(settingService)
  const subscriptionController = new SubscriptionController(subscriptionService)
  const paymentController = new PaymentController(paymentService)
  const paymentMethodController = new PaymentMethodController(paymentMethodService)
  const operationLogController = new OperationLogController(operationLogService)
  const chatController = new ChatController(chatService)
  const chatMessageController = new ChatMessageController(chatMessageService)
  const supportController = new SupportController(supportRepository, emailService)
  const sandboxController = new SandboxController(toolDispatcherService)

  return {
    services: {
      vectorSearchService,
      authService,
      userService,
      emailService,
      tokenService,
      workspaceService,
      categoryService,
      boardService,
      taskService,
      settingService,
      subscriptionService,
      paymentService,
      paymentMethodService,
      operationLogService,
      toolDispatcherService,
      chatMessageService,
      chatService,
    },
    controllers: {
      authController,
      workspaceController,
      boardController,
      categoryController,
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
      sandboxController,
    },
  }
}
