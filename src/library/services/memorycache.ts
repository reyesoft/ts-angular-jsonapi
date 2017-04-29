import * as angular from 'angular';
import { ICollection, IResource } from '../interfaces';
import { IDataResource } from '../interfaces/data-resource';
import { ICache } from '../interfaces/cache.d';
import { Core } from '../core';
import { Base } from './base';
import { Converter } from './converter';
import { ResourceFunctions } from './resource-functions';

export class MemoryCache implements ICache {
    private collections = {};
    private collections_lastupdate = {};
    public resources = {};

    public isCollectionExist(url: string): boolean {
        return (url in this.collections && this.collections[url].$source !== 'new' ? true : false);
    }

    public isCollectionLive(url: string, ttl: number): boolean {
        return (Date.now() <= (this.collections_lastupdate[url] + ttl * 1000));
    }

    public isResourceLive(id: string, ttl: number): boolean {
        return this.resources[id] && (Date.now() <= (this.resources[id].lastupdate + ttl * 1000));
    }

    public getOrCreateCollection(url: string, use_store = false): ICollection {
        if (!(url in this.collections)) {
            this.collections[url] = Base.newCollection();
            this.collections[url].$source = 'new';
            if (use_store) {
                this.getCollectionFromStore(url, this.collections[url]);
            }
        }
        return this.collections[url];
    }

    public setCollection(url: string, collection: ICollection): void  {
        // clone collection, because after maybe delete items for localfilter o pagination
        this.collections[url] = Base.newCollection();
        angular.forEach(collection, (resource: IResource, resource_id: string) => {
            this.collections[url][resource_id] = resource;
            this.setResource(resource);
        });
        this.collections[url]['page'] = collection.page;
        this.saveCollectionStore(url, collection);
        this.collections_lastupdate[url] = Date.now();
    }

    public getOrCreateResource(type: string, id: string, use_store = false): IResource {
        if (Converter.getService(type).memorycache && id in Converter.getService(type).memorycache.resources) {
            return Converter.getService(type).memorycache.getResource(id);
        } else {
            let resource = Converter.getService(type).new();
            resource.id = id;

            if (id && use_store) {
                Converter.getService(type).memorycache.getResourceFromStore(resource);
            }

            return resource;
        }
    }

    /* @deprecated */
    public getResource(id: string): IResource  {
        return this.resources[id];
    }

    public setResource(resource: IResource): void  {
        // we cannot redefine object, because view don't update.
        if (resource.id in this.resources) {
            ResourceFunctions.resourceToResource(resource, this.resources[resource.id]);
        } else {
            this.resources[resource.id] = resource;
        }
        this.resources[resource.id].lastupdate = Date.now();
        this.saveResourceStore(resource);
    }

    public clearAllCollections(): boolean {
        this.collections = {};
        this.collections_lastupdate = {};
        return true;
    }

    public removeResource(id: string): void  {
        angular.forEach(this.collections, (value, url) => {
            delete value[id];
        });
        this.resources[id].attributes = {}; // just for confirm deletion on view
        this.resources[id].relationships = {}; // just for confirm deletion on view
        delete this.resources[id];
    }

    // -------- STORE ---------------------------------

    public getResourceFromStore(resource: IResource): void {
        let promise = Core.injectedServices.JsonapiHttpStorage.getObjet(resource.type + '.' + resource.id);
        promise.then (
            success => {
                if (success) {
                    Converter.build({ data: success }, resource);
                }
            }
        );
    }

    private saveResourceStore(resource: IResource) {
        Core.injectedServices.JsonapiHttpStorage.saveObject(
            resource.type + '.' + resource.id,
            resource.toObject().data
        );
    }

    private getCollectionFromStore(url:string, collection: ICollection): void {
        let promise = Core.injectedServices.JsonapiHttpStorage.getObjet('collection.' + url);
        promise.then (
            success => {
                if (success) {
                    collection.$source = 'store';
                    angular.forEach(success.data, (dataresource: IDataResource) => {
                        collection[dataresource.id] = this.getOrCreateResource(dataresource.type, dataresource.id, true);
                    });
                }
            }
        );
    }

    private saveCollectionStore(url: string, collection: ICollection) {
        let tmp = { data: {} };
        angular.forEach(collection, (resource: IResource) => {
            tmp.data[resource.id] = { id: resource.id, type: resource.type };
        });
        Core.injectedServices.JsonapiHttpStorage.saveObject(
            'collection.' + url,
            tmp
        );
    }
}
