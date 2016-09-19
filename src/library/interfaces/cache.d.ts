import { ICollection } from '../interfaces';

export interface ICache {
    collections: Object;
    resources: Object;

    isCollectionLive(url: string, ttl: number): boolean;
    getCollection(url: string): ICollection;
    setCollection(url: string, collection: ICollection): void;
    clearAllCollections(): void;

    removeResource(id: string): void;
}
