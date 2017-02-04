/// <reference path="../index.d.ts" />

import './http.service';
import './http-store.service';

export class CoreServices {

    /** @ngInject */
    public constructor(
        protected JsonapiHttp,
        protected rsJsonapiConfig,
        protected $q,
        protected JsonapiHttpStore
    ) {

    }
}

angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
