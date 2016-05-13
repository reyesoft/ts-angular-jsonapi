declare module Jsonapi {
    interface IResource extends IDataResource {
        schema?: ISchema;

        is_new: boolean;

        clone? (resource: Jsonapi.IResource, type_alias?: string): Object;
        addRelationship? (resource: IResource, type_alias?: string): void;
        toObject? (params: Jsonapi.IParams): Jsonapi.IDataObject;
        register? (): boolean;
        // new? (): IResource;
        get? (id: String): IResource;
        all? (): Array<IResource>;
        getService? (): any;
    }
}
