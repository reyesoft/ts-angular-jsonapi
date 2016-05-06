module Jsonapi {
    export class CoreServices {

        /** @ngInject */
        public constructor(
            protected JsonapiHttp
        ) {

        }
    }

    angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
}
