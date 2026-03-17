import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

interface CompressedWorkspace {
  id: string
  name: string
}

export function getCompressedWorkspaces(workspaces: IWorkspace[]): Array<CompressedWorkspace> {
  return workspaces.map((workspace) => ({
    id: workspace.id.toString(),
    name: workspace.name,
  }))
}
