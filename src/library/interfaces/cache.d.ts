import { ICollection, IResource } from '../interfaces';

export interface ICache {
    // collections: Object;
    resources: Object;

    isCollectionExist(url: string): boolean;
    isCollectionLive(url: string, ttl: number): boolean;
    getCollection(url: string): ICollection;
    setCollection(url: string, collection: ICollection): void;
    clearAllCollections(): boolean;
    isResourceLive(id: string, ttl: number): boolean;
    setResource(resource: IResource): void;
    getCollection(url: string): ICollection;

    removeResource(id: string): void;
}
