module Jsonapi {
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
            let self = this;
            Jsonapi.Core.Me.refreshLoadings(1);
            promise.then(
                success => {
                    // timeout just for develop environment
                    self.$timeout( () => {
                        Jsonapi.Core.Me.refreshLoadings(-1);
                        deferred.resolve(success);
                    }, self.rsJsonapiConfig.delay);
                },
                error => {
                    Jsonapi.Core.Me.refreshLoadings(-1);
                    if (error.status <= 0) {
                        // offline?
                        if (!Jsonapi.Core.Me.loadingsOffline(error)) {
                            console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsOffline for catch it) error =>', error);
                        }
                    } else {
                        if (!Jsonapi.Core.Me.loadingsError(error)) {
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
}
