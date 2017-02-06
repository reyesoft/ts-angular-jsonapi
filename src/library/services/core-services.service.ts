/// <reference path="../index.d.ts" />

import './http.service';
import './http-storage.service';

export class CoreServices {

    /** @ngInject */
    public constructor(
        protected JsonapiHttp,
        protected rsJsonapiConfig,
        protected $q,
        protected JsonapiHttpStorage
    ) {

    }
}

angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
