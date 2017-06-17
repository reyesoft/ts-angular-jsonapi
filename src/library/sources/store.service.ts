import * as angular from 'angular';

export class StoreService {
    private globalstore;
    private allstore;

    /** @ngInject */
    public constructor(
        protected $localForage,
        protected $q
    ) {
        this.globalstore = $localForage.createInstance({ name: 'jsonapiglobal' });
        this.allstore = $localForage.createInstance({ name: 'allstore' });
        this.checkIfIsTimeToClean();
    }

    private checkIfIsTimeToClean() {
        // check if is time to check cachestore
        this.globalstore.getItem('_lastclean_time').then(success => {
            if (success) {
                if (Date.now() >= (success.time + 12 * 3600 * 1000)) {
                    // is time to check cachestore!
                    this.globalstore.setItem('_lastclean_time', { time: Date.now() });
                    this.checkAndDeleteOldElements();
                }
            } else {
                this.globalstore.setItem('_lastclean_time', { time: Date.now() });
            }
        });
    }

    private checkAndDeleteOldElements() {
        this.allstore.keys().then(success => {
            angular.forEach(success, (key) => {
                // recorremos cada item y vemos si es tiempo de removerlo
                this.allstore.getItem(key).then(success2 => {
                    // es tiempo de removerlo?
                    if (Date.now() >= (success2._lastupdate_time + 24 * 3600 * 1000)) {
                        // removemos!!
                        this.allstore.removeItem(key);
                    }
                });
            });
        });
    }

    public getObjet(key: string): Promise<object> {
        let deferred = this.$q.defer();

        this.allstore.getItem('jsonapi.' + key)
        .then (success => {
            // problem on localForage
            if (success) {
                deferred.resolve(success);
            } else {
                deferred.reject(success);
            }
        })
        .catch(error => {
            deferred.reject(error);
        });

        return deferred.promise;
    }

    public getObjets(keys: Array<string>): Promise<object> {
        return this.allstore.getItem('jsonapi.' + keys[0]);
    }

    public saveObject(key: string, value: Object): void {
        value['_lastupdate_time'] = Date.now();
        this.allstore.setItem('jsonapi.' + key, value);
    }

    public clearCache() {
        this.allstore.clear();
        this.globalstore.clear();
    }

    public deprecateObjectsWithKey(key_start_with: string) {
        this.allstore.keys().then(success => {
            angular.forEach(success, (key: string) => {
                if (key.startsWith(key_start_with)) {
                    // key of stored object starts with key_start_with
                    this.allstore.getItem(key).then(success2 => {
                        success2['_lastupdate_time'] = 0;
                        this.allstore.setItem(key, success2);
                    });
                }
            });
        });
    }
}

angular.module('Jsonapi.services').service('JsonapiStoreService', StoreService);
