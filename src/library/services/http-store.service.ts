/// <reference path="../index.d.ts" />

export class HttpStorage {

    public url_cache = {};

    /** @ngInject */
    public constructor(
        protected store
    ) {

    }

    private isCacheLive(path: string, store_ttl: number): boolean  {
        let lastupdate_time = this.url_cache['jsonapi.' + path + '_lastupdate_time'];
        return (Date.now() <= (lastupdate_time + store_ttl * 1000));
    }

    public get(path: string, store_ttl: number): Boolean | Object {
        if (store_ttl === 0 || !this.isCacheLive(path, store_ttl)) {
            return false;
        }

        let data = this.url_cache['jsonapi.' + path];
        if (data) {
            return data;
        } else {
            return false;
        }
    }

    public save(path: string, data: string) {
        this.url_cache['jsonapi.' + path] = data;
        this.url_cache['jsonapi.' + path + '_lastupdate_time'] = Date.now();
    }
}
angular.module('Jsonapi.services').service('JsonapiHttpStore', HttpStorage);
