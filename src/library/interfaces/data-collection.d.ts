declare module Jsonapi {
    interface IDataCollection extends IDocument {
        data: Array<Jsonapi.IDataResource>;
    }
}
