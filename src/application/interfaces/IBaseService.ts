import { ICreateService } from '@traits/ICreateService.ts'
import { IGetByIdService } from '@traits/IGetByIdService.ts'
import { IGetAllService } from '@traits/IGetAllService.ts'
import { IEditService } from '@traits/IEditService.ts'
import { IDeleteService } from '@traits/IDeleteService.ts'
import { IArchiveService } from '@traits/IArchiveService.ts'
import { ICreateBulkService } from '@traits/ICreateBulkService.ts'
import { IGetCountService } from '@traits/IGetCountService.ts'

export interface IBaseService<
  TEntity,
  TCriteria = Record<string, any>,
  TCreateDTO = Record<string, any>
> extends ICreateService<TCreateDTO, TEntity>,
    ICreateBulkService<TCreateDTO, TEntity>,
    IGetByIdService<TEntity>,
    IGetCountService<TCriteria>,
    IGetAllService<TCriteria, TEntity>,
    IEditService<TCriteria, TEntity>,
    IDeleteService<TCriteria>,
    IArchiveService<TCriteria, TEntity> {}
