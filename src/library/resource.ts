/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource implements IResource {
        public schema: ISchema;

        public type: string;
        public id: string;
        public attributes: any;

        public register() {
            Jsonapi.Core.Me.register(this);
        }

        public get (id: String, params?, fc_success?, fc_error?): IResource {
            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
                params = { };
            }

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.type);
            path.addPath(id);
            params.include ? path.setInclude(params.include) : null;

            let resource = new Resource();

            let promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(
                success => {
                    resource.attributes = success.data.data.attributes;
                    resource.id = success.data.data.id;
                    fc_success ? fc_success(resource) : null;
                },
                error => {
                    fc_error(error);
                }
            );

            return resource;
        }

        public all(params?, fc_success?, fc_error?): Array<IResource> {
            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
                params = { };
            }

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.type);
            params.include ? path.setInclude(params.include) : null;

            // make request
            let response = [];
            let promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
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
                    fc_error(error);
                }
            );
            return response;
        }
    }
}
