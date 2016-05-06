module Jsonapi {
    export class Http {

        /** @ngInject */
        public constructor(
            protected $http,
            protected rsJsonapiConfig,
            protected $q
        ) {

        }

        public get(path: string) {
            let promise = this.$http({
                method: 'GET',
                url: this.rsJsonapiConfig.url + path
            });

            let deferred = this.$q.defer();
            let xthis = this;
            Jsonapi.Core.Me.refreshLoadings(1);
            promise.then(
                success => {
                    Jsonapi.Core.Me.refreshLoadings(-1);
                    deferred.resolve(success);
                },
                error => {
                    Jsonapi.Core.Me.refreshLoadings(-1);
                    deferred.reject(error);
                }
            );
            return deferred.promise;
        }
    }
    angular.module('Jsonapi.services').service('JsonapiHttp', Http);
}
