/// <reference path="./index.d.ts" />

import './services/core-services.service';

export class Core implements ICore {
    public rootPath: string = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
    public resources: Array<IResource> = [];

    public loadingsCounter: number = 0;
    public loadingsStart = () => {};
    public loadingsDone = () => {};
    public loadingsError = () => {};
    public loadingsOffline = () => {};

    public static Me: ICore = null;
    public static Services: any = null;

    /** @ngInject */
    public constructor(
        protected rsJsonapiConfig,
        protected JsonapiCoreServices
    ) {
        console.log('core constructed');
        Core.Me = this;
        Core.Services = JsonapiCoreServices;
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
