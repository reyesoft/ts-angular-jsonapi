import * as angular from 'angular';
import { ICollection, IResource } from '../interfaces';
import { IDataResource } from '../interfaces/data-resource';
import { IDataCollection } from '../interfaces/data-collection';
import { ICacheStore } from '../interfaces';
import { Core } from '../core';
import { Converter } from './converter';

export class CacheStore implements ICacheStore {
    public getResource(resource: IResource/* | IDataResource*/, include: Array<string> = []): ng.IPromise<object> {
        let deferred = Core.injectedServices.$q.defer();

        Core.injectedServices.JsonapiStoreService.getObjet(resource.type + '.' + resource.id)
        .then(success => {
            Converter.build({ data: success }, resource);

            let promises: Array<ng.IPromise<object>> = [];

            // include some times is a collection :S
            // for (let keys in include) {
            angular.forEach(include, resource_type => {
                //  && ('attributes' in resource.relationships[resource_type].data)
                if (resource_type in resource.relationships) {
                    // hasOne
                    let related_resource = (<IDataResource>resource.relationships[resource_type].data);
                    if (!('attributes' in related_resource)) {
                        // no está cargado aún
                        let builded_resource = this.getResourceFromMemory(related_resource);
                        if (builded_resource.is_new) {
                            // no está en memoria, la pedimos a store
                            promises.push(this.getResource(builded_resource));
                        } else {
                            console.warn('ts-angular-json: esto no debería pasar #isdjf2l1a');
                        }
                        resource.relationships[resource_type].data = builded_resource;
                    }

                    // angular.forEach(resource.relationships[resource_type], (dataresource: IDataResource) => {
                    //     console.log('> debemos pedir', resource_type, 'id', dataresource, dataresource.id);
                    // });
                }
            });

            resource.lastupdate = success._lastupdate_time;

            // no debo esperar a que se resuelvan los include
            if (promises.length === 0) {
                deferred.resolve(success);
            } else {
                // esperamos las promesas de los include antes de dar el resolve
                Core.injectedServices.$q.all(promises)
                .then(success3 => {
                    deferred.resolve(success3);
                })
                .catch((error3) => {
                    deferred.reject(error3);
                });
            }
        })
        .catch(() => {
            deferred.reject();
        });

        // build collection and resources from store
        // Core.injectedServices.$q.all(promises)
        // .then(success2 => {
        //     deferred.resolve(success2);
        // })
        // .catch(() => {
        //     deferred.reject();
        // });

        return deferred.promise;
    }

    public setResource(resource: IResource) {
        Core.injectedServices.JsonapiStoreService.saveObject(
            resource.type + '.' + resource.id,
            resource.toObject().data
        );
    }

    public getCollectionFromStorePromise(url: string, include: Array<string>, collection: ICollection): ng.IPromise<object> {
        var deferred = Core.injectedServices.$q.defer();
        this.getCollectionFromStore(url, include, collection, deferred);
        return deferred.promise;
    }

    private getCollectionFromStore(url: string, include: Array<string>, collection: ICollection, job_deferred: ng.IDeferred<ICollection>) {
        let promise = Core.injectedServices.JsonapiStoreService.getObjet('collection.' + url);
        promise.then((success: IDataCollection) => {
            // build collection from store and resources from memory
            if (
                this.fillCollectionWithArrrayAndResourcesOnMemory(success.data, collection)
            ) {
                collection.$source = 'store';  // collection from storeservice, resources from memory
                collection.$cache_last_update = success._lastupdate_time;
                job_deferred.resolve(collection);
                return ;
            }

            let promise = this.fillCollectionWithArrrayAndResourcesOnStore(success, include, collection);
            promise.then(() => {
                // just for precaution, we not rewrite server data
                if (collection.$source !== 'new') {
                    console.warn('ts-angular-json: esto no debería pasar. buscar eEa2ASd2#');
                    throw '';
                }
                collection.$source = 'store';  // collection and resources from storeservice
                collection.$cache_last_update = success._lastupdate_time;
                job_deferred.resolve(collection);
            })
            .catch(() => {
                job_deferred.reject();
            });
        })
        .catch(() => {
            job_deferred.reject();
        });
    }

    private fillCollectionWithArrrayAndResourcesOnMemory(dataresources: Array<IDataResource>, collection: ICollection): boolean {
        let all_ok = true;
        for (let key in dataresources) {
            let dataresource = dataresources[key];

            let resource = this.getResourceFromMemory(dataresource);
            if (resource.is_new) {
                all_ok = false;
                break;
            }
            collection[dataresource.id] = resource;
        }
        return all_ok;
    }

    private getResourceFromMemory(dataresource: IDataResource): IResource {
        let cachememory = Converter.getService(dataresource.type).cachememory;
        let resource = cachememory.getOrCreateResource(dataresource.type, dataresource.id);
        return resource;
    }

    private fillCollectionWithArrrayAndResourcesOnStore(
        datacollection: IDataCollection, include: Array<string>, collection: ICollection
    ): ng.IPromise<object> {
        var deferred: ng.IDeferred<object> = Core.injectedServices.$q.defer();

        // request resources from store
        let temporalcollection = {};
        let promises = [];
        for (let key in datacollection.data) {
            let dataresource: IDataResource = datacollection.data[key];
            let cachememory = Converter.getService(dataresource.type).cachememory;
            temporalcollection[dataresource.id] = cachememory.getOrCreateResource(dataresource.type, dataresource.id);
            promises.push(
                this.getResource(temporalcollection[dataresource.id], include)
            );
        }

        // build collection and resources from store
        Core.injectedServices.$q.all(promises)
        .then(success2 => {
            datacollection.page ? collection.page = datacollection.page : null;
            for (let key in temporalcollection) {
                let resource: IResource = temporalcollection[key];
                collection[resource.id] = resource;  // collection from storeservice, resources from memory
            }
            deferred.resolve(collection);
        })
        .catch(error2 => {
            deferred.reject(error2);
        });

        return deferred.promise;
    }

    public setCollection(url: string, collection: ICollection, include: Array<string>) {
        let tmp = { data: {}, page: {} };
        let resources_for_save: { [uniqkey: string]: IResource } = { };
        angular.forEach(collection, (resource: IResource) => {
            this.setResource(resource);
            tmp.data[resource.id] = { id: resource.id, type: resource.type };

            angular.forEach(include, resource_type => {
                let ress = <IResource>resource.relationships[resource_type].data;
                resources_for_save[resource_type + ress.id] = ress;
            });
        });
        tmp.page = collection.page;
        Core.injectedServices.JsonapiStoreService.saveObject(
            'collection.' + url,
            tmp
        );

        angular.forEach(resources_for_save, resource_for_save => {
            this.setResource(resource_for_save);
        });
    }

    public deprecateCollections(path_start_with: string) {
        Core.injectedServices.JsonapiStoreService.deprecateObjectsWithKey(
            'collection.' + path_start_with
        );
        return true;
    }
}
