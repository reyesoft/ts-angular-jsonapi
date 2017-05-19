import * as angular from 'angular';
import { Core } from './core';
import { Base } from './services/base';
import { Resource } from './resource';
import { ParentResourceService } from './parent-resource-service';
import { PathBuilder } from './services/path-builder';
import { UrlParamsBuilder } from './services/url-params-builder';
import { Converter } from './services/converter';
import { LocalFilter } from './services/localfilter';
import { CacheMemory } from './services/cachememory';
import { CacheStore } from './services/cachestore';

import { IService, ISchema, IResource, ICollection, IExecParams, ICacheStore, ICacheMemory,
    IParamsCollection, IParamsResource, IAttributes } from './interfaces';

export class Service extends ParentResourceService implements IService {
    public schema: ISchema;
    public cachememory: ICacheMemory;
    public cachestore: ICacheStore;
    public type: string;

    private path: string;   // without slashes
    private smartfiltertype = 'undefined';

    /**
    Register schema on Core
    @return true if the resource don't exist and registered ok
    **/
    public register(): boolean {
        if (Core.me === null) {
            throw 'Error: you are trying register --> ' + this.type + ' <-- before inject JsonapiCore somewhere, almost one time.';
        }
        // only when service is registered, not cloned object
        this.cachememory = new CacheMemory();
        this.cachestore = new CacheStore();
        this.schema = angular.extend({}, Base.Schema, this.schema);
        return Core.me._register(this);
    }

    public newResource(): IResource {
        let resource: IResource = new Resource();
        return resource;
    }

    public new<T extends IResource>(): T {
        let resource = this.newResource();
        resource.type = this.type;
        resource.reset();
        return <T>resource;
    }

    public getPrePath(): string {
        return '';
    }
    public getPath(): string {
        return this.path ? this.path : this.type;
    }

    public get<T extends IResource>(id, params?: IParamsResource | Function, fc_success?: Function, fc_error?: Function): T {
        return <T>this.__exec({ id: id, params: params, fc_success: fc_success, fc_error: fc_error, exec_type: 'get' });
    }

    public delete(id: string, params?: Object | Function, fc_success?: Function, fc_error?: Function): void {
        return <void>this.__exec({ id: id, params: params, fc_success: fc_success, fc_error: fc_error, exec_type: 'delete' });
    }

    public all(params?: IParamsCollection | Function, fc_success?: Function, fc_error?: Function): ICollection {
        return <ICollection>this.__exec({ id: null, params: params, fc_success: fc_success, fc_error: fc_error, exec_type: 'all' });
    }

    protected __exec(exec_params: IExecParams): IResource | ICollection | void {
        super.__exec(exec_params);

        switch (exec_params.exec_type) {
            case 'get':
            return this._get(exec_params.id, exec_params.params, exec_params.fc_success, exec_params.fc_error);
            case 'delete':
            return this._delete(exec_params.id, exec_params.params, exec_params.fc_success, exec_params.fc_error);
            case 'all':
            return this._all(exec_params.params, exec_params.fc_success, exec_params.fc_error);
        }
    }

    public _get(id: string, params: IParamsResource, fc_success, fc_error): IResource {
        // http request
        let path = new PathBuilder();
        path.applyParams(this, params);
        path.appendPath(id);

        // CACHEMEMORY
        let resource = this.getService().cachememory.getOrCreateResource(this.type, id);
        resource.is_loading = true;
        // exit if ttl is not expired
        let temporal_ttl = params.ttl || 0; // this.schema.ttl
        if (this.getService().cachememory.isResourceLive(id, temporal_ttl)) {
            // we create a promise because we need return collection before
            // run success client function
            var deferred = Core.injectedServices.$q.defer();
            deferred.resolve(fc_success);
            deferred.promise.then(fc_success => {
                this.runFc(fc_success, 'cachememory');
            });
            resource.is_loading = false;
            return resource;
        }

        // CACHESTORE
        this.getService().cachestore.getResource(resource)
        .then(
            success => {
                if (Base.isObjectLive(temporal_ttl, resource.lastupdate)) {
                    this.runFc(fc_success, { data: success});
                } else {
                    this.getGetFromServer(path, fc_success, fc_error, resource);
                }
            },
            error => {
                this.getGetFromServer(path, fc_success, fc_error, resource);
            }
        );

        return resource;
    }

    private getGetFromServer(path, fc_success, fc_error, resource: IResource) {
        Core.injectedServices.JsonapiHttp
        .get(path.get())
        .then(
            success => {
                Converter.build(success.data, resource);
                resource.is_loading = false;
                this.getService().cachememory.setResource(resource);
                this.getService().cachestore.setResource(resource);
                this.runFc(fc_success, success);
            },
            error => {
                this.runFc(fc_error, error);
            }
        );
    }

