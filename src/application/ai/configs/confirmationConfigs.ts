import { ObjectId } from "mongodb";
import TaskController from "../Controllers/TaskControllers/TaskController.ts";
import { AgentStateAnnotation } from "./AgentStateAnnotation.ts";
import CategoryController from "../Controllers/CategoryControllers/Category.ts";
import BoardController from "../Controllers/BoardControllers/Board.ts";
import WorkspaceController from "../Controllers/WorkspaceControllers/Workspace.ts";

type ConfirmationContextMode = 'tool' | 'external';

interface ConfirmationContextConfig {
  tip: string;
  context: {
    mode: ConfirmationContextMode;
    toolName?: string; // если mode === 'tool'
    externalFetch?: (params: {
      toolCall: any;
      state: typeof AgentStateAnnotation.State;
      config: any;
    }) => Promise<any>;
  };
  // (опционально) dependencies, другие поля
}
export const confirmationConfigs: Record<string, ConfirmationContextConfig> = {
  deleteTasks: {
    tip: "Будут удалены следующие задачи:",
    context: {
      mode: 'external',
      externalFetch: async ({ toolCall }) => {
        const ids: string[] = toolCall.args?._ids || [];
        const objectIds = ids.map(id => ObjectId.createFromHexString(id));

        return {
          result: await TaskController.getTasksByIdFilledHandler(objectIds)
        };
      }
    }
  },
  deleteCategories: {
    tip: "Будут удалены следующие категории:",
    context: {
      mode: 'external',
      externalFetch: async ({ toolCall }) => {
        const ids: string[] = toolCall.args?._ids || [];
        const objectIds = ids.map(id => ObjectId.createFromHexString(id));

        return {
          result: await CategoryController.getCategoriesByIdFilledHandler(objectIds)
        };
      }
    }
  },
  deleteBoards: {
    tip: "Будут удалены следующие доски:",
    context: {
      mode: 'external',
      externalFetch: async ({ toolCall }) => {
        const ids: string[] = toolCall.args?._ids || [];
        const objectIds = ids.map(id => ObjectId.createFromHexString(id));

        return {
          result: await BoardController.getBoardsByIdFilledHandler(objectIds)
        };
      }
    }
  },
  deleteWorkspaces: {
    tip: "Будут удалены следующие пространства:",
    context: {
      mode: 'external',
      externalFetch: async ({ toolCall }) => {
        const ids: string[] = toolCall.args?._ids || [];
        const objectIds = ids.map(id => ObjectId.createFromHexString(id));

        return {
          result: await WorkspaceController.getManyByIds(objectIds)
        };
      }
    }
  },
};