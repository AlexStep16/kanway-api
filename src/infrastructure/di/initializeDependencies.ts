import AuthController from '@controllers/AuthController.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { UserService } from '@application/services/UserService.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import TokenRepository from '@repositories/TokenRepository.ts'
import { TokenService } from '@application/services/TokenService.ts'
import WorkspaceController from '@controllers/WorkspaceController.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import WorkspaceRepository from '@repositories/WorkspaceRepository.ts'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { BoardService } from '@application/services/BoardService.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import BoardController from '@controllers/BoardController.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import CategoryController from '@controllers/CategoryController.ts'
import TaskRepository from '@application/repositories/TaskRepository.ts'
import { TaskService } from '@application/services/TaskService.ts'
import TaskController from '@controllers/TaskController.ts'
import ArchiveController from '@controllers/ArchiveController.ts'
import { UserController } from '@controllers/UserController.ts'
import SettingRepository from '@repositories/SettingRepository.ts'
import { SettingService } from '@application/services/SettingService.ts'
import { SettingController } from '@controllers/SettingController.ts'
import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { SubscriptionService } from '@application/services/SubscriptionService.ts'
import { SubscriptionController } from '@controllers/SubscriptionController.ts'
import PaymentRepository from '@repositories/PaymentRepository.ts'
import { PaymentService } from '@application/services/PaymentService.ts'
import { PaymentController } from '@controllers/PaymentController.ts'
import PaymentMethodRepository from '@repositories/PaymentMethodRepository.ts'
import ChatMessageRepository from '@repositories/ChatMessageRepository.ts'
import { PaymentMethodService } from '@application/services/PaymentMethodService.ts'
import { PaymentMethodController } from '@controllers/PaymentMethodController.ts'
import { IRevertableService } from '@interfaces/traits/IRevertableService.ts'
import { OperationLogController } from '@controllers/OperationLogController.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { MongoClient } from 'mongodb'
import { ChatMessageService } from '@application/services/ChatMessageService.ts'
import { ChatService } from '@application/services/ChatService.ts'
import ChatRepository from '@application/repositories/ChatRepository.ts'
import ChatController from '@controllers/ChatController.ts'
import ChatMessageController from '@controllers/ChatMessageController.ts'
import SupportController from '../api/controllers/SupportController.ts'
import SupportRepository from '@/application/repositories/SupportRepository.ts'
import { BaseService } from '@/application/services/BaseService.ts'
import { LimitService } from '@/application/services/LimitService.ts'
import SandboxController from '../api/controllers/SandboxController.ts'
import { ToolDispatcherService } from '@/application/ai/services/ToolDispatcherService.ts'
import { CategoryToolsExecutorService } from '@/application/ai/services/CategoryToolsExecutorService.ts'
import { TaskToolsExecutorService } from '@/application/ai/services/TaskToolsExecutorService.ts'
import { BoardToolsExecutorService } from '@/application/ai/services/BoardToolsExecutorService.ts'
import { WorkspaceToolsExecutorService } from '@/application/ai/services/WorkspaceToolsExecutorService.ts'
import { GeneralToolsExecutor } from '@/application/ai/services/GeneralToolsExecutor.ts'
import CheckpointWriteRepository from '@/application/repositories/CheckpointWriteRepository.ts'
import CheckpointRepository from '@/application/repositories/CheckpointRepository.ts'

export function initializeDependencies() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI || '')

  const userRepository = new UserRepository()
  const tokenRepository = new TokenRepository()
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

  const limitService = new LimitService(mockBoardService, mockWorkspaceService)

  /* SETTING SERVICES START */
  const settingService = new SettingService(settingRepository)
  /* SETTING SERVICES END */

  /* SUBSCRIPTION SERVICES START */
  const subscriptionService = new SubscriptionService(subscriptionRepository)
  /* SUBSCRIPTION SERVICES END */

  /* AUTH SERVICES START */
  const tokenService = new TokenService(tokenRepository)
  const emailService = new EmailService(tokenRepository, tokenService)
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

  const authController = new AuthController(authService)
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