    private _all(params: IParamsCollection, fc_success, fc_error): ICollection {

        // check smartfiltertype, and set on remotefilter
        if (params.smartfilter && this.smartfiltertype !== 'localfilter') {
            angular.extend(params.remotefilter, params.smartfilter);
        }

        // http request
        let path = new PathBuilder();
        let paramsurl = new UrlParamsBuilder();
        path.applyParams(this, params);
        if (params.remotefilter && Object.keys(params.remotefilter).length > 0) {
            this.getService().parseToServer(params.remotefilter);
            path.addParam(paramsurl.toparams( { filter: params.remotefilter } ));
        }
        if (params.page) {
            params.page.number > 1 ? path.addParam(
                Core.injectedServices.rsJsonapiConfig.parameters.page.number + '=' + params.page.number) : null;
            params.page.limit ? path.addParam(
                Core.injectedServices.rsJsonapiConfig.parameters.page.limit + '=' + params.page.limit) : null;
        }

        // make request
        // if we remove this, dont work the same .all on same time (ej: <component /><component /><component />)
        let tempororay_collection = this.getService().cachememory.getOrCreateCollection(path.getForCache());

        // creamos otra colleción si luego será filtrada
        let localfilter = new LocalFilter(params.localfilter);
        let cached_collection: ICollection;
        if (params.localfilter && Object.keys(params.localfilter).length > 0) {
             cached_collection = Base.newCollection();
        } else {
             cached_collection = tempororay_collection;
        }

        // MEMORY_CACHE
        let temporal_ttl = params.ttl || this.schema.ttl;
        if (temporal_ttl >= 0 && this.getService().cachememory.isCollectionExist(path.getForCache())) {
            // get cached data and merge with temporal collection
            tempororay_collection.$source = 'memory';

            // check smartfiltertype, and set on localfilter
            if (params.smartfilter && this.smartfiltertype === 'localfilter') {
                angular.extend(params.localfilter, params.smartfilter);
            }

            // fill collection and localfilter
            localfilter.filterCollection(tempororay_collection, cached_collection);

            // exit if ttl is not expired
            if (this.getService().cachememory.isCollectionLive(path.getForCache(), temporal_ttl)) {
                // we create a promise because we need return collection before
                // run success client function
                var deferred = Core.injectedServices.$q.defer();
                deferred.resolve(fc_success);
                deferred.promise.then(fc_success => {
                    this.runFc(fc_success, 'cachememory');
                });
            } else {
                this.getAllFromServer(path, params, fc_success, fc_error, tempororay_collection, cached_collection);
            }
        } else {
            // STORE
            tempororay_collection.$is_loading = true;
            this.getService().cachestore.getCollectionFromStorePromise(path.getForCache(), tempororay_collection)
            .then(
                success => {
                    tempororay_collection.$source = 'store';
                    tempororay_collection.$is_loading = false;

                    // localfilter getted data
                    localfilter.filterCollection(tempororay_collection, cached_collection);

                    if (Base.isObjectLive(temporal_ttl, tempororay_collection.$cache_last_update)) {
                        this.runFc(fc_success, { data: success});
                    } else {
                        this.getAllFromServer(path, params, fc_success, fc_error, tempororay_collection, cached_collection);
                    }
                },
                error => {
                    this.getAllFromServer(path, params, fc_success, fc_error, tempororay_collection, cached_collection);
                }
            );
        }

        return cached_collection;
    }

    private getAllFromServer(path, params, fc_success, fc_error, tempororay_collection: ICollection, cached_collection: ICollection) {
        // SERVER REQUEST
        tempororay_collection.$is_loading = true;
        Core.injectedServices.JsonapiHttp
        .get(path.get())
        .then(
            success => {
                tempororay_collection.$source = 'server';
                tempororay_collection.$is_loading = false;

                Converter.build(success.data, tempororay_collection);

                this.getService().cachememory.setCollection(path.getForCache(), tempororay_collection);
                this.getService().cachestore.setCollection(path.getForCache(), tempororay_collection);

                // localfilter getted data
                let localfilter = new LocalFilter(params.localfilter);
                localfilter.filterCollection(tempororay_collection, cached_collection);

                // trying to define smartfiltertype
                if (this.smartfiltertype === 'undefined') {
                    let page = tempororay_collection.page;
                    if (page.number === 1 && page.total_resources <= page.resources_per_page) {
                        this.smartfiltertype = 'localfilter';
                    } else if (page.number === 1 && page.total_resources > page.resources_per_page) {
                        this.smartfiltertype = 'remotefilter';
                    }
                }

                this.runFc(fc_success, success);
            },
            error => {
                // do not replace $source, because localstorage don't write if = server
                // tempororay_collection.$source = 'server';
                tempororay_collection.$is_loading = false;
                this.runFc(fc_error, error);
            }
        );
    }

    private _delete(id: string, params, fc_success, fc_error): void {
        // http request
        let path = new PathBuilder();
        path.applyParams(this, params);
        path.appendPath(id);

        Core.injectedServices.JsonapiHttp
        .delete(path.get())
        .then(
            success => {
                this.getService().cachememory.removeResource(id);
                this.runFc(fc_success, success);
            },
            error => {
                this.runFc(fc_error, error);
            }
        );
    }

    /**
    @return This resource like a service
    **/
    public getService<T extends IService>(): T {
        return <T>Converter.getService(this.type);
    }

    public clearCacheMemory(): boolean {
        return this.getService().cachememory.clearAllCollections();
    }

    public parseFromServer(attributes: IAttributes): void {

    }

    public parseToServer(attributes: IAttributes): void {

    }
}
