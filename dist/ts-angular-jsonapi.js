/// <reference path="./_all.ts" />
(function (angular) {
    // Config
    angular.module('Jsonapi.config', [])
        .constant('rsJsonapiConfig', {
        url: 'http://yourdomain/api/v1/'
    });
    angular.module('Jsonapi.services', []);
    angular.module('rsJsonapi', [
        'angular-storage',
        'Jsonapi.config',
        'Jsonapi.services'
    ]);
})(angular);

var Jsonapi;
(function (Jsonapi) {
    var Http = (function () {
        /** @ngInject */
        Http.$inject = ["$http", "rsJsonapiConfig", "$q"];
        function Http($http, rsJsonapiConfig, $q) {
            this.$http = $http;
            this.rsJsonapiConfig = rsJsonapiConfig;
            this.$q = $q;
        }
        Http.prototype.delete = function (path) {
            return this.exec(path, 'DELETE');
        };
        Http.prototype.get = function (path) {
            return this.exec(path, 'GET');
        };
        Http.prototype.exec = function (path, method, data) {
            var req = {
                method: method,
                url: this.rsJsonapiConfig.url + path,
                headers: {
                    'Content-Type': 'application/vnd.api+json'
                }
            };
            data && (req['data'] = data);
            var promise = this.$http(req);
            var deferred = this.$q.defer();
            var xthis = this;
            Jsonapi.Core.Me.refreshLoadings(1);
            promise.then(function (success) {
                Jsonapi.Core.Me.refreshLoadings(-1);
                deferred.resolve(success);
            }, function (error) {
                Jsonapi.Core.Me.refreshLoadings(-1);
                deferred.reject(error);
            });
            return deferred.promise;
        };
        return Http;
    }());
    Jsonapi.Http = Http;
    angular.module('Jsonapi.services').service('JsonapiHttp', Http);
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var PathMaker = (function () {
        function PathMaker() {
            this.paths = [];
            this.includes = [];
        }
        PathMaker.prototype.addPath = function (value) {
            this.paths.push(value);
        };
        PathMaker.prototype.setInclude = function (strings_array) {
            this.includes = strings_array;
        };
        PathMaker.prototype.get = function () {
            var get_params = [];
            if (this.includes.length > 0) {
                get_params.push('include=' + this.includes.join(','));
            }
            return this.paths.join('/') +
                (get_params.length > 0 ? '/?' + get_params.join('&') : '');
        };
        return PathMaker;
    }());
    Jsonapi.PathMaker = PathMaker;
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var Converter = (function () {
        function Converter() {
        }
        /**
        Convert json arrays (like included) to an Resources arrays without [keys]
        **/
        Converter.json_array2resources_array = function (json_array, destination_array, // Array<Jsonapi.IResource>,
            use_id_for_key) {
            if (use_id_for_key === void 0) { use_id_for_key = false; }
            if (!destination_array) {
                destination_array = [];
            }
            var count = 0;
            for (var _i = 0, json_array_1 = json_array; _i < json_array_1.length; _i++) {
                var data = json_array_1[_i];
                var resource = Jsonapi.Converter.json2resource(data, false);
                if (use_id_for_key) {
                    destination_array[resource.id] = resource;
                }
                else {
                    // included for example need a extra parameter
                    destination_array[resource.type + '_' + resource.id] = resource;
                }
                count++;
            }
            // destination_array['$count'] = count; // problem with toArray or angular.forEach need a !isObject
            return destination_array;
        };
        /**
        Convert json arrays (like included) to an indexed Resources array by [type][id]
        **/
        Converter.json_array2resources_array_by_type = function (json_array, instance_relationships) {
            var all_resources = {};
            Converter.json_array2resources_array(json_array, all_resources, false);
            var resources = {};
            angular.forEach(all_resources, function (resource) {
                if (!(resource.type in resources)) {
                    resources[resource.type] = {};
                }
                resources[resource.type][resource.id] = resource;
            });
            return resources;
        };
        Converter.json2resource = function (json_resource, instance_relationships) {
            var resource_service = Jsonapi.Converter.getService(json_resource.type);
            if (resource_service) {
                return Jsonapi.Converter.procreate(resource_service, json_resource);
            }
            else {
                // service not registered
                console.warn('`' + json_resource.type + '`', 'service not found on json2resource()');
                var temp = new Jsonapi.Resource();
                temp.id = json_resource.id;
                temp.type = json_resource.type;
                return temp;
            }
        };
        Converter.getService = function (type) {
            var resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('`' + type + '`', 'service not found on getService()');
            }
            return resource_service;
        };
        /* return a resource type(resoruce_service) with data(data) */
        Converter.procreate = function (resource_service, data) {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            var resource = new resource_service.constructor();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes ? data.attributes : {};
            resource.is_new = false;
            return resource;
        };
        // static build(document_from: IDataObject | IDataCollection, resource_dest: IResource, schema: ISchema) {
        Converter.build = function (document_from, resource_dest, schema) {
            // instancio los include y los guardo en included arrary
            var included = {};
            if ('included' in document_from) {
                included = Converter.json_array2resources_array_by_type(document_from.included, false);
            }
            if (angular.isArray(document_from.data)) {
                Converter._buildResources(document_from, resource_dest, schema, included);
            }
            else {
                Converter._buildResource(document_from.data, resource_dest, schema, included);
            }
        };
        Converter._buildResources = function (document_from, resource_dest, schema, included) {
            for (var _i = 0, _a = document_from.data; _i < _a.length; _i++) {
                var data = _a[_i];
                var resource = Jsonapi.Converter.getService(data.type);
                resource_dest[data.id] = new resource.constructor();
                Converter._buildResource(data, resource_dest[data.id], schema, included);
            }
        };
        Converter._buildResource = function (document_from, resource_dest, schema, included) {
            resource_dest.attributes = document_from.attributes;
            resource_dest.id = document_from.id;
            resource_dest.is_new = false;
            Converter.__buildRelationships(document_from.relationships, resource_dest.relationships, included, schema);
        };
        Converter.__buildRelationships = function (relationships_from, relationships_dest, included_array, schema) {
            // recorro los relationships levanto el service correspondiente
            angular.forEach(relationships_from, function (relation_value, relation_key) {
                // relation is in schema? have data or just links?
                if (!(relation_key in relationships_dest) && ('data' in relation_value)) {
                    relationships_dest[relation_key] = { data: [] };
                }
                // sometime data=null or simple { }
                if (!relation_value.data)
                    return;
                if (schema.relationships[relation_key] && schema.relationships[relation_key].hasMany) {
                    if (relation_value.data.length < 1)
                        return;
                    var resource_service = Jsonapi.Converter.getService(relation_value.data[0].type);
                    if (resource_service) {
                        relationships_dest[relation_key].data = {}; // force to object (not array)
                        angular.forEach(relation_value.data, function (relation_value) {
                            var tmp = Converter.__buildRelationship(relation_value, included_array);
                            relationships_dest[relation_key].data[tmp.id] = tmp;
                        });
                    }
                }
                else {
                    relationships_dest[relation_key].data = Converter.__buildRelationship(relation_value.data, included_array);
                }
            });
        };
        Converter.__buildRelationship = function (relation, included_array) {
            if (relation.type in included_array &&
                relation.id in included_array[relation.type]) {
                // it's in included
                return included_array[relation.type][relation.id];
            }
            else {
                // resource not included, return directly the object
                return relation;
            }
        };
        return Converter;
    }());
    Jsonapi.Converter = Converter;
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var Core = (function () {
        /** @ngInject */
        Core.$inject = ["rsJsonapiConfig", "JsonapiCoreServices"];
        function Core(rsJsonapiConfig, JsonapiCoreServices) {
            this.rsJsonapiConfig = rsJsonapiConfig;
            this.JsonapiCoreServices = JsonapiCoreServices;
            this.rootPath = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
            this.resources = [];
            this.loadingsCounter = 0;
            this.loadingsStart = function () { };
            this.loadingsDone = function () { };
            Jsonapi.Core.Me = this;
            Jsonapi.Core.Services = JsonapiCoreServices;
        }
        Core.prototype._register = function (clase) {
            if (clase.type in this.resources) {
                return false;
            }
            this.resources[clase.type] = clase;
            return true;
        };
        Core.prototype.getResource = function (type) {
            return this.resources[type];
        };
        Core.prototype.refreshLoadings = function (factor) {
            this.loadingsCounter += factor;
            if (this.loadingsCounter === 0) {
                this.loadingsDone();
            }
            else if (this.loadingsCounter === 1) {
                this.loadingsStart();
            }
        };
        Core.Me = null;
        Core.Services = null;
        return Core;
    }());
    Jsonapi.Core = Core;
    angular.module('Jsonapi.services').service('JsonapiCore', Core);
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var Resource = (function () {
        function Resource() {
            this.path = null; // without slashes
            this.params_base = {
                id: '',
                include: []
            };
            this.schema_base = {
                attributes: {},
                relationships: {}
            };
            this.is_new = true;
            this.relationships = [];
        }
        Resource.prototype.clone = function () {
            var cloneObj = new this.constructor();
            for (var attribut in this) {
                if (typeof this[attribut] !== 'object') {
                    cloneObj[attribut] = this[attribut];
                }
            }
            return cloneObj;
        };
        /**
        Register schema on Jsonapi.Core
        @return true if the resource don't exist and registered ok
        **/
        Resource.prototype.register = function () {
            if (Jsonapi.Core.Me === null) {
                throw 'Error: you are trying register --> ' + this.type + ' <-- before inject JsonapiCore somewhere, almost one time.';
            }
            return Jsonapi.Core.Me._register(this);
        };
        Resource.prototype.getPath = function () {
            return this.path ? this.path : this.type;
        };
        // empty self object
        Resource.prototype.new = function () {
            var resource = this.clone();
            resource.reset();
            return resource;
        };
        Resource.prototype.reset = function () {
            var xthis = this;
            this.id = '';
            this.attributes = {};
            this.relationships = {};
            angular.forEach(this.schema.relationships, function (value, key) {
                xthis.relationships[key] = {};
                xthis.relationships[key]['data'] = {};
            });
            this.is_new = true;
        };
        Resource.prototype.toObject = function (params) {
            var _this = this;
            params = angular.extend({}, this.params_base, params);
            this.schema = angular.extend({}, this.schema_base, this.schema);
            var relationships = {};
            var included = [];
            var included_ids = []; //just for control don't repeat any resource
            // agrego cada relationship
            angular.forEach(this.relationships, function (relationship, relation_alias) {
                if (_this.schema.relationships[relation_alias] && _this.schema.relationships[relation_alias].hasMany) {
                    relationships[relation_alias] = { data: [] };
                    angular.forEach(relationship.data, function (resource) {
                        var reational_object = { id: resource.id, type: resource.type };
                        relationships[relation_alias]['data'].push(reational_object);
                        // no se agregó aún a included && se ha pedido incluir con el parms.include
                        var temporal_id = resource.type + '_' + resource.id;
                        if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relation_alias) !== -1) {
                            included_ids.push(temporal_id);
                            included.push(resource.toObject({}).data);
                        }
                    });
                }
                else {
                    if (!('id' in relationship.data)) {
                        console.warn(relation_alias + ' defined with hasMany:false, but I have a collection');
                    }
                    relationships[relation_alias] = { data: { id: relationship.data.id, type: relationship.data.type } };
                    // no se agregó aún a included && se ha pedido incluir con el parms.include
                    var temporal_id = relationship.data.type + '_' + relationship.data.id;
                    if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relationship.data.type) !== -1) {
                        included_ids.push(temporal_id);
                        included.push(relationship.data.toObject({}).data);
                    }
                }
            });
            var ret = {
                data: {
                    type: this.type,
                    id: this.id,
                    attributes: this.attributes,
                    relationships: relationships
                }
            };
            if (included.length > 0) {
                ret.included = included;
            }
            return ret;
        };
        Resource.prototype.get = function (id, params, fc_success, fc_error) {
            return this.__exec(id, params, fc_success, fc_error, 'get');
        };
        Resource.prototype.delete = function (id, params, fc_success, fc_error) {
            this.__exec(id, params, fc_success, fc_error, 'delete');
        };
        Resource.prototype.all = function (params, fc_success, fc_error) {
            return this.__exec(null, params, fc_success, fc_error, 'all');
        };
        Resource.prototype.save = function (params, fc_success, fc_error) {
            return this.__exec(null, params, fc_success, fc_error, 'save');
        };
        /**
        This method sort params for new(), get() and update()
        */
        Resource.prototype.__exec = function (id, params, fc_success, fc_error, exec_type) {
            // makes `params` optional
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = params;
                params = this.params_base;
            }
            else {
                if (angular.isUndefined(params)) {
                    params = this.params_base;
                }
                else {
                    params = angular.extend({}, this.params_base, params);
                }
            }
            fc_success = angular.isFunction(fc_success) ? fc_success : function () { };
            fc_error = angular.isFunction(fc_error) ? fc_error : function () { };
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
        };
        Resource.prototype._get = function (id, params, fc_success, fc_error) {
            var _this = this;
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            path.addPath(id);
            params.include ? path.setInclude(params.include) : null;
            var resource = this.new();
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
                Jsonapi.Converter.build(success.data, resource, _this.schema);
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
            return resource;
        };
        Resource.prototype._all = function (params, fc_success, fc_error) {
            var _this = this;
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            params.include ? path.setInclude(params.include) : null;
            // make request
            var resource = {}; // if you use [], key like id is not possible
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
                Jsonapi.Converter.build(success.data, resource, _this.schema);
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
            return resource;
        };
        Resource.prototype._delete = function (id, params, fc_success, fc_error) {
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            path.addPath(id);
            Jsonapi.Core.Services.JsonapiHttp
                .delete(path.get())
                .then(function (success) {
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
        };
        Resource.prototype._save = function (params, fc_success, fc_error) {
            var object = this.toObject(params);
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            this.id && path.addPath(this.id);
            params.include ? path.setInclude(params.include) : null;
            var resource = this.new();
            var promise = Jsonapi.Core.Services.JsonapiHttp.exec(path.get(), this.id ? 'PUT' : 'POST', object);
            promise.then(function (success) {
                var value = success.data.data;
                resource.attributes = value.attributes;
                resource.id = value.id;
                fc_success(success);
            }, function (error) {
                fc_error('data' in error ? error.data : error);
            });
            return resource;
        };
        Resource.prototype.addRelationship = function (resource, type_alias) {
            type_alias = (type_alias ? type_alias : resource.type);
            if (!(type_alias in this.relationships)) {
                this.relationships[type_alias] = { data: {} };
            }
            var object_key = resource.id;
            if (!object_key) {
                object_key = 'new_' + (Math.floor(Math.random() * 100000));
            }
            this.relationships[type_alias]['data'][object_key] = resource;
        };
        /**
        @return This resource like a service
        **/
        Resource.prototype.getService = function () {
            return Jsonapi.Converter.getService(this.type);
        };
        return Resource;
    }());
    Jsonapi.Resource = Resource;
})(Jsonapi || (Jsonapi = {}));

