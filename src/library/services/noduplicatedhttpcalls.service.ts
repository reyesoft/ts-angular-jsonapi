/// <reference path="../index.d.ts" />
import * as angular from 'angular';

export class NoDuplicatedHttpCallsService {
    public calls = {};

    /** @ngInject */
    public constructor(
        protected $q
    ) {

    }

    protected hasPromises(path: string) {
        return (path in this.calls);
    }

    protected getAPromise(path: string) {
        if (!(path in this.calls)) {
            this.calls[path] = [];
        }

        let deferred = this.$q.defer();
        this.calls[path].push(deferred);
        return deferred.promise;
    }

    protected setPromiseRequest(path, promise) {
        promise.then(
            success => {
                if (path in this.calls) {
                    for (let deferred of this.calls[path]) {
                        deferred.resolve(success);
                    }
                    delete this.calls[path];
                }
            },
            error => {
                if (path in this.calls) {
                    for (let deferred of this.calls[path]) {
                        deferred.reject(error);
                    }
                    delete this.calls[path];
                }
            }
        );
    }
    //
    // protected resolve(path: string, success) {
    //     if (path in this.calls) {
    //         for (let deferred of this.calls[path]) {
    //             deferred.resolve(success);
    //         }
    //         delete this.calls[path];
    //     }
    // }
}
angular.module('Jsonapi.services').service('noDuplicatedHttpCallsService', NoDuplicatedHttpCallsService);
