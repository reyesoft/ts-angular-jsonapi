declare module Jsonapi {
    interface ICore {
        rootPath?: string;
        resources?: Array<Jsonapi.IResource>;

        Me?: Jsonapi.ICore;
        Services?: any;

        loadingsStart?: Function;
        loadingsDone?: Function;

        // _register?(clase: Jsonapi.IResource): void;
        _register? (clase: any): void;    // Jsonapi.IResource fail on resourse.ts
        getResource? (type: string): Jsonapi.IResource;
        refreshLoadings?(factor: number): void;
    }
}
