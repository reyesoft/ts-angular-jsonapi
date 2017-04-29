import * as angular from 'angular';
import './services/core-services.service';
import { ICore, IService } from './interfaces';

export class Core implements ICore {
    private resourceServices: Object = {};

    public loadingsCounter: number = 0;
    public loadingsStart = () => {};
    public loadingsDone = () => {};
    public loadingsError = () => {};
    public loadingsOffline = () => {};

    public static me: ICore;
    public static injectedServices: any;

    /** @ngInject */
    public constructor(
        protected rsJsonapiConfig,
        protected JsonapiCoreServices
    ) {
        Core.me = this;
        Core.injectedServices = JsonapiCoreServices;
    }

    public _register(clase: IService): boolean {
        if (clase.type in this.resourceServices) {
            return false;
        }
        this.resourceServices[clase.type] = clase;
        return true;
    }

    public getResourceService(type: string): IService {
        return this.resourceServices[type];
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
