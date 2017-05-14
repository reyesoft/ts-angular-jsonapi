import * as angular from 'angular';
import '../sources/http.service';
import '../sources/store.service';

export class CoreServices {

    /** @ngInject */
    public constructor(
        protected JsonapiHttp,
        protected rsJsonapiConfig,
        protected $q: ng.IQService,
        protected JsonapiStoreService
    ) {

    }
}

angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
