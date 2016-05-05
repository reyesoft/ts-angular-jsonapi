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

declare module Jsonapi {
    interface IDataCollection extends IDocument {
        data: IResource[];
    }
}

declare module Jsonapi {
    interface IDataObject extends IDocument {
        data: IResource;
    }
}

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

// http://jsonapi.org/format/#document-top-level
declare module Jsonapi {
    interface IDocument {
        // data in child interface IJsonapiCollection
        // error in child interface IJsonapiErrors
        jsonapi?: string;
        links?: ILinks;
        included?: Object;
        meta?: Object;

        promise: any;
    }
}

declare module Jsonapi {
    interface IErrors extends IDocument {
        errors: [
            {
                code?: string,
                source?: {
                    attributes?: string,
                    pointer: string
                },
                title?: string,
                detail?: string
            }
        ];
    }
}

// http://jsonapi.org/format/#document-links
declare module Jsonapi {
    interface ILinks {
        self?: string;
        related?: {
            href: string;
            meta: any;
        };
    }
}

interface IRealJsonapiParams {
    include?: string;
}

declare module Jsonapi {
    interface IResource extends IDataResource {
        schema?: ISchema;

        register (): void;
        // new? (): IResource;
        get? (id: String): IResource;
        all? (): Array<IResource>;
    }
}

declare module Jsonapi {
    interface ISchema {
        // type: string;
        // id: string;    // not required when the resource object represents a new resource to be created on server?
        attributes?: any;
        relationships?: any;
        path?: string;
    }
}
