import { ICollection } from '../interfaces';
import { ICache } from '../interfaces/cache.d';

export class MemoryCache implements ICache {
    public collections = {};
    public resources = {};
    private collections_lastupdate = {};

    public isCollectionLive(url: string, ttl: number): boolean  {
        return (Date.now() <= (this.collections_lastupdate[url] + ttl * 1000));
    }

    public getCollection(url: string): ICollection  {
        return this.collections[url];
    }

    public setCollection(url: string, collection: ICollection): void  {
        this.collections[url] = collection;
        this.collections_lastupdate[url] = Date.now();
    }

    public clearAllCollections() {
        this.collections = {};
        this.resources = {};
        this.collections_lastupdate = {};
    }



    public removeResource(id: string): void  {
        angular.forEach(this.collections, (value, key) => {
            delete value[id];
        });
        delete this.resources[id];
    }
}
