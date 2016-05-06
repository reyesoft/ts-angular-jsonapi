declare module Jsonapi {
    interface ICore {
        rootPath?: string;
        resources?: Array<Jsonapi.IResource>;

        Me?: Jsonapi.ICore;
        Services?: any;

        loadingsStart?: Function;
        loadingsDone?: Function;

        register?(clase: Jsonapi.IResource): void;
        getResource?(type: string): Jsonapi.IResource;
        // refreshLoadings?(factor: number): void;
    }
}
