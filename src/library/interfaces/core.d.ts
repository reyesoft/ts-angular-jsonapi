declare module Jsonapi {
    interface ICore {
        rootPath?: string;
        resources?: Array<Jsonapi.IResource>;

        Me?: Jsonapi.ICore;
        Services?: any;

        register?(clase: Jsonapi.IResource): void;
        getResource?(type: string): Jsonapi.IResource;
    }
}
