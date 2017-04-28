import { IRelationships, ICollection, IParamsResource, IService } from './index';
import { IDataResource } from './data-resource';
import { IDataObject } from './data-object';

export interface IResource extends IDataResource {
    is_new: boolean;
    is_loading: boolean;
    is_saving: boolean;
    lastupdate?: number;

    type: string;   // dont work extend?
    relationships: IRelationships;    // redefined from IDataResource

    reset? (): void;
    addRelationship? (resource: IResource, type_alias?: string): void;
    addRelationships? (resources: ICollection, type_alias: string): void;
    removeRelationship? (type_alias: string, id: string): boolean;
    addRelationshipsArray <T extends IResource>(resources: Array<T>, type_alias?: string): void;
    save? (params?: IParamsResource, fc_success?: Function, fc_error?: Function): any;
    toObject? (params?: IParamsResource): IDataObject;
    getService(): IService;
}
