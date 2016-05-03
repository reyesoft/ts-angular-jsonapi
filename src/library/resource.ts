/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource {
        public schema: Jsonapi.ISchema;
        public data: any;
        public promise: any;
        // public Services: any;

        /** @ngInject */
        /* public constructor(
        ) {
        } */

        public all() {
            // this.promise = Jsonapi.Core.JsonapiHttp.get('http://localhost:8080/v1/authors');
            // this.data = [new Resource()];
            return this;
        }

        /* public get(params: IRealJsonapiParams): IJsonapiDataObject {
        let resource = new JsonapiDocument(this.RealJsonapiServices);
        return resource;
        } */
    }
    // angular.module('Jsonapi.services').service('JsonapiResource', Resource);
}
