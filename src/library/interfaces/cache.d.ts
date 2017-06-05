import { ICollection, IResource } from '../interfaces';

export interface ICache {
    setCollection(url: string, collection: ICollection): void;
    setResource(resource: IResource): void;
    deprecateCollections(path_start_with: string): boolean;
}
