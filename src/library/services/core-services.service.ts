/// <reference path="../index.d.ts" />

import './http.service';

export class CoreServices {

    /** @ngInject */
    public constructor(
        protected JsonapiHttp,
        protected rsJsonapiConfig,
        protected $q
    ) {

    }
}

angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
