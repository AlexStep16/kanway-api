import { ICreateService } from '@traits/ICreateService.ts'
import { IGetByIdService } from '@traits/IGetByIdService.ts'
import { IGetAllService } from '@traits/IGetAllService.ts'
import { IEditService } from '@traits/IEditService.ts'
import { IDeleteService } from '@traits/IDeleteService.ts'
import { IArchiveService } from '@traits/IArchiveService.ts'

export interface IBaseService<
  TEntity,
  TCriteria = Record<string, any>,
  TCreateDTO = Record<string, any>
> extends ICreateService<TCreateDTO, TEntity>,
    IGetByIdService<TEntity>,
    IGetAllService<TCriteria, TEntity>,
    IEditService<TCriteria, TEntity>,
    IDeleteService<TCriteria>,
    IArchiveService<TCriteria, TEntity> {}
