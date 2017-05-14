import * as angular from 'angular';
import { ICollection, IResource } from '../interfaces';
import { ICacheMemory } from '../interfaces/cachememory.d';
import { Base } from './base';
import { Converter } from './converter';
import { ResourceFunctions } from './resource-functions';

export class CacheMemory implements ICacheMemory {
    private collections: { [url: string]: ICollection } = {};
    private collections_lastupdate: { [url: string]: number } = {};
    public resources: { [id: string]: IResource } = {};

    public isCollectionExist(url: string): boolean {
        return (url in this.collections && this.collections[url].$source !== 'new' ? true : false);
    }

    public isCollectionLive(url: string, ttl: number): boolean {
        return (Date.now() <= (this.collections_lastupdate[url] + ttl * 1000));
    }

    public isResourceLive(id: string, ttl: number): boolean {
        return this.resources[id] && (Date.now() <= (this.resources[id].lastupdate + ttl * 1000));
    }

    public getOrCreateCollection(url: string): ICollection {
        if (!(url in this.collections)) {
            this.collections[url] = Base.newCollection();
            this.collections[url].$source = 'new';
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
        this.collections_lastupdate[url] = Date.now();
    }

    public getOrCreateResource(type: string, id: string): IResource {
        if (Converter.getService(type).cachememory && id in Converter.getService(type).cachememory.resources) {
            return Converter.getService(type).cachememory.getResource(id);
        } else {
            let resource = Converter.getService(type).new();
            resource.id = id;
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
}
