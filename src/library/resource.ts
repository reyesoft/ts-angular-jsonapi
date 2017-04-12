/// <reference path="./index.d.ts" />

// import * as Jsonapi from './core';
import { Core } from './core';
import { Base } from './services/base';
import { PathBuilder } from './services/path-builder';
import { UrlParamsBuilder } from './services/url-params-builder';
import { Converter } from './services/resource-converter';
import { LocalFilter } from './services/localfilter';
import { MemoryCache } from './services/memorycache';

import { IService, IAttributes, ISchema, IResource, ICollection, ICache, IParamsCollection, IParamsResource } from './interfaces';
import { IRelationships, IRelationship } from './interfaces';

export class Resource implements IResource, IService {
    public is_new = true;
    public is_loading = false;
    public is_saving = false;
    public schema: ISchema;
    public memorycache: ICache;

    public type: string;
    public id: string;
    public attributes: IAttributes;
    public relationships: IRelationships = {};

    private path: string;   // without slashes
    public smartfiltertype = 'undefined';
    private tempororay_collection: ICollection;

    public clone(): any {
        var cloneObj = new (<any>this.constructor)();
        for (var attribut in this) {
            if (typeof this[attribut] !== 'object') {
                cloneObj[attribut] = this[attribut];
            }
        }
        return cloneObj;
    }

    /**
    Register schema on Core
    @return true if the resource don't exist and registered ok
    **/
    public register(): boolean {
        if (Core.Me === null) {
            throw 'Error: you are trying register --> ' + this.type + ' <-- before inject JsonapiCore somewhere, almost one time.';
        }
        // only when service is registered, not cloned object
        this.memorycache = new MemoryCache();
        return Core.Me._register(this);
    }

    public getPrePath(): string {
        return '';
    }
    public getPath(): string {
        return this.path ? this.path : this.type;
    }

    // empty self object
    public new<T extends IResource>(): T {
        let resource = this.clone();
        resource.reset();
        return resource;
    }

    public reset(): void {
        let self = this;
        this.id = '';
        this.attributes = {};
        angular.forEach(this.schema.attributes, (value, key) => {
            self.attributes[key] = ('default' in value) ? value.default : undefined;
        });
        this.relationships = {};
        angular.forEach(this.schema.relationships, (value, key) => {
            self.relationships[key] = <IRelationship>{ data: {} };
            if (this.schema.relationships[key].hasMany) {
                self.relationships[key].data = Base.newCollection();
            }
        });
        this.is_new = true;
    }

