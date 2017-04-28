import { ISchema, IResource, ICollection, IParamsCollection, ICache, IParamsResource } from './index';

export interface IService {
    type: string;
    schema: ISchema;
    getPrePath(): string;
    getPath(): string;
    register(): boolean;
    get<T extends IResource>(id: string | number, params?: IParamsResource | Function, fc_success?: Function, fc_error?: Function): T;
    all(params?: IParamsCollection | Function, success?: Function, error?: Function): ICollection;
    delete (id: String, params?: IParamsResource | Function, success?: Function, error?: Function): void;
    getService<T extends IService> ():T;
    clearMemoryCache? (): boolean;
    new?<T extends IResource>(): T;
    memorycache: ICache;
}
