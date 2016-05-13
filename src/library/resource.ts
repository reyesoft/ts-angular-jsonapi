module Jsonapi {
    export class Resource implements IResource {
        public schema: ISchema;
        protected path: string = null;   // without slashes
        private params_base: Jsonapi.IParams = {
            id: '',
            include: []
        };

        public is_new = true;
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

        /**
        Register schema on Jsonapi.Core
        @return true if the resource don't exist and registered ok
        **/
        public register(): boolean {
            if (Jsonapi.Core.Me === null) {
                throw 'Error: you are trying register --> ' + this.type + ' <-- before inject JsonapiCore somewhere, almost one time.';
            }
            return Jsonapi.Core.Me._register(this);
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
            this.is_new = true;
        }

        public toObject(params: Jsonapi.IParams): Jsonapi.IDataObject {
            let relationships = { };
            angular.forEach(this.relationships, (relationship, relation_alias) => {
                relationships[relation_alias] = { data: [] };
                angular.forEach(relationship.data, (resource: Jsonapi.IResource) => {
                    let reational_object = { id: resource.id, type: resource.type };
                    relationships[relation_alias]['data'].push(reational_object);
                });
            });

            return {
                data: {
                    type: this.type,
                    id: this.id,
                    attributes: this.attributes,
                    relationships: relationships
                },
                include: {

                }
            };
            //return object;
        }

        public get(id: String, params?, fc_success?, fc_error?): IResource {
            return this.__exec(id, params, fc_success, fc_error, 'get');
        }

        public delete(id: String, params?, fc_success?, fc_error?): void {
            this.__exec(id, params, fc_success, fc_error, 'delete');
        }

        public all(params?, fc_success?, fc_error?): Array<IResource> {
            return this.__exec(null, params, fc_success, fc_error, 'all');
        }

        public save(params?, fc_success?, fc_error?): Array<IResource> {
            return this.__exec(null, params, fc_success, fc_error, 'save');
        }

        /**
        This method sort params for new(), get() and update()
        */
        private __exec(id: String, params: Jsonapi.IParams, fc_success, fc_error, exec_type: string): any {
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
                case 'delete':
                return this._get(id, params, fc_success, fc_error);
                case 'all':
                return this._all(params, fc_success, fc_error);
                case 'save':
                return this._save(params, fc_success, fc_error);
            }
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
                    resource.is_new = false;

                    // instancio los include y los guardo en included arrary
                    let included = {};
                    if ('included' in success.data) {
                        included = Converter.json_array2resources_array_by_type(success.data.included, false);
                    }

                    // recorro los relationships levanto el service correspondiente
                    angular.forEach(value.relationships, (relation_value, relation_key) => {

                        // relation is in schema? have data or just links?
                        if (!(relation_key in resource.relationships) && ('data' in relation_value)) {
                            console.warn(resource.type + '.relationships.' + relation_key + ' received, but is not defined on schema.');
                            resource.relationships[relation_key] = { data: [] };
                        }

                        // sometime data=null or simple { }
                        if (relation_value.data && relation_value.data.length > 0) {
                            // we use relation_value.data[0].type, becouse maybe is polymophic
                            let resource_service = Jsonapi.Converter.getService(relation_value.data[0].type);
                            if (resource_service) {
                                // recorro los resources del relation type
                                let relationship_resources = [];
                                angular.forEach(relation_value.data, (resource_value: Jsonapi.IDataResource) => {
                                    // está en el included?
                                    let tmp_resource;
                                    if (resource_value.type in included && resource_value.id in included[resource_value.type]) {
                                        tmp_resource = included[resource_value.type][resource_value.id];
                                    } else {
                                        tmp_resource = Jsonapi.Converter.procreate(resource_service, resource_value);
                                    }
                                    resource.relationships[relation_key].data[tmp_resource.id] = tmp_resource;
                                });
                            }
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

        public _delete(id: String, params, fc_success, fc_error): void {
            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            path.addPath(id);
            // params.include ? path.setInclude(params.include) : null;

            //let resource = new Resource();
            // let resource = this.new();

            let promise = Jsonapi.Core.Services.JsonapiHttp.delete(path.get());
            promise.then(
                success => {
                    fc_success(success);
                },
                error => {
                    fc_error(error);
                }
            );
        }

        public _all(params, fc_success, fc_error): Object { // Array<IResource> {

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            params.include ? path.setInclude(params.include) : null;

            // make request
            let response = {};  // if you use [], key like id is not possible
            let promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(
                success => {
                    Converter.json_array2resources_array(success.data.data, response, true);
                    fc_success(success);
                },
                error => {
                    fc_error(error);
                }
            );
            return response;
        }

        public _save(params?, fc_success?, fc_error?): IResource {
            let object = this.toObject(params);

            // http request
            let path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            this.id && path.addPath(this.id);
            params.include ? path.setInclude(params.include) : null;

            let resource = this.new();

            let promise = Jsonapi.Core.Services.JsonapiHttp.exec(path.get(), this.id ? 'PUT' : 'POST', object);

            promise.then(
                success => {
                    let value = success.data.data;
                    resource.attributes = value.attributes;
                    resource.id = value.id;

                    // instancio los include y los guardo en included arrary
                    // let included = Converter.json_array2resources_array_by_type(success.data.included, false);

                    fc_success(success);
                },
                error => {
                    fc_error('data' in error ? error.data : error);
                }
            );

            return resource;
        }

        public addRelationship(resource: Jsonapi.IResource, type_alias?: string) {
            type_alias = (type_alias ? type_alias : resource.type);
            if (!(type_alias in this.relationships)) {
                this.relationships[type_alias] = { data: { } };
            }

            let object_key = resource.id;
            if (!object_key) {
                object_key = 'new_' + (Math.floor(Math.random() * 100000));
            }

            this.relationships[type_alias]['data'][object_key] = resource;
        }

        /**
        @return This resource like a service
        **/
        public getService(): any {
            return Converter.getService(this.type);
        }
    }
}
