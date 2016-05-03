/// <reference path="./_all.ts" />

module Jsonapi {
    export class Core implements Jsonapi.ICore {
        public rootPath: string = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
        public resources: Array<Jsonapi.IResource> = [];
        public static Services: any = null;

        /** @ngInject */
        public constructor(
            // protected $http
            // protected RealJsonapiServices,
            // protected AppSettings: any,
            protected JsonapiCoreServices
        ) {
            Jsonapi.Core.Services = JsonapiCoreServices;
            console.log('IS READY?', JsonapiCoreServices.cadena);
        }

        public addResourceSchema(schema: Jsonapi.ISchema): Jsonapi.IDataCollection {
            // if (schema.type in this.resources)
            //     throw 'Schema "' + schema.type + '" already exists.';

            /* let resource = new JsonapiData(this.RealJsonapiServices);
            this.resources[schema.type] = resource;
            return resource; */
            return ;
        }

        public getResource(type: string) {
            return this.resources[type];
        }
    }
    angular.module('Jsonapi.services').service('JsonapiCore', Core);
}
