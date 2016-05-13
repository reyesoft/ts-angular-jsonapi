module Jsonapi {
    export class Http {

        /** @ngInject */
        public constructor(
            protected $http,
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

        protected exec(path: string, method: string, data?: Jsonapi.IDataObject) {
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
