declare module Jsonapi {
    interface ICore {
        rootPath?: string;
        resources?: Array<Jsonapi.IResource>;

        Me?: Jsonapi.IResource;
        Services?: any;

        loadingsStart?: Function;
        loadingsDone?: Function;
        loadingsError?: Function;
        loadingsOffline?: Function;

        _register? (clase: any): boolean;
        getResource? (type: string): Jsonapi.IResource;
        refreshLoadings?(factor: number): void;
    }
}

declare module Jsonapi {
    interface IDataCollection extends IDocument {
        data: Array<Jsonapi.IDataResource>;
    }
}

declare module Jsonapi {
    interface IDataObject extends IDocument {
        data: Jsonapi.IDataResource;
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
        included?: Array<Jsonapi.IDataResource>;
        meta?: Object;

        promise?: any;
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

declare module Jsonapi {
    interface IParams {
        id?: String;
        path?: String;
        include?: Array<String>;
    }
}

declare module Jsonapi {
    interface IResource extends IDataResource {
        schema?: ISchema;

        is_new: boolean;

        clone? (resource: Jsonapi.IResource, type_alias?: string): Object;
        addRelationship? (resource: IResource, type_alias?: string): void;
        addRelationships? (resources: Array<IResource>, type_alias: string): void;
        removeRelationship? (type_alias: string, id: string): boolean;
        save? (params: IParams, fc_success: Function, fc_error: Function): any;
        toObject? (params?: Jsonapi.IParams): IDataObject;
        register? (): boolean;
        // new? (): IResource;
        get? (id: String): IResource;
        all? (): Array<IResource>;
        delete? (id: String): void;
        getService? (): any;
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

/// <reference path="_all.d.ts" />

declare module Jsonapi {
    class Base {
        static Params: Jsonapi.IParams;
        static Schema: {
            attributes: {};
            relationships: {};
        };
    }
}

declare module Jsonapi {
    class Http {
        protected $http: any;
        protected $timeout: any;
        protected rsJsonapiConfig: any;
        protected $q: any;
        /** @ngInject */
        constructor($http: any, $timeout: any, rsJsonapiConfig: any, $q: any);
        delete(path: string): any;
        get(path: string): any;
        protected exec(path: string, method: string, data?: Jsonapi.IDataObject): any;
    }
}

declare module Jsonapi {
    class PathMaker {
        paths: Array<String>;
        includes: Array<String>;
        addPath(value: String): void;
        setInclude(strings_array: Array<String>): void;
        get(): String;
    }
}

declare module Jsonapi {
    class Converter {
        /**
        Convert json arrays (like included) to an Resources arrays without [keys]
        **/
        static json_array2resources_array(json_array: Array<Jsonapi.IDataResource>, destination_array?: Object, use_id_for_key?: boolean): Object;
        /**
        Convert json arrays (like included) to an indexed Resources array by [type][id]
        **/
        static json_array2resources_array_by_type(json_array: Array<Jsonapi.IDataResource>, instance_relationships: boolean): Object;
        static json2resource(json_resource: Jsonapi.IDataResource, instance_relationships: any): Jsonapi.IResource;
        static getService(type: string): Jsonapi.IResource;
        static procreate(resource_service: Jsonapi.IResource, data: Jsonapi.IDataResource): Jsonapi.IResource;
        static build(document_from: any, resource_dest: any, schema: ISchema): void;
        static _buildResources(document_from: IDataCollection, resource_dest: Array<IDataCollection>, schema: ISchema, included: any): void;
        static _buildResource(document_from: IDataResource, resource_dest: IResource, schema: ISchema, included: any): void;
        static __buildRelationships(relationships_from: Array<any>, relationships_dest: Array<any>, included_array: any, schema: ISchema): void;
        static __buildRelationship(relation: Jsonapi.IDataResource, included_array: any): Jsonapi.IResource | Jsonapi.IDataResource;
    }
}

declare module Jsonapi {
    class Core implements Jsonapi.ICore {
        protected rsJsonapiConfig: any;
        protected JsonapiCoreServices: any;
        rootPath: string;
        resources: Array<Jsonapi.IResource>;
        loadingsCounter: number;
        loadingsStart: () => void;
        loadingsDone: () => void;
        loadingsError: () => void;
        loadingsOffline: () => void;
        static Me: Jsonapi.ICore;
        static Services: any;
        /** @ngInject */
        constructor(rsJsonapiConfig: any, JsonapiCoreServices: any);
        _register(clase: any): boolean;
        getResource(type: string): any;
        refreshLoadings(factor: number): void;
    }
}

declare module Jsonapi {
    class Resource implements IResource {
        schema: ISchema;
        protected path: string;
        is_new: boolean;
        type: string;
        id: string;
        attributes: any;
        relationships: any;
        cache: Object;
        cache_vars: Object;
        clone(): any;
        /**
        Register schema on Jsonapi.Core
        @return true if the resource don't exist and registered ok
        **/
        register(): boolean;
        getPath(): string;
        new<T extends Jsonapi.IResource>(): T;
        reset(): void;
        toObject(params?: Jsonapi.IParams): IDataObject;
        get<T extends Jsonapi.IResource>(id: string, params?: Object | Function, fc_success?: Function, fc_error?: Function): T;
        delete(id: string, params?: Object | Function, fc_success?: Function, fc_error?: Function): void;
        all<T extends Jsonapi.IResource>(params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T>;
        getRelationships<T extends Jsonapi.IResource>(parent_path_id: string, params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T>;
        save<T extends Jsonapi.IResource>(params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T>;
        /**
        This method sort params for new(), get() and update()
        */
        private __exec(id, params, fc_success, fc_error, exec_type);
        _get(id: string, params: any, fc_success: any, fc_error: any): IResource;
        _all(params: any, fc_success: any, fc_error: any): Object;
        _delete(id: string, params: any, fc_success: any, fc_error: any): void;
        _save(params: IParams, fc_success: Function, fc_error: Function): IResource;
        addRelationship<T extends Jsonapi.IResource>(resource: T, type_alias?: string): void;
        addRelationships<T extends Jsonapi.IResource>(resources: Array<T>, type_alias: string): void;
        removeRelationship(type_alias: string, id: string): boolean;
        private fillCache(resources);
        private fillCacheResources<T>(resources);
        private fillCacheResource<T>(resource);
        /**
        @return This resource like a service
        **/
        getService(): any;
    }
}

/// <reference path="interfaces/document.d.ts" />
/// <reference path="interfaces/data-collection.d.ts" />
/// <reference path="interfaces/data-object.d.ts" />
/// <reference path="interfaces/data-resource.d.ts" />
/// <reference path="interfaces/params.d.ts" />
/// <reference path="interfaces/errors.d.ts" />
/// <reference path="interfaces/links.d.ts" />
/// <reference path="interfaces/schema.d.ts" />
/// <reference path="interfaces/core.d.ts" />
/// <reference path="interfaces/resource.d.ts" />
/// <reference path="app.module.d.ts" />
/// <reference path="services/base.d.ts" />
/// <reference path="services/http.service.d.ts" />
/// <reference path="services/path-maker.d.ts" />
/// <reference path="services/resource-converter.d.ts" />
/// <reference path="core.d.ts" />
/// <reference path="resource.d.ts" />

declare module Jsonapi {
    class CoreServices {
        protected JsonapiHttp: any;
        /** @ngInject */
        constructor(JsonapiHttp: any);
    }
}

declare module Jsonapi {
    class JsonapiParser {
        /** @ngInject */
        constructor();
        toObject(json_string: string): string;
    }
}

declare module Jsonapi {
    class JsonapiStorage {
        /** @ngInject */
        constructor();
        get(key: any): void;
        merge(key: any, data: any): void;
    }
}
