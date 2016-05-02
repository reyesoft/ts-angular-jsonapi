/// <reference path="./../_all.ts" />

declare module Jsonapi {
    interface IResource {
        type: string;
        id: string;    // not required when the resource object represents a new resource to be created on server?
        attributes?: any;
        relationships?: any;
        links?: Jsonapi.ILinks;
        meta?: any;

        save? (): PromiseConstructorLike;

        // static functions. Used when is a service

        // all? (params?: IRealJsonapiParams): Array<IJsonapiResource>;

        // get(params?: IRealJsonapiParams): IRealJsonapiResource;

        // resource object functions. Used when is a resource
        // all(params?: IRealJsonapiParams): Array<IRealJsonapiResource>;
    }
}
