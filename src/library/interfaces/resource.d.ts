import { ISchema, ICollection, ICache, IParamsCollection, IParamsResource } from './index';

export interface IResource extends IDataResource {
    schema?: ISchema;

    is_new: boolean;
    is_loading: boolean;
    is_saving: boolean;
    lastupdate?: number;

    memorycache: ICache;

    new? (): IResource;
    reset? (): void;
    addRelationship? (resource: IResource, type_alias?: string): void;
    addRelationships? (resources: ICollection, type_alias: string): void;
    removeRelationship? (type_alias: string, id: string): boolean;
    addRelationshipsArray <T extends IResource>(resources: Array<T>, type_alias?: string): void;
    save? (params?: IParamsResource, fc_success?: Function, fc_error?: Function): any;
    toObject? (params?: IParamsResource): IDataObject;
    register? (): boolean;
    // new? (): IResource;

    get (id: String, params?: Object | Function, success?: Function, error?: Function): IResource;
    all(params?: IParamsCollection | Function, success?: Function, error?: Function): ICollection;
    delete (id: String, params?: IParamsResource | Function, success?: Function, error?: Function): void;

    getService? (): any;    // any, becouse depends of extended class
    clearMemoryCache? (): boolean;
}
