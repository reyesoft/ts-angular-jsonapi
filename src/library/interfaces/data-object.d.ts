/// <reference path="./../_all.ts" />

declare module Jsonapi {
    interface IDataObject extends IDocument {
        data: IResource;
    }
}
