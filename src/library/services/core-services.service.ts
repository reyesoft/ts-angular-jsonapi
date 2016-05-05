module Jsonapi {
    export class CoreServices {
        // private static instance: Services;
        // public static nato = 'pablo';
        public cadena = 'pablo';

        /** @ngInject */
        public constructor(
            protected JsonapiHttp
        ) {

        }

        /* public constructor(
            protected JsonapiHttp,
            protected JsonapiParser,
            protected store
        ) {
            console.error('Services DONE!!!!!!!!! XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
        } */

        /* public getInstance() {
            if (!Services.instance) {
                Services.instance = new Services();
            }
            return Services.instance;
        } */
    }

    angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
    //angular.module('Jsonapi')
    //    .service('Jsonapi.Services', Services);
}
