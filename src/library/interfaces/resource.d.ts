declare module Jsonapi {
    interface IResource extends IDataResource {
        schema?: ISchema;

        is_new: boolean;

        clone? (resource: Jsonapi.IResource, type_alias?: string): Object;
        addRelationship? (resource: IResource, type_alias?: string): void;
        addRelationships? (resources: Array<IResource>, type_alias: string): void;
        removeRelationship? (type_alias: string, id: string): boolean;
        save? (params: IParams, fc_success: Function, fc_error: Function): any;
        toObject? (params?: Jsonapi.IParams): IDataObject;
        register? (): boolean;
        // new? (): IResource;
        get? (id: String): IResource;
        all? (): Array<IResource>;
        delete? (id: String): void;
        getService? (): any;
    }
}
