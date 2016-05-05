module Jsonapi {
    export class Http {

        /** @ngInject */
        public constructor(
            protected $http,
            protected JsonapiConfig,
            protected $q
        ) {

        }

        public get(path: string) {
            let promise = this.$http({
                method: 'GET',
                url: this.JsonapiConfig.url + path
            });

            let deferred = this.$q.defer();
            let xthis = this;
            promise.then(
                success => {
                    deferred.resolve(success);
                },
                error => {
                    deferred.reject(error);
                }
            );
            return deferred.promise;
        }
    }
    angular.module('Jsonapi.services').service('JsonapiHttp', Http);
}
