/// <reference path="_all.d.ts" />

declare module Jsonapi {
    class Http {
        protected $http: any;
        protected JsonapiConfig: any;
        protected $q: any;
        /** @ngInject */
        constructor($http: any, JsonapiConfig: any, $q: any);
        get(path: string): any;
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
    class ResourceMaker {
        static getService(type: string): Jsonapi.IResource;
        static make(data: Jsonapi.IDataResource): Jsonapi.IResource;
        static procreate(resource_service: Jsonapi.IResource, data: Jsonapi.IDataResource): Jsonapi.IResource;
    }
}

declare module Jsonapi {
    class Core implements Jsonapi.ICore {
        protected JsonapiConfig: any;
        protected JsonapiCoreServices: any;
        rootPath: string;
        resources: Array<Jsonapi.IResource>;
        static Me: Jsonapi.ICore;
        static Services: any;
        /** @ngInject */
        constructor(JsonapiConfig: any, JsonapiCoreServices: any);
        register(clase: Jsonapi.IResource): void;
        getResource(type: string): any;
    }
}

declare module Jsonapi {
    class Resource implements IResource {
        schema: ISchema;
        path: string;
        type: string;
        id: string;
        attributes: any;
        relationships: any;
        clone(): any;
        register(): void;
        new(): void;
        get(id: String, params?: any, fc_success?: any, fc_error?: any): IResource;
        all(params?: any, fc_success?: any, fc_error?: any): Array<IResource>;
        exec(id: String, params: any, fc_success: any, fc_error: any): any;
        _get(id: String, params: any, fc_success: any, fc_error: any): IResource;
        _all(params: any, fc_success: any, fc_error: any): Array<IResource>;
    }
}

/// <reference path="interfaces/document.d.ts" />
/// <reference path="interfaces/data-collection.d.ts" />
/// <reference path="interfaces/data-object.d.ts" />
/// <reference path="interfaces/data-resource.d.ts" />
/// <reference path="interfaces/errors.d.ts" />
/// <reference path="interfaces/links.d.ts" />
/// <reference path="interfaces/schema.d.ts" />
/// <reference path="interfaces/core.d.ts" />
/// <reference path="interfaces/resource.d.ts" />
/// <reference path="app.module.d.ts" />
/// <reference path="services/http.service.d.ts" />
/// <reference path="services/path-maker.d.ts" />
/// <reference path="services/resource-maker.d.ts" />
/// <reference path="core.d.ts" />
/// <reference path="resource.d.ts" />

declare module Jsonapi {
    class CoreServices {
        protected JsonapiHttp: any;
        cadena: string;
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
