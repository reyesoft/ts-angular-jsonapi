/// <reference path="./_all.ts" />

module Jsonapi {
    export class Resource implements IResource {
        public schema: ISchema;
        public path: string = null;   // without slashes

        public type: string;
        public id: string;
        public attributes: any ;
        public relationships: any = [];

        public clone(): any {
            var cloneObj = new (<any>this.constructor)();
            for (var attribut in this) {
                if (typeof this[attribut] !== 'object') {
                    cloneObj[attribut] = this[attribut];
                }
            }
            return cloneObj;
        }

        // register schema on Jsonapi.Core
        public register() {
            Jsonapi.Core.Me.register(this);
        }

        // empty self object
        public new() {
            let xthis = this;
            angular.forEach(this.schema.relationships, (value, key) => {
                xthis.relationships[key] = {};
                xthis.relationships[key]['data'] = {};
            });
        }

        public get(id: String, params?, fc_success?, fc_error?): IResource {
            return this.exec(id, params, fc_success, fc_error);
        }

        public all(params?, fc_success?, fc_error?): Array<IResource> {
            return this.exec(null, params, fc_success, fc_error);
        }

        public exec(id: String, params, fc_success, fc_error): any {
            // makes `params` optional
            let params_base = { include: null };
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = fc_success;
                params = params_base;
            } else {
                if (angular.isUndefined(params)) {
                    params = params_base;
                } else {
                    params = angular.extend({}, params_base, params);
                }
            }

            fc_success = angular.isFunction(fc_success) ? fc_success : function () {};
            fc_error = angular.isFunction(fc_error) ? fc_error : function () {};

            return (id === null ?
                this._all(params, fc_success, fc_error) :
                this._get(id, params, fc_success, fc_error)
            );
        }

        public _get(id: String, params, fc_success, fc_error): IResource {
            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.path ? this.path : this.type);
            path.addPath(id);
            params.include ? path.setInclude(params.include) : null;

            //let resource = new Resource();
            let resource = this.clone();
            resource.new();

            let promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(
                success => {
                    let value = success.data.data;
                    resource.attributes = value.attributes;
                    resource.id = value.id;

                    // instancio los include y los guardo en included arrary
                    let included = [];
                    angular.forEach(success.data.included, (data: Jsonapi.IDataResource) => {
                        let resource = Jsonapi.ResourceMaker.make(data);
                        if (resource) {
                            // guardamos en el array de includes
                            if (!(data.type in included)) {
                                included[data.type] = [];
                            }
                            included[data.type][data.id] = resource;
                        }
                    });

                    // recorro los relationships types
                    angular.forEach(value.relationships, (relation_value, relation_key) => {
                        let resource_service = Jsonapi.ResourceMaker.getService(relation_key);
                        if (resource_service) {
                            // recorro los resources del relation type
                            let relationship_resources = [];
                            angular.forEach(relation_value.data, (resource_value: Jsonapi.IDataResource) => {
                                // está en el included?
                                let tmp_resource;
                                if (resource_value.type in included && resource_value.id in included[resource_value.type]) {
                                    tmp_resource = included[resource_value.type][resource_value.id];
                                } else {
                                    tmp_resource = Jsonapi.ResourceMaker.procreate(resource_service, resource_value);
                                }
                                resource.relationships[relation_key].data[tmp_resource.id] = tmp_resource;
                            });
                        }
                    });

                    fc_success(resource);
                },
                error => {
                    fc_error(error);
                }
            );

            return resource;
        }

        public _all(params, fc_success, fc_error): Array<IResource> {

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.path ? this.path : this.type);
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
                    fc_success(response);
                },
                error => {
                    fc_error(error);
                }
            );
            return response;
        }
    }
}
