import { ICreateService } from '@traits/ICreateService.ts'
import { IGetByIdService } from '@traits/IGetByIdService.ts'
import { IGetAllService } from '@traits/IGetAllService.ts'
import { IEditService } from '@traits/IEditService.ts'
import { IDeleteService } from '@traits/IDeleteService.ts'
import { IArchiveService } from '@traits/IArchiveService.ts'
import { ICreateManyService } from '@/application/interfaces/traits/ICreateManyService.ts'
import { IGetCountService } from '@traits/IGetCountService.ts'
import { IRecoverService } from '@traits/IRecoverService.ts'

export interface IBaseService<
  TEntity,
  TCriteria = Record<string, any>,
  TCreateDTO = Record<string, any>
> extends ICreateService<TCreateDTO, TEntity>,
    ICreateManyService<TCreateDTO, TEntity>,
    IGetByIdService<TEntity>,
    IGetCountService<TCriteria>,
    IGetAllService<TCriteria, TEntity>,
    IEditService<TCriteria, TEntity>,
    IDeleteService<TEntity, TCriteria>,
    IRecoverService<TCriteria, TEntity>,
    IArchiveService<TCriteria, TEntity> {}
