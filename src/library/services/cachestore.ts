import * as angular from 'angular';
import { ICollection, IResource } from '../interfaces';
import { IDataResource } from '../interfaces/data-resource';
import { ICacheStore } from '../interfaces';
import { Core } from '../core';
import { Converter } from './converter';

export class CacheStore implements ICacheStore {
    public getResource(resource: IResource): ng.IPromise<object> {
        let promise = Core.injectedServices.JsonapiStoreService.getObjet(resource.type + '.' + resource.id);
        promise.then(success => {
            if (success) {
                Converter.build({ data: success }, resource);
                resource.lastupdate = success._lastupdate_time;
            }
        });
        return promise;
    }

    public setResource(resource: IResource) {
        Core.injectedServices.JsonapiStoreService.saveObject(
            resource.type + '.' + resource.id,
            resource.toObject().data
        );
    }

    public getCollectionFromStorePromise(url: string, collection: ICollection): ng.IPromise<object> {
        var deferred = Core.injectedServices.$q.defer();
        this.getCollectionFromStore(url, collection, deferred);
        return deferred.promise;
    }

    private getCollectionFromStore(url: string, collection: ICollection, job_deferred: ng.IDeferred<ICollection> = null): void {
        let promise = Core.injectedServices.JsonapiStoreService.getObjet('collection.' + url);
        promise.then(success => {
            try {
                if (!success) {
                    throw '';
                }

                // build collection from store and resources from memory
                let all_ok = true;
                for (let key in success.data) {
                    let dataresource: IDataResource = success.data[key];

                    let cachememory = Converter.getService(dataresource.type).cachememory;
                    let resource = cachememory.getOrCreateResource(dataresource.type, dataresource.id);

                    if (resource.is_new) {
                        all_ok = false;
                        break;
                    }
                    collection[dataresource.id] = resource;
                }
                if (all_ok) {
                    collection.$source = 'store';  // collection from storeservice, resources from memory
                    collection.$cache_last_update = success._lastupdate_time;
                    job_deferred.resolve(collection);
                    return ;
                }

                // request resources from store
                let temporalcollection = {};
                let promises = [];
                for (let key in success.data) {
                    let dataresource: IDataResource = success.data[key];
                    let cachememory = Converter.getService(dataresource.type).cachememory;
                    temporalcollection[dataresource.id] = cachememory.getOrCreateResource(dataresource.type, dataresource.id);
                    promises.push(
                        this.getResource(temporalcollection[dataresource.id])
                    );
                }

                // build collection and resources from store
                Core.injectedServices.$q.all(promises).then(success2 => {
                    // just for precaution, we not rewrite server data
                    if (collection.$source !== 'new') {
                        throw '';
                    }
                    success.page ? collection.page = success.page : null;
                    for (let key in temporalcollection) {
                        let resource: IResource = temporalcollection[key];
                        collection.$source = 'store';  // collection and resources from storeservice
                        collection.$cache_last_update = success._lastupdate_time;
                        collection[resource.id] = resource;  // collection from storeservice, resources from memory
                    }
                    job_deferred.resolve(collection);
                });
            } catch (e) {
                job_deferred.reject();
            }
        },
        error => {
            job_deferred.reject();
        });
    }

    public setCollection(url: string, collection: ICollection) {
        let tmp = { data: {}, page: {} };
        angular.forEach(collection, (resource: IResource) => {
            this.setResource(resource);
            tmp.data[resource.id] = { id: resource.id, type: resource.type };
        });
        tmp.page = collection.page;
        Core.injectedServices.JsonapiStoreService.saveObject(
            'collection.' + url,
            tmp
        );
    }

    public deprecateCollections(collection_type: string) {
        Core.injectedServices.JsonapiStoreService.deprecateObjectsWithKey(
            'collection.' + collection_type
        );
        return true;
    }
}
