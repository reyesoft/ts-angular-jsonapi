import { ICollection } from '../interfaces';
import { ICache } from '../interfaces/cache.d';
import { Base } from './base';

export class MemoryCache implements ICache {
    private collections = {};
    private collections_lastupdate = {};
    public resources = {};

    public isCollectionExist(url: string): boolean  {
        return (url in this.collections ? true : false);
    }

    public isCollectionLive(url: string, ttl: number): boolean  {
        return (Date.now() <= (this.collections_lastupdate[url] + ttl * 1000));
    }

    public getCollection(url: string): ICollection  {
        return this.collections[url];
    }

    public setCollection(url: string, collection: ICollection): void  {
        // clone collection, because after maybe delete items for filter o pagination
        this.collections[url] = Base.newCollection();
        angular.forEach(collection, (value, key) => {
            this.collections[url][key] = value;
            this.resources[value.id] = value;
        });
        this.collections_lastupdate[url] = Date.now();
    }

    public clearAllCollections() {
        this.collections = {};
        this.resources = {};
        this.collections_lastupdate = {};
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
