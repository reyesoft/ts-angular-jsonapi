/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource {
        protected schema: Jsonapi.ISchema;
        protected promise: any;

        public id: String;
        public attributes: Object;

        public register() {
            return Jsonapi.Core.Me.register(this);
        }

        public all(params, fc_success, fc_error) {

            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
            }

            // pedido http
            let response = [];
            let promise = Jsonapi.Core.Services.JsonapiHttp.get('http://localhost:8080/v1/authors');
            promise.then(
                success => {
                    angular.forEach(success.data.data, function (value) {
                        let resource = new Resource();
                        resource.id = value.id;
                        resource.attributes = value.attributes;
                        response.push(resource);
                    });
                    fc_success ? fc_success(response) : null;
                },
                error => {
                    fc_error(response);
                }
            );
            return response;
        }
    }
}
