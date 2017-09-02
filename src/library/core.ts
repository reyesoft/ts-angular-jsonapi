import * as angular from 'angular';
import './services/core-services.service';
import { ICore, IResource, ICollection, IService } from './interfaces';

export class Core implements ICore {
    public static me: ICore;
    public static injectedServices: {
        $q: ng.IQService;
        JsonapiStoreService: any;
        JsonapiHttp: any;
        rsJsonapiConfig: any;
    };

    private resourceServices: Object = {};
    public loadingsCounter: number = 0;
    public loadingsStart: Function = (): void => {};
    public loadingsDone: Function = (): void => {};
    public loadingsError: Function = (): void => {};
    public loadingsOffline = (): void => {};

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

    public clearCache(): boolean {
        Core.injectedServices.JsonapiStoreService.clearCache();

        return true;
    }

    // just an helper
    public duplicateResource(resource: IResource, ...relations_alias_to_duplicate_too: Array<string>): IResource {
        let newresource = this.getResourceService(resource.type).new();
        angular.merge(newresource.attributes, resource.attributes);
        newresource.attributes.name = newresource.attributes.name + ' xXx';
        angular.forEach(resource.relationships, (relationship, alias) => {
            if ('id' in relationship.data) {
                // relation hasOne
                if (relations_alias_to_duplicate_too.indexOf(alias) > -1) {
                    newresource.addRelationship(this.duplicateResource(<IResource>relationship.data), alias);
                } else {
                    newresource.addRelationship(<IResource>relationship.data, alias);
                }
            } else {
                // relation hasMany
                if (relations_alias_to_duplicate_too.indexOf(alias) > -1) {
                    angular.forEach(relationship.data, relationresource => {
                        newresource.addRelationship(this.duplicateResource(relationresource), alias);
                    });
                } else {
                    newresource.addRelationships(<ICollection>relationship.data, alias);
                }
            }
        });

        return newresource;
    }
}

angular.module('Jsonapi.services').service('JsonapiCore', Core);
