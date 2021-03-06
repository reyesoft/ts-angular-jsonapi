import * as angular from 'angular';
import { IDataObject } from '../interfaces/data-object';
import '../services/noduplicatedhttpcalls.service';
import { Core } from '../core';

export class Http {

    /** @ngInject */
    public constructor(
        protected $http: ng.IHttpService,
        protected $timeout,
        protected rsJsonapiConfig,
        protected noDuplicatedHttpCallsService,
        protected $q
    ) {

    }

    public delete(path: string): ng.IPromise<IDataObject> {
        return this.exec(path, 'DELETE');
    }

    public get(path: string): ng.IPromise<IDataObject> {
        return this.exec(path, 'get');
    }

    protected exec(path: string, method: string, data?: IDataObject, call_loadings_error: boolean = true): ng.IPromise<IDataObject> {

        let fakeHttpPromise = null;

        // http request (if we don't have any GET request yet)
        if (method !== 'get' || !this.noDuplicatedHttpCallsService.hasPromises(path)) {
            let req: ng.IRequestConfig = {
                method: method,
                url: this.rsJsonapiConfig.url + path,
                headers: {
                    'Content-Type': 'application/vnd.api+json'
                }
            };
            if (data) {
                req.data = data;
            }
            let http_promise = this.$http(req);

            if (method === 'get') {
                this.noDuplicatedHttpCallsService.setPromiseRequest(path, http_promise);
            } else {
                fakeHttpPromise = http_promise;
            }
        }
        if (method === 'get') {
            fakeHttpPromise = this.noDuplicatedHttpCallsService.getAPromise(path);
        }

        let deferred = this.$q.defer();
        Core.me.refreshLoadings(1);
        fakeHttpPromise.then(
            success => {
                // timeout just for develop environment
                this.$timeout( () => {
                    Core.me.refreshLoadings(-1);
                    deferred.resolve(success);
                }, this.rsJsonapiConfig.delay);
            }
        ).catch(
            error => {
                Core.me.refreshLoadings(-1);
                if (error.status <= 0) {
                    // offline?
                    if (!Core.me.loadingsOffline(error)) {
                        console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsOffline for catch it) error =>', error);
                    }
                } else {
                    if (call_loadings_error && !Core.me.loadingsError(error)) {
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
