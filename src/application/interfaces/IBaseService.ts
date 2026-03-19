import { ICreateService } from '@traits/ICreateService.ts'
import { IGetAllService } from '@traits/IGetAllService.ts'
import { IEditService } from '@traits/IEditService.ts'
import { IDeleteService } from '@traits/IDeleteService.ts'
import { IArchiveService } from '@traits/IArchiveService.ts'
import { ICreateManyService } from '@application/interfaces/traits/ICreateManyService.ts'
import { IRecoverService } from '@traits/IRecoverService.ts'
import { ICloneService } from '@traits/ICloneService.ts'
import { IEditManyService } from '@traits/IEditManyService.ts'
import { IGetCountService } from '@traits/IGetCountService.ts'
import { IRevertableService } from '@traits/IRevertableService.ts'

export interface IBaseService<
  TEntity,
  TCriteria = Record<string, any>,
  TCreateDTO = Record<string, any>,
  TEditDTO = Record<string, any>,
  TClonedResult = Record<string, Array<any>>,
  TWithChildrenResult = Record<string, Array<any>>,
  TCreateResult = Record<string, any>,
>
  extends
    ICreateService<TCreateResult, TCreateDTO>,
    ICreateManyService<TCreateDTO, TEntity>,
    IGetCountService<TCriteria>,
    IGetAllService<TCriteria, TEntity>,
    IEditService<TCriteria, TEntity, TEditDTO>,
    IEditManyService<TEntity, TEditDTO>,
    IDeleteService<TEntity, TCriteria>,
    IRecoverService<TCriteria, TWithChildrenResult>,
    IArchiveService<TCriteria, TWithChildrenResult>,
    ICloneService<TCriteria, TClonedResult>,
    IRevertableService {}
