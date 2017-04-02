import { ISchema, IResource, ICollection, IParamsCollection, IParamsResource } from './index';

export interface IService {
    schema?: ISchema;
    new? (): IResource;
    register? (): boolean;
    get (id: String, params?: Object | Function, success?: Function, error?: Function): IResource;
    all(params?: IParamsCollection | Function, success?: Function, error?: Function): ICollection;
    delete (id: String, params?: IParamsResource | Function, success?: Function, error?: Function): void;
    getService? (): any;    // any, becouse depends of extended class
    clearMemoryCache? (): boolean;
}
