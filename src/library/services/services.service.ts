/// <reference path="./../_all.ts" />

module Jsonapi {
    export class Services {
        private static instance: Services;

        /** @ngInject */
        public constructor(
            protected JsonapiHttp,
            protected JsonapiParser,
            protected store
        ) {
            console.error('Services DONE!!!!!!!!! XXXXXXXXXXXXX');
        }

        /* public getInstance() {
            if (!Services.instance) {
                Services.instance = new Services();
            }
            return Services.instance;
        } */
    }

    //angular.module('Jsonapi')
    //    .service('Jsonapi.Services', Services);
}
