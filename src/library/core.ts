module Jsonapi {
    export class Core implements Jsonapi.ICore {
        public rootPath: string = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
        public resources: Array<Jsonapi.IResource> = [];

        public loadingsCounter: number = 0;
        public loadingsStart = () => {};
        public loadingsDone = () => {};

        public static Me: Jsonapi.ICore = null;
        public static Services: any = null;

        /** @ngInject */
        public constructor(
            protected rsJsonapiConfig,
            protected JsonapiCoreServices
        ) {
            Jsonapi.Core.Me = this;
            Jsonapi.Core.Services = JsonapiCoreServices;
        }

        public _register(clase): boolean {
            if (clase.type in this.resources) {
                return false;
            }
            this.resources[clase.type] = clase;
            return true;
        }

        public getResource(type: string) {
            return this.resources[type];
        }

        public refreshLoadings(factor: number): void {
            this.loadingsCounter += factor;
            if (this.loadingsCounter === 0) {
                this.loadingsDone();
            } else if (this.loadingsCounter === 1) {
                this.loadingsStart();
            }
        }
    }
    angular.module('Jsonapi.services').service('JsonapiCore', Core);
}
