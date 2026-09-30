<div align="center">

# ⚙️ Kanway Backend (API & Agentic Engine)

**Распределенный бэкенд и мульти-агентный AI-оркестратор платформы Kanway**  
*Обработка потоковых данных, агентные графы LangGraph, фоновые очереди BullMQ и ядро Канбан-доски*

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Core-FF9900?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraphjs/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis & BullMQ](https://img.shields.io/badge/BullMQ-Redis_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://bullmq.io/)
[![YooKassa](https://img.shields.io/badge/Payments-YooKassa-8B00FF?style=for-the-badge)](https://yookassa.ru/)
[![Sentry](https://img.shields.io/badge/Sentry-Node_10-362D59?style=for-the-badge&logo=sentry&logoColor=white)](https://sentry.io/)

</div>

---

## 🏗️ Архитектура и ключевые инженерные решения

Сервис спроектирован по принципам **Clean Architecture / Domain-Driven Design (DDD)** с четким разделением на доменные сущности, сервисный слой, инфраструктуру и асинхронные обработчики.

```text
                     ┌───────────────────────┐
                     │   Клиент (Nuxt 4)     │
                     └──────────┬────────────┘
                                │ REST / SSE / WebSockets
                                ▼
                     ┌───────────────────────┐
                     │      Express API      │
                     └──────────┬────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌──────────────┐       ┌─────────────────┐      ┌─────────────────┐
│ MongoDB      │       │ Redis (BullMQ)  │      │ Vector Search   │
│ - Mongoose   │       │ - Message Bus   │      │ - hnswlib-node  │
│ - Checkpoints│       │ - Task Queues   │      │ - Embeddings    │
└──────────────┘       └────────┬────────┘      └─────────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌──────────────┐       ┌─────────────────┐      ┌─────────────────┐
│ RunAgent     │       │ Subscription    │      │ Embeddings      │
│ Worker       │       │ Worker          │      │ Generation      │
│ (LangGraph)  │       │ (Recur Payments)│      │ Worker          │
└──────────────┘       └─────────────────┘      └─────────────────┘
```

### 1. Мульти-агентная оркестрация (LangGraph & ReAct)
Ядро изменения досок на лету построено на направленном графе состояний **LangGraph**:
- **Orchestrator Node (`makeOrchestratorNode`):** Анализирует намерения пользователя, декомпозирует контекст сообщений и направляет задачи специализированным субагентам.
- **Entity Manager Node (`makeEntityManagerAgentNode`):** Отвечает за вызовы инструментов (Tool Calling) мутации базы данных: создание колонок, сдвиг карточек, изменение метаданных и тегов.
- **Human-in-the-loop & Verification Node (`makeToolHumanReviewNode`):** Механизм валидации опасных действий (массовое удаление, сброс состояний) для защиты целостности пользовательских данных.
- **Summarizer Node:** Автоматическое сжатие длинных веток обсуждений для оптимизации контекстного окна LLM и снижения затрат на токены.
- **State Checkpointing:** Персистентное сохранение состояния графа в MongoDB (`@langchain/langgraph-checkpoint-mongodb`).

### 2. Алгоритм позиционирования Lexorank
Для обеспечения O(1) изменения порядка колонок и карточек при Drag-and-Drop используется промышленный алгоритм **Lexorank** (аналогично Jira). Это исключает необходимость тяжелых каскадных обновлений индексов всей доски при переносе задачи.

### 3. Распределенная очередь задач (BullMQ + Redis)
Тяжелые вычислительные и AI-процессы вынесены из главного API-потока в независимые воркеры:
- **`RunAgentWorker`:** Фоновое исполнение шагов графа LangGraph и стриминг ответов.
- **`EmbeddingsGeneration`:** Асинхронная векторизация карточек для семантического поиска через HNSW-индексы (`hnswlib-node`).
- **`SubscriptionWorker`:** Автоматическое управление тарифными планами, кредитами и рекуррентными списаниями.

### 4. Transactional Outbox Pattern
Использование `OutboxEventService` гарантирует надежную доставку доменных событий: изменения сущностей сохраняются в единой транзакции с событиями outbox, исключая рассинхронизацию между базой данных и очередями сообщений.

---

## 🛠️ Технологический стек

| Категория | Технологии |
| :--- | :--- |
| **Среда & Язык** | [Node.js 20+](https://nodejs.org/), [TypeScript 5.9](https://www.typescriptlang.org/) (`tsc-alias`, strict mode) |
| **HTTP-сервер** | [Express 4](https://expressjs.com/), `cors`, `cookie-parser`, `express-rate-limit`, `rate-limit-redis` |
| **Agentic AI & LLM** | [LangGraph](https://langchain-ai.github.io/langgraphjs/), [LangChain Core](https://js.langchain.com/), OpenAI API, Google VertexAI / Gemini, Fireworks, [LangSmith](https://smith.langchain.com/) |
| **Базы данных** | [MongoDB 6](https://www.mongodb.com/) + [Mongoose 8](https://mongoosejs.com/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| **Очереди & Кеш** | [Redis](https://redis.io/) (`ioredis`), [BullMQ 5](https://bullmq.io/) |
| **Поиск & Векторы** | `hnswlib-node` (Hierarchical Navigable Small World graphs), `fuse.js` (нечеткий поиск) |
| **Сортировка доски** | `lexorank` (лексикографическое ранжирование карточек) |
| **Биллинг & Платежи** | [ЮKassa API](https://yookassa.ru/) (`@a2seven/yoo-checkout`) |
| **Аутентификация** | `passport`, `passport-jwt`, `bcrypt`, `jsonwebtoken`, `@zxcvbn-ts` (оценка стойкости паролей) |
| **Email-рассылки** | `resend`, `nodemailer` |
| **Аналитика & Мониторинг** | [@sentry/node 10](https://sentry.io/) |

---

## 📂 Структура репозитория

```text
src/
├── app.ts                         # Точка входа HTTP сервера, инициализация middleware
├── createApiRouter.ts             # Декларативная регистрация роутов модулей
├── limiters.ts                    # Конфигурация распределенного rate-limiting (Redis)
├── application/                   # Слой бизнес-логики приложения
│   ├── ai/                        # Модуль искусственного интеллекта
│   │   ├── agent/                 # Графы LangGraph, ноды (Nodes), ребра (Edges)
│   │   ├── prompts/               # Системные инструкции и промпты субагентов
│   │   ├── tools/                 # Tool-функции для модификации задач и колонок
│   │   └── createReActAgent.ts    # Фабрика агента
│   ├── dtos/                      # Схемы валидации входных/выходных данных (Zod)
│   ├── interfaces/                # Контракты сервисов и репозиториев
│   ├── repositories/              # Слой доступа к данным (Mongoose Models)
│   └── services/                  # Сервисы (Board, Column, Chat, Payment, Auth, Outbox)
├── domain/                        # Доменные сущности, логика предметной области
├── infrastructure/                # Внешние интеграции и инфраструктурный код
│   ├── db/                        # Подключение к MongoDB и SQLite
│   └── workers/                   # Воркеры фоновых очередей BullMQ
│       ├── RunAgentWorker.ts      # Обработка шагов графа агента
│       ├── SubscriptionWorker.ts  # Обработка платежей и продления подписок
│       └── EmbeddingsGeneration.ts# Фоновая генерация векторов задач
└── utils/                         # Общие хелперы, криптография, форматирование дат
```

---

## 🚀 Локальное развертывание

### Предварительные требования
- **Node.js** версии 20+
- **pnpm 10+**
- **Docker & Docker Compose** (для локального поднятия MongoDB и Redis)

### 1. Клонирование и установка зависимостей

```bash
git clone https://github.com/AlexStep16/kanway-api.git
cd kanway-api
pnpm install
```

### 2. Поднятие инфраструктуры (Docker)

```bash
# Быстрый запуск Redis и MongoDB
docker run -d --name kanway-redis -p 6379:6379 redis:alpine
docker run -d --name kanway-mongo -p 27017:27017 mongo:latest
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта на основе необходимых ключей:

```env
NODE_ENV="development"
PORT=3333

# Базы данных и очереди
MONGO_URI="mongodb://localhost:27017/kanway"
REDIS_HOST="localhost"
REDIS_PORT=6379

# Безопасность и сессии
JWT_SECRET="your-super-secret-jwt-key"
COOKIE_SECRET="your-cookie-secret"

# Провайдеры LLM & AI
OPENAI_API_KEY="sk-..."
GOOGLE_VERTEX_PROJECT="your-project-id"
FIREWORKS_API_KEY="..."
LANGSMITH_API_KEY="..."

# Платежные шлюзы (ЮKassa)
YOOKASSA_SHOP_ID="your_shop_id"
YOOKASSA_SECRET_KEY="your_secret_key"

# Почтовые сервисы
RESEND_API_KEY="re_..."

# Мониторинг
SENTRY_DSN="https://...@sentry.io/..."
```

### 4. Запуск в режиме разработки

Команда `pnpm run dev` с помощью `concurrently` параллельно запускает HTTP-сервер и все три фоновых воркера BullMQ с поддержкой Hot-Reload (`tsx watch`):

```bash
pnpm run dev
```

Отдельный запуск микросервисов/воркеров:
```bash
pnpm run start:api             # Только Express API (порт 3333)
pnpm run start:agent           # Воркер агента LangGraph
pnpm run start:embeddings      # Воркер векторных эмбеддингов
pnpm run start:subscriptions   # Воркер биллинга и подписок
```

---

## 🔨 Сборка для продакшена

```bash
# Компиляция TypeScript и резолв алиасов путей (@db, @application)
pnpm run build

# Продакшен-запуск скомпилированного бандла
pnpm run start
```

Для управления процессами на продакшен-сервере подготовлен готовый конфиг PM2:
```bash
pm2 start ecosystem.config.cjs
```

---

## 👨‍💻 Автор

**Александр Иванов** ([@AlexStep16](https://github.com/AlexStep16))  
*Fullstack & AI Product Developer*

---
