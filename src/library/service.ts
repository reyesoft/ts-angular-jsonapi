/// <reference path="./_all.ts" />

module Jsonapi {
    export class Service implements Jsonapi.IService {
        public rootPath: string = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
        public resources: Array<Jsonapi.IResource> = [];

        /** @ngInject */
        public constructor(
            protected $http,
            protected RealJsonapiServices,
            protected AppSettings: any
        ) {

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
}
