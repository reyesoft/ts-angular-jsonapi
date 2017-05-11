import { ICollection, IResource } from '../interfaces';

export interface ICache {
    resources: Object;

    isCollectionExist(url: string): boolean;
    isCollectionLive(url: string, ttl: number): boolean;
    getOrCreateCollection(url: string, use_store?: boolean): ICollection;
    setCollection(url: string, collection: ICollection): void;
    clearAllCollections(): boolean;

    isResourceLive(id: string, ttl: number): boolean;
    getOrCreateResource(type: string, id: string, use_store?: boolean): IResource;
    getResource(id: string): IResource;
    getResourceFromStore(resource: IResource): void;
    setResource(resource: IResource): void;

    removeResource(id: string): void;
}
