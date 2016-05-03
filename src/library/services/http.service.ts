/// <reference path="./../_all.ts" />

module Jsonapi {
    export class Http {

        /** @ngInject */
        public constructor(
            protected $http,
            protected AppSettings,
            protected store,
            protected $q
        ) {

        }

        public get(path: string) {
            let promise = this.$http({
                method: 'GET',
                url: this.AppSettings.APIURL + path
            });

            let deferred = this.$q.defer();
            let xthis = this;
            promise.then(
                success => {
                    xthis.store.set('xxx', 2);
                    deferred.resolve(success);
                },
                error => {
                    deferred.reject(error);
                }
            );
            return deferred.promise;
        }
    }
}
