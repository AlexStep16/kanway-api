import { ICreateService } from '@traits/ICreateService.js'
import { IGetAllService } from '@traits/IGetAllService.js'
import { IEditService } from '@traits/IEditService.js'
import { IDeleteService } from '@traits/IDeleteService.js'
import { IArchiveService } from '@traits/IArchiveService.js'
import { ICreateManyService } from '@application/interfaces/traits/ICreateManyService.js'
import { IRecoverService } from '@traits/IRecoverService.js'
import { ICloneService } from '@traits/ICloneService.js'
import { IEditManyService } from '@traits/IEditManyService.js'
import { IGetCountService } from '@traits/IGetCountService.js'
import { IRevertableService } from '@traits/IRevertableService.js'

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