    public toObject(params?: IParamsResource): IDataObject {
        params = angular.extend({}, Base.Params, params);
        this.schema = angular.extend({}, Base.Schema, this.schema);

        let relationships = { };
        let included = [ ];
        let included_ids = [ ]; // just for control don't repeat any resource

        // REALTIONSHIPS
        angular.forEach(this.relationships, (relationship: IRelationship, relation_alias) => {

            if (this.schema.relationships[relation_alias] && this.schema.relationships[relation_alias].hasMany) {
                // has many (hasMany:true)
                relationships[relation_alias] = { data: [] };

                angular.forEach(relationship.data, (resource: IResource) => {
                    let reational_object = { id: resource.id, type: resource.type };
                    relationships[relation_alias]['data'].push(reational_object);

                    // no se agregó aún a included && se ha pedido incluir con el parms.include
                    let temporal_id = resource.type + '_' + resource.id;
                    if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relation_alias) !== -1) {
                        included_ids.push(temporal_id);
                        included.push(resource.toObject({ }).data);
                    }
                });
            } else {
                // has one (hasMany:false)

                let relationship_data = (<IResource>relationship.data);
                if (!('id' in relationship.data) && !angular.equals({}, relationship.data)) {
                    console.warn(relation_alias + ' defined with hasMany:false, but I have a collection');
                }

                if (relationship_data.id && relationship_data.type) {
                    relationships[relation_alias] = { data: { id: relationship_data.id, type: relationship_data.type } };
                } else {
                    relationships[relation_alias] = { data: { } };
                }

                // no se agregó aún a included && se ha pedido incluir con el parms.include
                let temporal_id = relationship_data.type + '_' + relationship_data.id;
                if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relationship_data.type) !== -1) {
                    included_ids.push(temporal_id);
                    included.push(relationship_data.toObject({ }).data);
                }
            }
        });

        let ret: IDataObject = {
            data: {
                type: this.type,
                id: this.id,
                attributes: this.attributes,
                relationships: relationships
            }
        };

        if (included.length > 0) {
            ret.included = included;
        }

        return ret;
    }

    public get<T extends IResource>(id, params?: IParamsResource | Function, fc_success?: Function, fc_error?: Function): T {
        return this.__exec(id, params, fc_success, fc_error, 'get');
    }

    public delete(id: string, params?: Object | Function, fc_success?: Function, fc_error?: Function): void {
        this.__exec(id, params, fc_success, fc_error, 'delete');
    }

    public all(params?: IParamsCollection | Function, fc_success?: Function, fc_error?: Function): ICollection {
    // public all<T extends IResource>(params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T> {
        return this.__exec(null, params, fc_success, fc_error, 'all');
    }

    // just for debuggin purposes
    public getCachedResources() {
        return this.getService().memorycache.resources;
    }

    public save<T extends IResource>(params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T> {
        return this.__exec(null, params, fc_success, fc_error, 'save');
    }

    /**
    This method sort params for new(), get() and update()
    */
    private __exec(id: string, params: IParamsResource, fc_success, fc_error, exec_type: string): any {
        // makes `params` optional
        if (angular.isFunction(params)) {
            fc_error = fc_success;
            fc_success = params;
            params = angular.extend({}, Base.Params);
        } else {
            if (angular.isUndefined(params)) {
                params = angular.extend({}, Base.Params);
            } else {
                params = angular.extend({}, Base.Params, params);
            }
        }

        fc_success = angular.isFunction(fc_success) ? fc_success : angular.noop();
        fc_error = angular.isFunction(fc_error) ? fc_error : undefined;

        this.schema = angular.extend({}, Base.Schema, this.schema);

        switch (exec_type) {
            case 'get':
            return this._get(id, params, fc_success, fc_error);
            case 'delete':
            return this._delete(id, params, fc_success, fc_error);
            case 'all':
            return this._all(params, fc_success, fc_error);
            case 'save':
            return this._save(params, fc_success, fc_error);
        }
    }

    private runFc(some_fc, param) {
        return angular.isFunction(some_fc) ? some_fc(param) : angular.noop();
    }

    public _get(id: string, params: IParamsResource, fc_success, fc_error): IResource {
        // http request
        let path = new PathBuilder();
        path.appendPath(this.getPrePath());
        path.appendPath(this.getPath());
        path.appendPath(id);
        params.include ? path.setInclude(params.include) : null;

        // cache
        let resource = (id in this.getService().memorycache.resources ? this.getService().memorycache.resources[id] : this.new());
        resource.is_loading = true;
        // exit if ttl is not expired
        let temporal_ttl = params.ttl ? params.ttl : 0;
        if (this.getService().memorycache.isResourceLive(id, temporal_ttl)) {
            // we create a promise because we need return collection before
            // run success client function
            var deferred = Core.Services.$q.defer();
            deferred.resolve(fc_success);
            deferred.promise.then(fc_success => {
                this.runFc(fc_success, 'memorycache');
            });
            resource.is_loading = false;
            return resource;
        }


        Core.Services.JsonapiHttp
        .get(path.get())
        .then(
            success => {
                Converter.build(success.data, resource, this.schema);
                resource.is_loading = false;
                this.getService().memorycache.setResource(resource);
                this.runFc(fc_success, success);
            },
            error => {
                this.runFc(fc_error, error);
            }
        );

        return resource;
    }

    public _all(params: IParamsCollection, fc_success, fc_error): ICollection {

        // check smartfiltertype, and set on remotefilter
        if (params.smartfilter && this.smartfiltertype !== 'localfilter') {
            angular.extend(params.remotefilter, params.smartfilter);
        }

        // http request
        let path = new PathBuilder();
        let paramsurl = new UrlParamsBuilder();
        path.appendPath(this.getPrePath());
        params.beforepath ? path.appendPath(params.beforepath) : null;
        path.appendPath(this.getPath());
        params.include ? path.setInclude(params.include) : null;
        params.remotefilter ? path.addParam(paramsurl.toparams( { filter: params.remotefilter } )) : null;
        if (params.page) {
            params.page.number > 1 ? path.addParam(
                Core.Services.rsJsonapiConfig.parameters.page.number + '=' + params.page.number) : null;
            params.page.limit ? path.addParam(
                Core.Services.rsJsonapiConfig.parameters.page.limit + '=' + params.page.limit) : null;
        }

        // make request
        // if we remove this, dont work the same .all on same time (ej: <component /><component /><component />)
        let tempororay_collection = this.getService().memorycache.getCollection(path.getForCache());

        // MEMORY_CACHE
        let temporal_ttl = params.ttl ? params.ttl : this.schema.ttl;
        if (temporal_ttl >= 0 && this.getService().memorycache.isCollectionExist(path.getForCache())) {
            // get cached data and merge with temporal collection
            tempororay_collection.$source = 'memorycache';

            // check smartfiltertype, and set on localfilter
            if (params.smartfilter && this.smartfiltertype === 'localfilter') {
                angular.extend(params.localfilter, params.smartfilter);
            }

            // fill collection and localfilter
            let localfilter = new LocalFilter();
            tempororay_collection = localfilter.filterCollection(tempororay_collection, params.localfilter);

            // exit if ttl is not expired
            if (this.getService().memorycache.isCollectionLive(path.getForCache(), temporal_ttl)) {
                // we create a promise because we need return collection before
                // run success client function
                var deferred = Core.Services.$q.defer();
                deferred.resolve(fc_success);
                deferred.promise.then(fc_success => {
                    this.runFc(fc_success, 'memorycache');
                });
                return tempororay_collection;
            }
        }

        tempororay_collection['$isloading'] = true;

        // STORAGE_CACHE
        Core.Services.JsonapiHttpStorage
        .get(path.getForCache(), params.storage_ttl)
        .then(
            success => {
                tempororay_collection.$source = 'httpstorage';
                tempororay_collection.$isloading = false;
                Converter.build(success, tempororay_collection, this.schema);

                // localfilter getted data
                let localfilter = new LocalFilter();
                tempororay_collection = localfilter.filterCollection(tempororay_collection, params.localfilter);

                this.runFc(fc_success, { data: success});

                var deferred = Core.Services.$q.defer();
                deferred.resolve(fc_success);
                deferred.promise.then(fc_success => {
                    this.runFc(fc_success, 'httpstorage');
                });
                return tempororay_collection;
            },
            error => {
                this.getAllFromServer(path, params, fc_success, fc_error, tempororay_collection);
            }
        );

        return tempororay_collection;
    }

    private getAllFromServer(path, params, fc_success, fc_error, tempororay_collection: ICollection) {
        // SERVER REQUEST
        Core.Services.JsonapiHttp
        .get(path.get())
        .then(
            success => {
                tempororay_collection.$source = 'server';
                tempororay_collection.$isloading = false;
                Converter.build(success.data, tempororay_collection, this.schema);

                this.getService().memorycache.setCollection(path.getForCache(), tempororay_collection);

                if (params.storage_ttl > 0) {
                    Core.Services.JsonapiHttpStorage.save(path.getForCache(), success.data);
                }

                // localfilter getted data
                let localfilter = new LocalFilter();
                tempororay_collection = localfilter.filterCollection(tempororay_collection, params.localfilter);

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
                tempororay_collection.$source = 'server';
                tempororay_collection.$isloading = false;
                this.runFc(fc_error, error);
            }
        );
    }

    public _delete(id: string, params, fc_success, fc_error): void {
        // http request
        let path = new PathBuilder();
        path.appendPath(this.getPrePath());
        path.appendPath(this.getPath());
        path.appendPath(id);

        Core.Services.JsonapiHttp
        .delete(path.get())
        .then(
            success => {
                // we don't use more temporary_collection
                // delete this.tempororay_collection[id];
                this.getService().memorycache.removeResource(id);
                this.runFc(fc_success, success);
            },
            error => {
                this.runFc(fc_error, error);
            }
        );
    }

    public _save(params: IParamsResource, fc_success: Function, fc_error: Function): IResource {
        if (this.is_saving || this.is_loading) {
            return ;
        }
        this.is_saving = true;

        let object = this.toObject(params);

        // http request
        let path = new PathBuilder();
        path.appendPath(this.getPrePath());
        path.appendPath(this.getPath());
        this.id && path.appendPath(this.id);
        params.include ? path.setInclude(params.include) : null;

        let resource = this.new();

        let promise = Core.Services.JsonapiHttp.exec(
            path.get(), this.id ? 'PUT' : 'POST',
            object, !(angular.isFunction(fc_error))
        );

        promise.then(
            success => {
                this.is_saving = false;

                // foce reload cache (for example, we add a new element)
                if (!this.id) {
                    this.getService().memorycache.clearAllCollections();
                }

                // is a resource?
                if ('id' in success.data.data) {
                    this.id = success.data.data.id;
                    Converter.build(success.data, this, this.schema);
                    /*
                    Si lo guardo en la caché, luego no queda bindeado con la vista
                    Usar {{ $ctrl.service.getCachedResources() | json }}, agregar uno nuevo, editar
                    */
                    // this.getService().memorycache.setResource(this);
                } else if (angular.isArray(success.data.data)) {
                    console.warn('Server return a collection when we save()', success.data.data);

                    /*
                    we request the service again, because server maybe are giving
                    us another type of resource (getService(resource.type))
                    */
                    let tempororay_collection = this.getService().memorycache.getCollection('justAnUpdate');
                    Converter.build(success.data, tempororay_collection, this.schema);
                    angular.forEach(tempororay_collection, (resource_value: IResource, key: string) => {
                        let res = Converter.getService(resource_value.type).memorycache.resources[resource_value.id];
                        Converter.getService(resource_value.type).memorycache.setResource(resource_value);
                        res.id = res.id + 'x';
                    });

                    console.warn('Temporal collection for a resource_value update', tempororay_collection);
                }

                this.runFc(fc_success, success);
            },
            error => {
                this.is_saving = false;

                this.runFc(fc_error, 'data' in error ? error.data : error);
            }
        );

        return resource;
    }

    public addRelationship<T extends IResource>(resource: T, type_alias?: string) {
        let object_key = resource.id;
        if (!object_key) {
            object_key = 'new_' + (Math.floor(Math.random() * 100000));
        }

        type_alias = (type_alias ? type_alias : resource.type);
        if (!(type_alias in this.relationships)) {
            this.relationships[type_alias] = { data: { } };
        }

        if (type_alias in this.schema.relationships && this.schema.relationships[type_alias].hasMany) {
            this.relationships[type_alias]['data'][object_key] = resource;
        } else {
            this.relationships[type_alias]['data'] = resource;
        }
    }

    public addRelationships(resources: ICollection, type_alias: string) {
        if (!(type_alias in this.relationships)) {
            this.relationships[type_alias] = { data: { } };
        } else {
            // we receive a new collection of this relationship. We need remove old (if don't exist on new collection)
            angular.forEach(this.relationships[type_alias]['data'], (resource) => {
                if (!(resource.id in resources)) {
                    delete this.relationships[type_alias]['data'][resource.id];
                }
            });
        }

        angular.forEach(resources, (resource) => {
            this.relationships[type_alias]['data'][resource.id] = resource;
        });
    }

    public addRelationshipsArray<T extends IResource>(resources: Array<T>, type_alias?: string): void {
        resources.forEach((item: IResource) => {
            this.addRelationship(item, type_alias || item.type);
        });
    }

    public removeRelationship(type_alias: string, id: string): boolean {
        if (!(type_alias in this.relationships)) {
            return false;
        }
        if (!('data' in this.relationships[type_alias])) {
            return false;
        }
        if (!(id in this.relationships[type_alias]['data'])) {
            return false;
        }
        delete this.relationships[type_alias]['data'][id];
        return true;
    }

    /**
    @return This resource like a service
    **/
    public getService() {
        return Converter.getService(this.type);
    }

    public clearMemoryCache() {
        return this.getService().memorycache.clearAllCollections();
    }
}
