/// <reference path="./../_all.ts" />

declare module Jsonapi {
    interface IDataCollection extends IDocument {
        data: IResource[];
    }
}
