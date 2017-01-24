import { ISchema, ICollection, ICache, IParams } from './index';

export interface IResource extends IDataResource {
    schema?: ISchema;

    is_new: boolean;
    is_loading: boolean;

    memorycache: ICache;

    new? (): IResource;
    reset? (): void;
    addRelationship? (resource: IResource, type_alias?: string): void;
    addRelationships? (resources: Array<IResource>, type_alias: string): void;
    removeRelationship? (type_alias: string, id: string): boolean;
    save? (params?: IParams, fc_success?: Function, fc_error?: Function): any;
    toObject? (params?: IParams): IDataObject;
    register? (): boolean;
    // new? (): IResource;

    get (id: String, IParams?: Object | Function, success?: Function, error?: Function): IResource;
    all(params?: IParams | Function, success?: Function, error?: Function): ICollection;
    delete (id: String, params?: IParams | Function, success?: Function, error?: Function): void;

    getService? (): any;    // any, becouse depends of extended class
}
