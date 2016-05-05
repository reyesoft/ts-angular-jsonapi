module Jsonapi {
    export class Core implements Jsonapi.ICore {
        public rootPath: string = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
        public resources: Array<Jsonapi.IResource> = [];

        // public static Me: Jsonapi.ICore = null;
        public static Me: Jsonapi.ICore = null;
        public static Services: any = null;

        /** @ngInject */
        public constructor(
            protected JsonapiConfig,
            protected JsonapiCoreServices
        ) {
            Jsonapi.Core.Me = this;
            Jsonapi.Core.Services = JsonapiCoreServices;
        }

        public register(clase: Jsonapi.IResource) {
            this.resources[clase.type] = clase;
        }

        public getResource(type: string) {
            return this.resources[type];
        }
    }
    angular.module('Jsonapi.services').service('JsonapiCore', Core);
}
