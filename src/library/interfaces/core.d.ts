declare module Jsonapi {
    interface ICore {
        rootPath?: string;
        resources?: Array<Jsonapi.IResource>;

        Me?: Jsonapi.ICore;
        Services?: any;

        loadingsStart?: Function;
        loadingsDone?: Function;

        _register? (clase: any): boolean;
        getResource? (type: string): Jsonapi.IResource;
        refreshLoadings?(factor: number): void;
    }
}
