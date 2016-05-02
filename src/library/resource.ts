/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource {
        public schema: any;
        public data: any;
        public promise: any;
        // public Services: any;

        /** @ngInject */
        public constructor(
            // protected Services
            protected $location,
            protected Services
        ) {
            // this.Services = Jsonapi.Services.getInstance();
        }

        public all() {
            // setted yet?
            // resources = [new JsonapiDocument(this.RealJsonapiServices)];

            // cached?
            // resources = [new JsonapiDocument(this.RealJsonapiServices)];

            // from httprequest?

            console.log('his.Serv', this.Services);


            /* this.promise = this.Services.JsonapiHttp.get('http://localhost:8080/v1/authors');
            this.data = [new Resource(this.Services)];

            return this; */
        }

        /* public get(params: IRealJsonapiParams): IJsonapiDataObject {
        let resource = new JsonapiDocument(this.RealJsonapiServices);
        return resource;
    } */
}
}
