/// <reference path="../index.d.ts" />

import { Core } from '../core';
// import { Resource } from '../resource';

export class Http {

    /** @ngInject */
    public constructor(
        protected $http,
        protected $timeout,
        protected rsJsonapiConfig,
        protected $q
    ) {

    }

    public delete(path: string) {
        return this.exec(path, 'DELETE');
    }

    public get(path: string) {
        return this.exec(path, 'GET');
    }

    protected exec(path: string, method: string, data?: IDataObject) {
        let req = {
            method: method,
            url: this.rsJsonapiConfig.url + path,
            headers: {
                'Content-Type': 'application/vnd.api+json'
            }
        };
        data && (req['data'] = data);
        let promise = this.$http(req);

        let deferred = this.$q.defer();
        let self = this;
        Core.Me.refreshLoadings(1);
        promise.then(
            success => {
                // timeout just for develop environment
                self.$timeout( () => {
                    Core.Me.refreshLoadings(-1);
                    deferred.resolve(success);
                }, self.rsJsonapiConfig.delay);
            },
            error => {
                Core.Me.refreshLoadings(-1);
                if (error.status <= 0) {
                    // offline?
                    if (!Core.Me.loadingsOffline(error)) {
                        console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsOffline for catch it) error =>', error);
                    }
                } else {
                    if (!Core.Me.loadingsError(error)) {
                        console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsError for catch it) error =>', error);
                    }
                }
                deferred.reject(error);
            }
        );
        return deferred.promise;
    }
}
angular.module('Jsonapi.services').service('JsonapiHttp', Http);
