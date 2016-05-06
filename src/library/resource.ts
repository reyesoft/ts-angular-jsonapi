module Jsonapi {
    export class Resource implements IResource {
        public schema: ISchema;
        protected path: string = null;   // without slashes

        public type: string;
        public id: string;
        public attributes: any ;
        public relationships: any = [];

        private params_base: Jsonapi.IParams = {
            id: '',
            include: []
        };

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

        public getPath() {
            return this.path ? this.path : this.type;
        }

        // empty self object
        public new(): IResource {
            let resource = this.clone();
            resource.reset();
            return resource;
        }

        public reset(): void {
            let xthis = this;
            this.id = '';
            this.attributes = {};
            this.relationships = {};
            angular.forEach(this.schema.relationships, (value, key) => {
                xthis.relationships[key] = {};
                xthis.relationships[key]['data'] = {};
            });
        }

        public toObject(params: Jsonapi.IParams): Jsonapi.IDataObject {
            return {
                data: {
                    type: this.type,
                    id: this.id,
                    attributes: this.attributes,
                    relationships: this.relationships
                },
                include: {

                }
            };
            //return object;
        }

        public get(id: String, params?, fc_success?, fc_error?): IResource {
            return this.exec(id, params, fc_success, fc_error, 'get');
        }

        public all(params?, fc_success?, fc_error?): Array<IResource> {
            return this.exec(null, params, fc_success, fc_error, 'all');
        }

        public save(params?, fc_success?, fc_error?): Array<IResource> {
            return this.exec(null, params, fc_success, fc_error, 'save');
        }

        public exec(id: String, params: Jsonapi.IParams, fc_success, fc_error, exec_type: string): any {
            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
                params = this.params_base;
            } else {
                if (angular.isUndefined(params)) {
                    params = this.params_base;
                } else {
                    params = angular.extend({}, this.params_base, params);
                }
            }

            fc_success = angular.isFunction(fc_success) ? fc_success : function () {};
            fc_error = angular.isFunction(fc_error) ? fc_error : function () {};

            switch (exec_type) {
                case 'get':
                return this._get(id, params, fc_success, fc_error);
                case 'all':
                return this._all(params, fc_success, fc_error);
                case 'save':
                return this._save(params, fc_success, fc_error);
            }

            return false;
        }

        public _save(params?, fc_success?, fc_error?): IResource {
            let object = this.toObject(params);

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            this.id && path.addPath(this.id);
            params.include ? path.setInclude(params.include) : null;

            //let resource = new Resource();
            let resource = this.new();

            let promise = Jsonapi.Core.Services.JsonapiHttp.exec(path.get(), this.id ? 'PATCH' : 'POST', object);

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
                    fc_error(success);
                },
                error => {
                    fc_error(error);
                }
            );

                return resource;
            }

            public _get(id: String, params, fc_success, fc_error): IResource {
                // http request
                let path = new Jsonapi.PathMaker();
                path.addPath(this.getPath());
                path.addPath(id);
                params.include ? path.setInclude(params.include) : null;

                //let resource = new Resource();
                let resource = this.new();

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

                        // recorro los relationships levanto el service correspondiente
                        angular.forEach(value.relationships, (relation_value, relation_key) => {

                            // relation is in schema?
                            if (!(relation_key in resource.relationships)) {
                                console.warn(resource.type + '.relationships.' + relation_key + ' received, but is not defined on schema');
                                resource.relationships[relation_key] = { data: [] };
                            }

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

                        fc_success(success);
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
                path.addPath(this.getPath());
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
                        fc_success(success);
                    },
                    error => {
                        fc_error(error);
                    }
                );
                return response;
            }
        }
    }
