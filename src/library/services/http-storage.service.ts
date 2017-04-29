/// <reference path="../index.d.ts" />
import * as angular from 'angular';

export class HttpStorage {
    private globalstore;
    private allstore;

    /** @ngInject */
    public constructor(
        protected $localForage,
        protected $q
    ) {
        this.globalstore = $localForage.createInstance({ name: 'jsonapiglobal' });
        this.allstore = $localForage.createInstance({ name: 'allstore' });

        // check if is time to check store
        this.globalstore.getItem('_lastclean_time').then(success => {
            if (success) {
                if (Date.now() >= (success.time + 12 * 3600 * 1000)) {
                    // is time to check store!
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
                this.allstore.getItem(key).then(
                    success2 => {
                        // es tiempo de removerlo?
                        if (Date.now() >= (success2._lastupdate_time + 12 * 3600 * 1000)) {
                            // removemos!!
                            this.allstore.removeItem(key);
                        }
                    }
                );
            });
        });
    }

    public getObjet(key: string): any /* Promise<void> */ {
        return this.allstore.getItem('jsonapi.' + key);
    }

    public getObjets(keys: Array<string>): any /* Promise<void> */ {
        return this.allstore.getItem('jsonapi.' + keys[0]);
    }

    public saveObject(key: string, value: Object): void {
        value['_lastupdate_time'] = Date.now();
        this.allstore.setItem('jsonapi.' + key, value);
    }

    /**
    @deprecated Used by old http response cache
    **/
    public get(path: string, storage_ttl: number): ng.IPromise<void> {
        let defered = this.$q.defer();

        if (storage_ttl === 0) {
            defered.reject(false);
        }

        this.$localForage.getItem('jsonapi.' + path + '_lastupdate_time').then (
            success => {
                // is alive the cache?
                if (Date.now() <= (success + storage_ttl * 1000)) {
                    // cache live, then get cached data
                    this.$localForage.getItem('jsonapi.' + path).then (
                        success => {
                            defered.resolve(success);
                        },
                        error => {
                            defered.reject(false);
                        }
                    );
                } else {
                    defered.reject(false);
                }
            },
            error => {
                defered.reject(false);
            }
        );

        return defered.promise;
    }

    /**
    @deprecated Used by old http response cache
    **/
    public save(path: string, data: any) {
        this.$localForage.setItem('jsonapi.' + path, data);
        this.$localForage.setItem('jsonapi.' + path + '_lastupdate_time', Date.now());
    }
}
angular.module('Jsonapi.services').service('JsonapiHttpStorage', HttpStorage);
