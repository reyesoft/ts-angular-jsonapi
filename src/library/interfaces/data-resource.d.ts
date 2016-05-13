declare module Jsonapi {
    interface IDataResource {
        type: string;
        id: string;
        attributes?: any;
        relationships?: any;
        links?: Jsonapi.ILinks;
        meta?: any;
    }
}
