/// <reference path="../index.d.ts" />

export class HttpStorage {

    /** @ngInject */
    public constructor(
        protected store
    ) {

    }

    private isCacheLive(path: string, store_ttl: number): boolean  {
        let lastupdate_time = this.store.get(path + '_lastupdate_time');
        return (Date.now() <= (lastupdate_time + store_ttl * 1000));
    }

    public get(path: string, store_ttl: number): Boolean | Object {
        if (store_ttl === 0 || !this.isCacheLive(path, store_ttl)) {
            return false;
        }

        let data = this.store.get(path);
        console.log('store.get()', path, data);
        if (data) {
            return { data: data };
        } else {
            return false;
        }
    }

    public save(path: string, data: string) {
        this.store.set(path, data);
        this.store.set(path + '_lastupdate_time', Date.now());
    }
}
angular.module('Jsonapi.services').service('JsonapiHttpStore', HttpStorage);
