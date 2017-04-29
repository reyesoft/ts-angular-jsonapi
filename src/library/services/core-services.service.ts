import * as angular from 'angular';
import './http.service';
import './http-storage.service';
import './cachestore.service';

export class CoreServices {

    /** @ngInject */
    public constructor(
        protected JsonapiHttp,
        protected rsJsonapiConfig,
        protected $q,
        protected JsonapiHttpStorage,
        protected JsonapiCacheStore
    ) {

    }
}

angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
