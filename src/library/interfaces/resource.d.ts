/// <reference path="./../_all.ts" />

declare module Jsonapi {
    interface IResource extends IDataResource {
        schema?: ISchema;

        register (): void;
        // new? (): IResource;
        get? (id: String): IResource;
        all? (): Array<IResource>;
    }
}
