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
import { ReorderService } from '@application/services/ReorderService.ts'
import { BoardService } from '@application/services/BoardService.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import BoardController from '@controllers/BoardController.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import CategoryController from '@controllers/CategoryController.ts'
import TaskRepository from '@application/repositories/TaskRepository.ts'
import { TaskService } from '@application/services/TaskService.ts'
import TaskController from '@controllers/TaskController.ts'
import { ITaskRaw } from '@entities/ITaskRaw.ts'
import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import { IBoardRaw } from '@entities/IBoardRaw.ts'
import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
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
import { TaskToolAdapter } from '@application/ai/tools/TaskToolAdapter.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { MongoClient } from 'mongodb'
import { TaskCommandAdapterService } from '@/application/ai/services/TaskCommandAdapterService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { FilterToMongoQueryService } from '@application/ai/services/FilterToMongoQueryService.ts'
import { CategoryCommandAdapterService } from '@application/ai/services/CategoryCommandAdapterService.ts'
import { CategoryToolAdapter } from '@application/ai/tools/CategoryToolAdapter.ts'
import { BoardCommandAdapterService } from '@application/ai/services/BoardCommandAdapterService.ts'
import { BoardToolAdapter } from '@application/ai/tools/BoardToolAdapter.ts'
import { WorkspaceCommandAdapterService } from '@application/ai/services/WorkspaceCommandAdapterService.ts'
import { WorkspaceToolAdapter } from '@application/ai/tools/WorkspaceToolAdapter.ts'
import { ToolExecutorService } from '@application/ai/services/ToolExecutorService.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'
import { ChatMessageService } from '@application/services/ChatMessageService.ts'
import { ChatService } from '@application/services/ChatService.ts'
import ChatRepository from '@application/repositories/ChatRepository.ts'
import ChatController from '@controllers/ChatController.ts'
import ChatMessageController from '@controllers/ChatMessageController.ts'
import { ToolService } from '@application/services/ToolService.ts'
import ToolRepository from '@repositories/ToolRepository.ts'
import AgentInstructionRepository from '@repositories/AgentInstructionRepository.ts'
import { AgentInstructionService } from '@application/services/AgentInstructionService.ts'
import { BaseToolAdapter } from '@/application/ai/tools/BaseToolAdapter.ts'
import { ITask } from '@/domain/entities/ITask.ts'
import { ICategory } from '@/domain/entities/ICategory.ts'
import { IBoard } from '@/domain/entities/IBoard.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'
import { ITaskCriteria } from '@/application/interfaces/criterias/ITaskCriteria.ts'
import { ICategoryCriteria } from '@/application/interfaces/criterias/ICategoryCriteria.ts'
import { IBoardCriteria } from '@/application/interfaces/criterias/IBoardCriteria.ts'
import { IWorkspaceCriteria } from '@/application/interfaces/criterias/IWorkspaceCriteria.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { ITaskCreatePayload } from '@/application/interfaces/ITaskCreatePayload.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { ICategoryCreatePayload } from '@/application/interfaces/ICategoryCreatePayload.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { IBoardCreatePayload } from '@/application/interfaces/IBoardCreatePayload.ts'
import { IWorkspaceCreatePayload } from '@/application/interfaces/IWorkspaceCreatePayload.ts'

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
  const toolRepository = new ToolRepository()
  const agentInstructionRepository = new AgentInstructionRepository()

  /* MOCK SERVICES START */
  const mockCategoryService = {} as CategoryService
  const mockBoardService = {} as BoardService
  const mockTaskService = {} as TaskService
  const mockWorkspaceService = {} as WorkspaceService
  /* MOCK SERVICES END */

  const embeddingService = new EmbeddingService()
  const operationLogService = new OperationLogService(
    operationLogRepository,
    new Map<string, IRevertableService<any>>([
      ['tasks', mockTaskService],
      ['categories', mockCategoryService],
      ['boards', mockBoardService],
      ['workspaces', mockWorkspaceService],
    ])
  )
  const vectorSearchService = new VectorSearchService(embeddingService, mongoClient)

  /* SETTING SERVICES START */
  const settingService = new SettingService(settingRepository)
  /* SETTING SERVICES END */

  /* SUBSCRIPTION SERVICES START */
  const subscriptionService = new SubscriptionService(subscriptionRepository)
  /* SUBSCRIPTION SERVICES END */

  /* AUTH SERVICES START */
  const tokenService = new TokenService(tokenRepository)
  const userService = new UserService(userRepository)
  const emailService = new EmailService(tokenRepository, tokenService)
  const authService = new AuthService(userService, emailService, tokenService, settingService)
  /* AUTH SERVICES END */

  /* PAYMENT SERVICES START */
  const paymentService = new PaymentService(paymentRepository)
  const paymentMethodService = new PaymentMethodService(paymentMethodRepository, userService)
  /* PAYMENT SERVICES END */

  /* TASK SERVICES START */
  const taskReorderService = new ReorderService<
    ITask,
    ITaskRaw,
    ITaskCriteria,
    ITaskPopulated,
    ITaskCreatePayload
  >(taskRepository)
  const taskService = new TaskService(
    taskRepository,
    embeddingService,
    operationLogService,
    taskReorderService,
    mockCategoryService,
    mockBoardService,
    mockWorkspaceService
  )
  /* TASK SERVICES END */

  /* CATEGORY SERVICES START */
  const categoryReorderService = new ReorderService<
    ICategory,
    ICategoryRaw,
    ICategoryCriteria,
    ICategoryPopulated,
    ICategoryCreatePayload
  >(categoryRepository)
  const categoryService = new CategoryService(
    categoryRepository,
    embeddingService,
    operationLogService,
    categoryReorderService,
    mockWorkspaceService,
    mockBoardService,
    taskService
  )
  /* CATEGORY SERVICES END */

  /* BOARD SERVICES START */
  const boardReorderService = new ReorderService<
    IBoard,
    IBoardRaw,
    IBoardCriteria,
    IBoardPopulated,
    IBoardCreatePayload
  >(boardRepository)
  const boardService = new BoardService(
    boardRepository,
    embeddingService,
    operationLogService,
    boardReorderService,
    mockWorkspaceService,
    categoryService,
    taskService
  )
  /* BOARD SERVICES END */

  /* WORKSPACE SERVICES START */
  const workspaceReorderService = new ReorderService<
    IWorkspace,
    IWorkspaceRaw,
    IWorkspaceCriteria,
    IWorkspace,
    IWorkspaceCreatePayload
  >(workspaceRepository)
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    embeddingService,
    operationLogService,
    workspaceReorderService,
    boardService,
    categoryService,
    taskService
  )
  /* WORKSPACE SERVICES END */

  const categoryMethodsToCopy = Object.getOwnPropertyNames(CategoryService.prototype).filter(
    (name) => name !== 'constructor'
  )

  for (const methodName of categoryMethodsToCopy) {
    const method = (categoryService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockCategoryService as any)[methodName] = method.bind(categoryService)
    }
  }
  const boardMethodsToCopy = Object.getOwnPropertyNames(BoardService.prototype).filter(
    (name) => name !== 'constructor'
  )

  for (const methodName of boardMethodsToCopy) {
    const method = (boardService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockBoardService as any)[methodName] = method.bind(boardService)
    }
  }

  const taskMethodsToCopy = Object.getOwnPropertyNames(TaskService.prototype).filter(
    (name) => name !== 'constructor'
  )

  for (const methodName of taskMethodsToCopy) {
    const method = (taskService.constructor.prototype as any)[methodName]

    if (typeof method === 'function') {
      ;(mockTaskService as any)[methodName] = method.bind(taskService)
    }
  }

  const workspaceMethodsToCopy = Object.getOwnPropertyNames(WorkspaceService.prototype).filter(
    (name) => name !== 'constructor'
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
  const aiSemanticService = new AISemanticService()
  const filterToMongoQueryService = new FilterToMongoQueryService(
    taskService,
    categoryService,
    boardService
  )
  const contextExternalFetchService = new ContextExternalFetchService(
    taskService,
    categoryService,
    boardService,
    workspaceService
  )
  const chatMessageService = new ChatMessageService(chatMessageRepository, operationLogService)
  const chatService = new ChatService(
    chatRespository,
    operationLogService,
    chatMessageService,
    settingService,
    contextExternalFetchService
  )
  const toolService = new ToolService(toolRepository, embeddingService)
  const agentInstructionService = new AgentInstructionService(
    agentInstructionRepository,
    embeddingService
  )
  /** AI SERVICES END */

  /** TOOLS ADAPTERS START */
  const taskCommandAdapter = new TaskCommandAdapterService(
    taskService,
    categoryService,
    vectorSearchService,
    aiSemanticService
  )
  const baseToolAdapter = new BaseToolAdapter(
    vectorSearchService,
    operationLogService,
    taskService,
    categoryService,
    boardService,
    workspaceService
  )

  const taskToolAdapter = new TaskToolAdapter(
    vectorSearchService,
    taskService,
    taskCommandAdapter,
    categoryService,
    filterToMongoQueryService
  )

  const categoryCommandAdapter = new CategoryCommandAdapterService(
    categoryService,
    boardService,
    vectorSearchService,
    aiSemanticService
  )
  const categoryToolAdapter = new CategoryToolAdapter(
    vectorSearchService,
    categoryService,
    categoryCommandAdapter,
    filterToMongoQueryService,
    boardService
  )

  const boardCommandAdapter = new BoardCommandAdapterService(
    boardService,
    workspaceService,
    vectorSearchService,
    aiSemanticService
  )
  const boardToolAdapter = new BoardToolAdapter(
    vectorSearchService,
    boardService,
    boardCommandAdapter,
    filterToMongoQueryService,
    workspaceService
  )

  const workspaceCommandAdapter = new WorkspaceCommandAdapterService(
    workspaceService,
    vectorSearchService,
    aiSemanticService
  )
  const workspaceToolAdapter = new WorkspaceToolAdapter(
    vectorSearchService,
    workspaceService,
    workspaceCommandAdapter,
    filterToMongoQueryService
  )
  /** TOOLS ADAPTERS END */

  const toolExecutorService = new ToolExecutorService(
    vectorSearchService,
    operationLogService,
    baseToolAdapter,
    taskToolAdapter,
    categoryToolAdapter,
    boardToolAdapter,
    workspaceToolAdapter
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
    workspaceService
  )
  const userController = new UserController(userService)
  const settingController = new SettingController(settingService)
  const subscriptionController = new SubscriptionController(subscriptionService)
  const paymentController = new PaymentController(paymentService)
  const paymentMethodController = new PaymentMethodController(paymentMethodService)
  const operationLogController = new OperationLogController(operationLogService)
  const chatController = new ChatController(chatService)
  const chatMessageController = new ChatMessageController(chatMessageService)

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
      filterToMongoQueryService,
      paymentService,
      paymentMethodService,
      operationLogService,
      toolExecutorService,
      chatMessageService,
      toolService,
      contextExternalFetchService,
      chatService,
      agentInstructionService,
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
    },
    adapters: {
      baseToolAdapter,
      taskToolAdapter,
      categoryToolAdapter,
      boardToolAdapter,
      workspaceToolAdapter,
    },
  }
}
