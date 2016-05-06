declare module Jsonapi {
    interface IDataObject extends IDocument {
        data: Jsonapi.IDataResource;
        include?: Object;
    }
}
