/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource {
        protected schema: Jsonapi.ISchema;
        protected promise: any;

        public id: String;
        public type: String;
        public attributes: Object;

        public register() {
            return Jsonapi.Core.Me.register(this);
        }

        public all(params, fc_success, fc_error) {

            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
                params = null;
            }

            // pedido http

            // make url path
            let path = this.type;
            if (params) {
                if (params.include) {
                    path += '/?include=' + params.include.join(',');
                }
            }

            let response = [];
            let promise = Jsonapi.Core.Services.JsonapiHttp.get(path);
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
