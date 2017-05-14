import { ICollection, IResource } from '../interfaces';
import { ICache } from '../interfaces/cache.d';

export interface ICacheMemory extends ICache {
    resources: { [id: string]: IResource };

    getResource(id: string): IResource;
    getOrCreateCollection(url: string): ICollection;
    isCollectionExist(url: string): boolean;
    isCollectionLive(url: string, ttl: number): boolean;
    clearAllCollections(): boolean;

    isResourceLive(id: string, ttl: number): boolean;
    getOrCreateResource(type: string, id: string): IResource;
    getResource(id: string): IResource;

    removeResource(id: string): void;
}
