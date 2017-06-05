import { ICollection, IResource } from '../interfaces';
import { ICache } from '../interfaces/cache.d';

export interface ICacheStore extends ICache {
    getResource(resource: IResource): ng.IPromise<object>;
    getCollectionFromStorePromise(url:string, collection: ICollection): ng.IPromise<ICollection>;
}