/// <reference path="../../typings/main.d.ts" />
// Jsonapi interfaces part of top level
/// <reference path="./interfaces/document.d.ts"/>
/// <reference path="./interfaces/data-collection.d.ts"/>
/// <reference path="./interfaces/data-object.d.ts"/>
/// <reference path="./interfaces/data-resource.d.ts"/>
/// <reference path="./interfaces/params.d.ts"/>
/// <reference path="./interfaces/errors.d.ts"/>
/// <reference path="./interfaces/links.d.ts"/>
// Parameters for TS-Jsonapi Classes
/// <reference path="./interfaces/schema.d.ts"/>
// TS-Jsonapi Classes Interfaces
/// <reference path="./interfaces/core.d.ts"/>
/// <reference path="./interfaces/resource.d.ts"/>
// TS-Jsonapi classes
/// <reference path="./app.module.ts"/>
/// <reference path="./services/http.service.ts"/>
/// <reference path="./services/path-maker.ts"/>
/// <reference path="./services/resource-converter.ts"/>
//// <reference path="./services/core-services.service.ts"/>
/// <reference path="./core.ts"/>
/// <reference path="./resource.ts"/>

var Jsonapi;
(function (Jsonapi) {
    var CoreServices = (function () {
        /** @ngInject */
        CoreServices.$inject = ["JsonapiHttp"];
        function CoreServices(JsonapiHttp) {
            this.JsonapiHttp = JsonapiHttp;
        }
        return CoreServices;
    }());
    Jsonapi.CoreServices = CoreServices;
    angular.module('Jsonapi.services').service('JsonapiCoreServices', CoreServices);
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var JsonapiParser = (function () {
        /** @ngInject */
        function JsonapiParser() {
        }
        JsonapiParser.prototype.toObject = function (json_string) {
            return json_string;
        };
        return JsonapiParser;
    }());
    Jsonapi.JsonapiParser = JsonapiParser;
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var JsonapiStorage = (function () {
        /** @ngInject */
        function JsonapiStorage() {
        }
        JsonapiStorage.prototype.get = function (key) {
            /* let data = this.store.get(key);
            return angular.fromJson(data);*/
        };
        JsonapiStorage.prototype.merge = function (key, data) {
            /* let actual_data = this.get(key);
            let actual_info = angular.fromJson(actual_data); */
        };
        return JsonapiStorage;
    }());
    Jsonapi.JsonapiStorage = JsonapiStorage;
})(Jsonapi || (Jsonapi = {}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLmpzIiwic2VydmljZXMvcGF0aC1tYWtlci50cyIsInNlcnZpY2VzL3BhdGgtbWFrZXIuanMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIuanMiLCJjb3JlLnRzIiwiY29yZS5qcyIsInJlc291cmNlLnRzIiwicmVzb3VyY2UuanMiLCJfYWxsLnRzIiwiX2FsbC5qcyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50cyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS5qcyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXBhcnNlci5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1zdG9yYWdlLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUVBLENBQUMsVUFBVSxTQUFPOztJQUVkLFFBQVEsT0FBTyxrQkFBa0I7U0FDaEMsU0FBUyxtQkFBbUI7UUFDekIsS0FBSzs7SUFHVCxRQUFRLE9BQU8sb0JBQW9CO0lBRW5DLFFBQVEsT0FBTyxhQUNmO1FBQ0k7UUFDQTtRQUNBOztHQUdMO0FDSkg7QUNkQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLFFBQUEsWUFBQTs7O1FBR0ksU0FBQSxLQUNjLE9BQ0EsaUJBQ0EsSUFBRTtZQUZGLEtBQUEsUUFBQTtZQUNBLEtBQUEsa0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLFNBQVAsVUFBYyxNQUFZO1lBQ3RCLE9BQU8sS0FBSyxLQUFLLE1BQU07O1FBR3BCLEtBQUEsVUFBQSxNQUFQLFVBQVcs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VyxLQUFHOzs7O1FBS1AsZUFBQSxVQUFBLFFBQVAsVUFBYSxLQUFLLE1BQUk7Ozs7UUFNMUIsT0FBQTs7SUFyQmEsUUFBQSxpQkFBYztHQUR4QixZQUFBLFVBQU87QUNrQmQiLCJmaWxlIjoidHMtYW5ndWxhci1qc29uYXBpLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJ1xuICAgIH0pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJyxcbiAgICBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcblxufSkoYW5ndWxhcik7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgICAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLydcbiAgICB9KTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJywgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG59KShhbmd1bGFyKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSHR0cCB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJGh0dHAsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkICRxXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnREVMRVRFJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm90ZWN0ZWQgZXhlYyhwYXRoOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBkYXRhPzogSnNvbmFwaS5JRGF0YU9iamVjdCkge1xuICAgICAgICAgICAgbGV0IHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuXG4gICAgICAgICAgICBsZXQgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICBsZXQgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCByc0pzb25hcGlDb25maWcsICRxKSB7XG4gICAgICAgICAgICB0aGlzLiRodHRwID0gJGh0dHA7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJHEgPSAkcTtcbiAgICAgICAgfVxuICAgICAgICBIdHRwLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnREVMRVRFJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdHRVQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZXhlYyA9IGZ1bmN0aW9uIChwYXRoLCBtZXRob2QsIGRhdGEpIHtcbiAgICAgICAgICAgIHZhciByZXEgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB0aGlzLnJzSnNvbmFwaUNvbmZpZy51cmwgKyBwYXRoLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi92bmQuYXBpK2pzb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGRhdGEgJiYgKHJlcVsnZGF0YSddID0gZGF0YSk7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXMuJGh0dHAocmVxKTtcbiAgICAgICAgICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIHZhciB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKDEpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSHR0cDtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSHR0cCA9IEh0dHA7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpSHR0cCcsIEh0dHApO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFBhdGhNYWtlciB7XG4gICAgICAgIHB1YmxpYyBwYXRoczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuICAgICAgICBwdWJsaWMgaW5jbHVkZXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgYWRkUGF0aCh2YWx1ZTogU3RyaW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHNldEluY2x1ZGUoc3RyaW5nc19hcnJheTogQXJyYXk8U3RyaW5nPikge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KCk6IFN0cmluZyB7XG4gICAgICAgICAgICBsZXQgZ2V0X3BhcmFtczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICcvPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFBhdGhNYWtlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIFBhdGhNYWtlcigpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmFkZFBhdGggPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMucHVzaCh2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuc2V0SW5jbHVkZSA9IGZ1bmN0aW9uIChzdHJpbmdzX2FycmF5KSB7XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gc3RyaW5nc19hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZ2V0X3BhcmFtcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aHMuam9pbignLycpICtcbiAgICAgICAgICAgICAgICAoZ2V0X3BhcmFtcy5sZW5ndGggPiAwID8gJy8/JyArIGdldF9wYXJhbXMuam9pbignJicpIDogJycpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUGF0aE1ha2VyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5QYXRoTWFrZXIgPSBQYXRoTWFrZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29udmVydGVyIHtcblxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgc3RhdGljIGpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KFxuICAgICAgICAgICAganNvbl9hcnJheTogQXJyYXk8SnNvbmFwaS5JRGF0YVJlc291cmNlPixcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5PzogT2JqZWN0LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSA9IGZhbHNlXG4gICAgICAgICk6IE9iamVjdCB7IC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPiB7XG4gICAgICAgICAgICBpZiAoIWRlc3RpbmF0aW9uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXkgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBkYXRhIG9mIGpzb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uMnJlc291cmNlKGRhdGEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uX2FycmF5LnB1c2gocmVzb3VyY2UuaWQgKyByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uX2FycmF5WyckY291bnQnXSA9IGNvdW50OyAvLyBwcm9ibGVtIHdpdGggdG9BcnJheSBvciBhbmd1bGFyLmZvckVhY2ggbmVlZCBhICFpc09iamVjdFxuICAgICAgICAgICAgcmV0dXJuIGRlc3RpbmF0aW9uX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlIChcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IEFycmF5PEpzb25hcGkuSURhdGFSZXNvdXJjZT4sXG4gICAgICAgICAgICBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzOiBib29sZWFuXG4gICAgICAgICk6IE9iamVjdCB7IC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPiB7XG4gICAgICAgICAgICBsZXQgYWxsX3Jlc291cmNlczphbnkgPSB7IH0gO1xuICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KGpzb25fYXJyYXksIGFsbF9yZXNvdXJjZXMsIGZhbHNlKTtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZXMgPSB7IH07XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goYWxsX3Jlc291cmNlcywgKHJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCEocmVzb3VyY2UudHlwZSBpbiByZXNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXSA9IHsgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGpzb24ycmVzb3VyY2UoanNvbl9yZXNvdXJjZTogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGpzb25fcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwganNvbl9yZXNvdXJjZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgbGV0IHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBnZXRTZXJ2aWNlKHR5cGU6IHN0cmluZyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsgdHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGdldFNlcnZpY2UoKScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvKiByZXR1cm4gYSByZXNvdXJjZSB0eXBlKHJlc29ydWNlX3NlcnZpY2UpIHdpdGggZGF0YShkYXRhKSAqL1xuICAgICAgICBzdGF0aWMgcHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2U6IEpzb25hcGkuSVJlc291cmNlLCBkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gbmV3ICg8YW55PnJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXMgPyBkYXRhLmF0dHJpYnV0ZXMgOiB7fTtcbiAgICAgICAgICAgIHJlc291cmNlLmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cblxuXG4gICAgICAgIC8vIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBJRGF0YU9iamVjdCB8IElEYXRhQ29sbGVjdGlvbiwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgc3RhdGljIGJ1aWxkKGRvY3VtZW50X2Zyb206IGFueSwgcmVzb3VyY2VfZGVzdDogYW55LCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWQgPSB7fTtcbiAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIGRvY3VtZW50X2Zyb20pIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlZCA9IENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKGRvY3VtZW50X2Zyb20uaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNBcnJheShkb2N1bWVudF9mcm9tLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlKGRvY3VtZW50X2Zyb20uZGF0YSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2VzKGRvY3VtZW50X2Zyb206IElEYXRhQ29sbGVjdGlvbiwgcmVzb3VyY2VfZGVzdDogQXJyYXk8SURhdGFDb2xsZWN0aW9uPiwgc2NoZW1hOiBJU2NoZW1hLCBpbmNsdWRlZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBkb2N1bWVudF9mcm9tLmRhdGEpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGRhdGEudHlwZSk7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyAoPGFueT5yZXNvdXJjZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbTogSURhdGFSZXNvdXJjZSwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9fYnVpbGRSZWxhdGlvbnNoaXBzKHJlbGF0aW9uc2hpcHNfZnJvbTogQXJyYXk8YW55PiwgcmVsYXRpb25zaGlwc19kZXN0OiBBcnJheTxhbnk+LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbl92YWx1ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gJiYgc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA8IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgKHJlbGF0aW9uX3ZhbHVlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhW3RtcC5pZF0gPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbjogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbmNsdWRlZF9hcnJheSk6IEpzb25hcGkuSVJlc291cmNlIHwgSnNvbmFwaS5JRGF0YVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1cbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyByZXNvdXJjZSBub3QgaW5jbHVkZWQsIHJldHVybiBkaXJlY3RseSB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG5cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBqc29uX2FycmF5XzEgPSBqc29uX2FycmF5OyBfaSA8IGpzb25fYXJyYXlfMS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IGpzb25fYXJyYXlfMVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIHZhciBhbGxfcmVzb3VyY2VzID0ge307XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuanNvbjJyZXNvdXJjZSA9IGZ1bmN0aW9uIChqc29uX3Jlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgdmFyIHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfTtcbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgQ29udmVydGVyLnByb2NyZWF0ZSA9IGZ1bmN0aW9uIChyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gbmV3IHJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIC8vIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBJRGF0YU9iamVjdCB8IElEYXRhQ29sbGVjdGlvbiwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgQ29udmVydGVyLmJ1aWxkID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSkge1xuICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgaWYgKCdpbmNsdWRlZCcgaW4gZG9jdW1lbnRfZnJvbSkge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoZG9jdW1lbnRfZnJvbS5pbmNsdWRlZCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNBcnJheShkb2N1bWVudF9mcm9tLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2VzID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBkb2N1bWVudF9mcm9tLmRhdGE7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfYVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0gPSBuZXcgcmVzb3VyY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZSA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAocmVsYXRpb25zaGlwc19mcm9tLCByZWxhdGlvbnNoaXBzX2Rlc3QsIGluY2x1ZGVkX2FycmF5LCBzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcHNfZnJvbSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpIHtcbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBzb21ldGltZSBkYXRhPW51bGwgb3Igc2ltcGxlIHsgfVxuICAgICAgICAgICAgICAgIGlmICghcmVsYXRpb25fdmFsdWUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmIChzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldICYmIHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YS5sZW5ndGggPCAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YVt0bXAuaWRdID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHJlbGF0aW9uLCBpbmNsdWRlZF9hcnJheSkge1xuICAgICAgICAgICAgaWYgKHJlbGF0aW9uLnR5cGUgaW4gaW5jbHVkZWRfYXJyYXkgJiZcbiAgICAgICAgICAgICAgICByZWxhdGlvbi5pZCBpbiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXSkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzb3VyY2Ugbm90IGluY2x1ZGVkLCByZXR1cm4gZGlyZWN0bHkgdGhlIG9iamVjdFxuICAgICAgICAgICAgICAgIHJldHVybiByZWxhdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIENvbnZlcnRlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29udmVydGVyID0gQ29udmVydGVyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmUgaW1wbGVtZW50cyBKc29uYXBpLklDb3JlIHtcbiAgICAgICAgcHVibGljIHJvb3RQYXRoOiBzdHJpbmcgPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgcHVibGljIHJlc291cmNlczogQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+ID0gW107XG5cbiAgICAgICAgcHVibGljIGxvYWRpbmdzQ291bnRlcjogbnVtYmVyID0gMDtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzU3RhcnQgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzRG9uZSA9ICgpID0+IHt9O1xuXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgTWU6IEpzb25hcGkuSUNvcmUgPSBudWxsO1xuICAgICAgICBwdWJsaWMgc3RhdGljIFNlcnZpY2VzOiBhbnkgPSBudWxsO1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIHJzSnNvbmFwaUNvbmZpZyxcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpQ29yZVNlcnZpY2VzXG4gICAgICAgICkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3JlZ2lzdGVyKGNsYXNlKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZXNvdXJjZSh0eXBlOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZWZyZXNoTG9hZGluZ3MoZmFjdG9yOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29yZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZShyc0pzb25hcGlDb25maWcsIEpzb25hcGlDb3JlU2VydmljZXMpIHtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpQ29yZVNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgICAgIHRoaXMucm9vdFBhdGggPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciA9IDA7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG4gICAgICAgIENvcmUucHJvdG90eXBlLl9yZWdpc3RlciA9IGZ1bmN0aW9uIChjbGFzZSkge1xuICAgICAgICAgICAgaWYgKGNsYXNlLnR5cGUgaW4gdGhpcy5yZXNvdXJjZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIENvcmUucHJvdG90eXBlLmdldFJlc291cmNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUucmVmcmVzaExvYWRpbmdzID0gZnVuY3Rpb24gKGZhY3Rvcikge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvcmUuTWUgPSBudWxsO1xuICAgICAgICBDb3JlLlNlcnZpY2VzID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIENvcmU7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmUgPSBDb3JlO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmUnLCBDb3JlKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBSZXNvdXJjZSBpbXBsZW1lbnRzIElSZXNvdXJjZSB7XG4gICAgICAgIHB1YmxpYyBzY2hlbWE6IElTY2hlbWE7XG4gICAgICAgIHByb3RlY3RlZCBwYXRoOiBzdHJpbmcgPSBudWxsOyAgIC8vIHdpdGhvdXQgc2xhc2hlc1xuICAgICAgICBwcml2YXRlIHBhcmFtc19iYXNlOiBKc29uYXBpLklQYXJhbXMgPSB7XG4gICAgICAgICAgICBpZDogJycsXG4gICAgICAgICAgICBpbmNsdWRlOiBbXVxuICAgICAgICB9O1xuICAgICAgICBwcml2YXRlIHNjaGVtYV9iYXNlID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgICB9O1xuXG4gICAgICAgIHB1YmxpYyBpc19uZXcgPSB0cnVlO1xuICAgICAgICBwdWJsaWMgdHlwZTogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgaWQ6IHN0cmluZztcbiAgICAgICAgcHVibGljIGF0dHJpYnV0ZXM6IGFueSA7XG4gICAgICAgIHB1YmxpYyByZWxhdGlvbnNoaXBzOiBhbnkgPSBbXTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIHB1YmxpYyByZWdpc3RlcigpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmIChKc29uYXBpLkNvcmUuTWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnRXJyb3I6IHlvdSBhcmUgdHJ5aW5nIHJlZ2lzdGVyIC0tPiAnICsgdGhpcy50eXBlICsgJyA8LS0gYmVmb3JlIGluamVjdCBKc29uYXBpQ29yZSBzb21ld2hlcmUsIGFsbW9zdCBvbmUgdGltZS4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29yZS5NZS5fcmVnaXN0ZXIodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0UGF0aCgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBzZWxmIG9iamVjdFxuICAgICAgICBwdWJsaWMgbmV3KCk6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICAgICAgbGV0IHh0aGlzID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMuaWQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICB4dGhpcy5yZWxhdGlvbnNoaXBzW2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICB4dGhpcy5yZWxhdGlvbnNoaXBzW2tleV1bJ2RhdGEnXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmlzX25ldyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QocGFyYW1zOiBKc29uYXBpLklQYXJhbXMpOiBKc29uYXBpLklEYXRhT2JqZWN0IHtcbiAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCB0aGlzLnBhcmFtc19iYXNlLCBwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgdGhpcy5zY2hlbWFfYmFzZSwgdGhpcy5zY2hlbWEpO1xuXG4gICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwcyA9IHsgfTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IFsgXTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZF9pZHMgPSBbIF07IC8vanVzdCBmb3IgY29udHJvbCBkb24ndCByZXBlYXQgYW55IHJlc291cmNlXG5cbiAgICAgICAgICAgIC8vIGFncmVnbyBjYWRhIHJlbGF0aW9uc2hpcFxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSAmJiB0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXAuZGF0YSwgKHJlc291cmNlOiBKc29uYXBpLklSZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRlbXBvcmFsX2lkID0gcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbl9hbGlhcykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVzb3VyY2UudG9PYmplY3QoeyB9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoJ2lkJyBpbiByZWxhdGlvbnNoaXAuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZWxhdGlvbl9hbGlhcyArICcgZGVmaW5lZCB3aXRoIGhhc01hbnk6ZmFsc2UsIGJ1dCBJIGhhdmUgYSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyBpZDogcmVsYXRpb25zaGlwLmRhdGEuaWQsIHR5cGU6IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgfSB9O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wb3JhbF9pZCA9IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgKyAnXycgKyByZWxhdGlvbnNoaXAuZGF0YS5pZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbnNoaXAuZGF0YS50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVsYXRpb25zaGlwLmRhdGEudG9PYmplY3QoeyB9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsZXQgcmV0OiBJRGF0YU9iamVjdCA9IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChpbmNsdWRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0LmluY2x1ZGVkID0gaW5jbHVkZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGlkOiBTdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKGlkOiBTdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZGVsZXRlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWxsKHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxJUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnYWxsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2F2ZShwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogQXJyYXk8SVJlc291cmNlPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBwcml2YXRlIF9fZXhlYyhpZDogU3RyaW5nLCBwYXJhbXM6IEpzb25hcGkuSVBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZTogc3RyaW5nKTogYW55IHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtc19iYXNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIHRoaXMucGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7fTtcblxuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9nZXQoaWQ6IFN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG5cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIENvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogT2JqZWN0IHsgLy8gQXJyYXk8SVJlc291cmNlPiB7XG5cbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHt9OyAgLy8gaWYgeW91IHVzZSBbXSwga2V5IGxpa2UgaWQgaXMgbm90IHBvc3NpYmxlXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZGVsZXRlKGlkOiBTdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiB2b2lkIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5kZWxldGUocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfc2F2ZShwYXJhbXM6IElQYXJhbXMsIGZjX3N1Y2Nlc3M6IEZ1bmN0aW9uLCBmY19lcnJvcjogRnVuY3Rpb24pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG5cbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKCdkYXRhJyBpbiBlcnJvciA/IGVycm9yLmRhdGEgOiBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFkZFJlbGF0aW9uc2hpcChyZXNvdXJjZTogSnNvbmFwaS5JUmVzb3VyY2UsIHR5cGVfYWxpYXM/OiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YTogeyB9IH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBvYmplY3Rfa2V5ID0gcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICBpZiAoIW9iamVjdF9rZXkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rfa2V5ID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtvYmplY3Rfa2V5XSA9IHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgcHVibGljIGdldFNlcnZpY2UoKTogYW55IHtcbiAgICAgICAgICAgIHJldHVybiBDb252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG51bGw7IC8vIHdpdGhvdXQgc2xhc2hlc1xuICAgICAgICAgICAgdGhpcy5wYXJhbXNfYmFzZSA9IHtcbiAgICAgICAgICAgICAgICBpZDogJycsXG4gICAgICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnNjaGVtYV9iYXNlID0ge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChKc29uYXBpLkNvcmUuTWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnRXJyb3I6IHlvdSBhcmUgdHJ5aW5nIHJlZ2lzdGVyIC0tPiAnICsgdGhpcy50eXBlICsgJyA8LS0gYmVmb3JlIGluamVjdCBKc29uYXBpQ29yZSBzb21ld2hlcmUsIGFsbW9zdCBvbmUgdGltZS4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29yZS5NZS5fcmVnaXN0ZXIodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aCA/IHRoaXMucGF0aCA6IHRoaXMudHlwZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLm5ldyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLnJlc2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIHRoaXMucGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLnNjaGVtYSA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCB0aGlzLnNjaGVtYV9iYXNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgdmFyIGluY2x1ZGVkID0gW107XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWRfaWRzID0gW107IC8vanVzdCBmb3IgY29udHJvbCBkb24ndCByZXBlYXQgYW55IHJlc291cmNlXG4gICAgICAgICAgICAvLyBhZ3JlZ28gY2FkYSByZWxhdGlvbnNoaXBcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSB7XG4gICAgICAgICAgICAgICAgaWYgKF90aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSAmJiBfdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcG9yYWxfaWQgPSByZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uX2FsaWFzKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZXNvdXJjZS50b09iamVjdCh7fSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoJ2lkJyBpbiByZWxhdGlvbnNoaXAuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZWxhdGlvbl9hbGlhcyArICcgZGVmaW5lZCB3aXRoIGhhc01hbnk6ZmFsc2UsIGJ1dCBJIGhhdmUgYSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgaWQ6IHJlbGF0aW9uc2hpcC5kYXRhLmlkLCB0eXBlOiByZWxhdGlvbnNoaXAuZGF0YS50eXBlIH0gfTtcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXBvcmFsX2lkID0gcmVsYXRpb25zaGlwLmRhdGEudHlwZSArICdfJyArIHJlbGF0aW9uc2hpcC5kYXRhLmlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZWxhdGlvbnNoaXAuZGF0YS50b09iamVjdCh7fSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciByZXQgPSB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXQuaW5jbHVkZWQgPSBpbmNsdWRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2RlbGV0ZScpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnYWxsJyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnc2F2ZScpO1xuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgVGhpcyBtZXRob2Qgc29ydCBwYXJhbXMgZm9yIG5ldygpLCBnZXQoKSBhbmQgdXBkYXRlKClcbiAgICAgICAgKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9fZXhlYyA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgZXhlY190eXBlKSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCB0aGlzLnBhcmFtc19iYXNlLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfc3VjY2VzcykgPyBmY19zdWNjZXNzIDogZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBzd2l0Y2ggKGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2F2ZSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCBfdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgLy8gbWFrZSByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB7fTsgLy8gaWYgeW91IHVzZSBbXSwga2V5IGxpa2UgaWQgaXMgbm90IHBvc3NpYmxlXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCBfdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmRlbGV0ZShwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX3NhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hZGRSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAocmVzb3VyY2UsIHR5cGVfYWxpYXMpIHtcbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBvYmplY3Rfa2V5ID0gcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICBpZiAoIW9iamVjdF9rZXkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rfa2V5ID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUmVzb3VyY2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlJlc291cmNlID0gUmVzb3VyY2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9yZXNvdXJjZS5kLnRzXCIvPlxuXG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtY29udmVydGVyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuLy8gUGFyYW1ldGVycyBmb3IgVFMtSnNvbmFwaSBDbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3NjaGVtYS5kLnRzXCIvPlxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9yZXNvdXJjZS5kLnRzXCIvPlxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
