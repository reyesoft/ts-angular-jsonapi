/// <reference path="./_all.ts" />
(function (angular) {
    // Config
    angular.module('Jsonapi.config', [])
        .constant('rsJsonapiConfig', {
        url: 'http://yourdomain/api/v1/',
        delay: 0,
        unify_concurrency: true,
        cache_prerequests: true
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
    var Base = (function () {
        function Base() {
        }
        Base.Params = {
            id: '',
            include: []
        };
        Base.Schema = {
            attributes: {},
            relationships: {}
        };
        return Base;
    }());
    Jsonapi.Base = Base;
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var Http = (function () {
        /** @ngInject */
        Http.$inject = ["$http", "$timeout", "rsJsonapiConfig", "$q"];
        function Http($http, $timeout, rsJsonapiConfig, $q) {
            this.$http = $http;
            this.$timeout = $timeout;
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
            var self = this;
            Jsonapi.Core.Me.refreshLoadings(1);
            promise.then(function (success) {
                // timeout just for develop environment
                self.$timeout(function () {
                    Jsonapi.Core.Me.refreshLoadings(-1);
                    deferred.resolve(success);
                }, self.rsJsonapiConfig.delay);
            }, function (error) {
                Jsonapi.Core.Me.refreshLoadings(-1);
                console.warn('Jsonapi.Http.exec error =>', error);
                if (error.status <= 0) {
                    // offline?
                    Jsonapi.Core.Me.loadingsError();
                }
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
                (get_params.length > 0 ? '?' + get_params.join('&') : '');
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
                if (!(data.id in resource_dest)) {
                    resource_dest[data.id] = new resource.constructor();
                    resource_dest[data.id].reset();
                }
                Converter._buildResource(data, resource_dest[data.id], schema, included);
            }
        };
        Converter._buildResource = function (document_from, resource_dest, schema, included) {
            resource_dest.attributes = document_from.attributes ? document_from.attributes : {};
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
            this.loadingsError = function () { };
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
            this.is_new = true;
            this.relationships = {}; //[];
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
            // only when service is registered, not cloned object
            this.cache = {};
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
            var self = this;
            this.id = '';
            this.attributes = {};
            this.relationships = {};
            angular.forEach(this.schema.relationships, function (value, key) {
                self.relationships[key] = {};
                self.relationships[key]['data'] = {};
            });
            this.is_new = true;
        };
        Resource.prototype.toObject = function (params) {
            var _this = this;
            params = angular.extend({}, Jsonapi.Base.Params, params);
            this.schema = angular.extend({}, Jsonapi.Base.Schema, this.schema);
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
                params = Jsonapi.Base.Params;
            }
            else {
                if (angular.isUndefined(params)) {
                    params = Jsonapi.Base.Params;
                }
                else {
                    params = angular.extend({}, Jsonapi.Base.Params, params);
                }
            }
            fc_success = angular.isFunction(fc_success) ? fc_success : function () { };
            fc_error = angular.isFunction(fc_error) ? fc_error : function () { };
            this.schema = angular.extend({}, Jsonapi.Base.Schema, this.schema);
            switch (exec_type) {
                case 'get':
                    return this._get(id, params, fc_success, fc_error);
                case 'delete':
                    return this._delete(id, params, fc_success, fc_error);
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
            var resource = this.getService().cache ? this.getService().cache[id] : this.new();
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
                Jsonapi.Converter.build(success.data, resource, _this.schema);
                _this.fillCacheResource(resource);
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
            var resource = {};
            if (this.getService().cache) {
                // we don't make
                angular.forEach(this.getService().cache, function (value, key) {
                    resource[key] = value;
                });
            }
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
                Jsonapi.Converter.build(success.data, resource, _this.schema);
                _this.fillCache(resource);
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
        Resource.prototype.removeRelationship = function (type_alias, id) {
            if (!(type_alias in this.relationships)) {
                return false;
            }
            if (!('data' in this.relationships[type_alias])) {
                return false;
            }
            if (!(id in this.relationships[type_alias]['data'])) {
                return false;
            }
            delete this.relationships[type_alias]['data'][id];
            return true;
        };
        Resource.prototype.fillCache = function (resources) {
            if (resources.id) {
                this.fillCacheResource(resources);
            }
            else {
                this.fillCacheResources(resources);
            }
        };
        Resource.prototype.fillCacheResources = function (resources) {
            var _this = this;
            angular.forEach(resources, function (resource) {
                _this.fillCacheResource(resource);
            });
        };
        Resource.prototype.fillCacheResource = function (resource) {
            if (resource.id)
                this.getService().cache[resource.id] = resource;
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
/// <reference path="./services/base.ts"/>
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvYmFzZS50cyIsInNlcnZpY2VzL2Jhc2UuanMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9wYXRoLW1ha2VyLnRzIiwic2VydmljZXMvcGF0aC1tYWtlci5qcyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci5qcyIsImNvcmUudHMiLCJjb3JlLmpzIiwicmVzb3VyY2UudHMiLCJyZXNvdXJjZS5qcyIsIl9hbGwudHMiLCJfYWxsLmpzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsQ0FBQyxVQUFVLFNBQU87O0lBRWQsUUFBUSxPQUFPLGtCQUFrQjtTQUNoQyxTQUFTLG1CQUFtQjtRQUN6QixLQUFLO1FBQ0wsT0FBTztRQUNQLG1CQUFtQjtRQUNuQixtQkFBbUI7O0lBR3ZCLFFBQVEsT0FBTyxvQkFBb0I7SUFFbkMsUUFBUSxPQUFPLGFBQWE7UUFDeEI7UUFDQTtRQUNBOztHQUdMO0FDSEg7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7UUFBQSxTQUFBLE9BQUE7O1FBQ1csS0FBQSxTQUEwQjtZQUM3QixJQUFJO1lBQ0osU0FBUzs7UUFHTixLQUFBLFNBQVM7WUFDWixZQUFZO1lBQ1osZUFB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WUFBQSxVQUFPO0FDWWQ7QUNaQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGlCQUFBLFlBQUE7O1FBR0ksU0FBQSxnQkFBQTs7UUFJTyxjQUFBLFVBQUEsV0FBUCxVQUFnQixhQUFtQjtZQUMvQixPQUFPOztRQUVmLE9BQUE7O0lBVmEsUUFBQSxnQkFBYTtHQUR2QixZQUFBLFVBQU87QUNhZDtBQ2JBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsa0JBQUEsWUFBQTs7UUFHSSxTQUFBLGlCQUFBOztRQU9PLGVBQUEsVUFBQSxNQUFQLFVBQVcsS0FBRzs7OztRQUtQLGVBQUEsVUFBQSxRQUFQLFVBQWEsS0FBSyxNQUFJOzs7O1FBTTFCLE9BQUE7O0lBckJhLFFBQUEsaUJBQWM7R0FEeEIsWUFBQSxVQUFPO0FDa0JkIiwiZmlsZSI6InRzLWFuZ3VsYXItanNvbmFwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuXG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLycsXG4gICAgICAgIGRlbGF5OiAwLFxuICAgICAgICB1bmlmeV9jb25jdXJyZW5jeTogdHJ1ZSxcbiAgICAgICAgY2FjaGVfcHJlcmVxdWVzdHM6IHRydWVcbiAgICB9KTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xuXG59KShhbmd1bGFyKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJyxcbiAgICAgICAgZGVsYXk6IDAsXG4gICAgICAgIHVuaWZ5X2NvbmN1cnJlbmN5OiB0cnVlLFxuICAgICAgICBjYWNoZV9wcmVyZXF1ZXN0czogdHJ1ZVxuICAgIH0pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLCBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcbn0pKGFuZ3VsYXIpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBCYXNlIHtcbiAgICAgICAgc3RhdGljIFBhcmFtczogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBzdGF0aWMgU2NoZW1hID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgICB9O1xuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEJhc2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBCYXNlKCkge1xuICAgICAgICB9XG4gICAgICAgIEJhc2UuUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcbiAgICAgICAgQmFzZS5TY2hlbWEgPSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBCYXNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5CYXNlID0gQmFzZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBIdHRwIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCAkaHR0cCxcbiAgICAgICAgICAgIHByb3RlY3RlZCAkdGltZW91dCxcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJHFcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBkZWxldGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdERUxFVEUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdHRVQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3RlY3RlZCBleGVjKHBhdGg6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGRhdGE/OiBKc29uYXBpLklEYXRhT2JqZWN0KSB7XG4gICAgICAgICAgICBsZXQgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgbGV0IHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG5cbiAgICAgICAgICAgIGxldCBkZWZlcnJlZCA9IHRoaXMuJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRpbWVvdXQganVzdCBmb3IgZGV2ZWxvcCBlbnZpcm9ubWVudFxuICAgICAgICAgICAgICAgICAgICBzZWxmLiR0aW1lb3V0KCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHNlbGYucnNKc29uYXBpQ29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb2ZmbGluZT9cbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc0Vycm9yKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpSHR0cCcsIEh0dHApO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSHR0cCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSHR0cCgkaHR0cCwgJHRpbWVvdXQsIHJzSnNvbmFwaUNvbmZpZywgJHEpIHtcbiAgICAgICAgICAgIHRoaXMuJGh0dHAgPSAkaHR0cDtcbiAgICAgICAgICAgIHRoaXMuJHRpbWVvdXQgPSAkdGltZW91dDtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy4kcSA9ICRxO1xuICAgICAgICB9XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdERUxFVEUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0dFVCcpO1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5leGVjID0gZnVuY3Rpb24gKHBhdGgsIG1ldGhvZCwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIC8vIHRpbWVvdXQganVzdCBmb3IgZGV2ZWxvcCBlbnZpcm9ubWVudFxuICAgICAgICAgICAgICAgIHNlbGYuJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LCBzZWxmLnJzSnNvbmFwaUNvbmZpZy5kZWxheSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkuSHR0cC5leGVjIGVycm9yID0+JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBvZmZsaW5lP1xuICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUubG9hZGluZ3NFcnJvcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBQYXRoTWFrZXIge1xuICAgICAgICBwdWJsaWMgcGF0aHM6IEFycmF5PFN0cmluZz4gPSBbXTtcbiAgICAgICAgcHVibGljIGluY2x1ZGVzOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgcHVibGljIGFkZFBhdGgodmFsdWU6IFN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzZXRJbmNsdWRlKHN0cmluZ3NfYXJyYXk6IEFycmF5PFN0cmluZz4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldCgpOiBTdHJpbmcge1xuICAgICAgICAgICAgbGV0IGdldF9wYXJhbXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFBhdGhNYWtlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIFBhdGhNYWtlcigpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmFkZFBhdGggPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMucHVzaCh2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuc2V0SW5jbHVkZSA9IGZ1bmN0aW9uIChzdHJpbmdzX2FycmF5KSB7XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gc3RyaW5nc19hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZ2V0X3BhcmFtcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aHMuam9pbignLycpICtcbiAgICAgICAgICAgICAgICAoZ2V0X3BhcmFtcy5sZW5ndGggPiAwID8gJz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBQYXRoTWFrZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlBhdGhNYWtlciA9IFBhdGhNYWtlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb252ZXJ0ZXIge1xuXG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBSZXNvdXJjZXMgYXJyYXlzIHdpdGhvdXQgW2tleXNdXG4gICAgICAgICoqL1xuICAgICAgICBzdGF0aWMganNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoXG4gICAgICAgICAgICBqc29uX2FycmF5OiBBcnJheTxKc29uYXBpLklEYXRhUmVzb3VyY2U+LFxuICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXk/OiBPYmplY3QsIC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPixcbiAgICAgICAgICAgIHVzZV9pZF9mb3Jfa2V5ID0gZmFsc2VcbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGlmICghZGVzdGluYXRpb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGRhdGEgb2YganNvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmpzb24ycmVzb3VyY2UoZGF0YSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmICh1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmNsdWRlZCBmb3IgZXhhbXBsZSBuZWVkIGEgZXh0cmEgcGFyYW1ldGVyXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb25fYXJyYXkucHVzaChyZXNvdXJjZS5pZCArIHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZGVzdGluYXRpb25fYXJyYXlbJyRjb3VudCddID0gY291bnQ7IC8vIHByb2JsZW0gd2l0aCB0b0FycmF5IG9yIGFuZ3VsYXIuZm9yRWFjaCBuZWVkIGEgIWlzT2JqZWN0XG4gICAgICAgICAgICByZXR1cm4gZGVzdGluYXRpb25fYXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gaW5kZXhlZCBSZXNvdXJjZXMgYXJyYXkgYnkgW3R5cGVdW2lkXVxuICAgICAgICAqKi9cbiAgICAgICAgc3RhdGljIGpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUgKFxuICAgICAgICAgICAganNvbl9hcnJheTogQXJyYXk8SnNvbmFwaS5JRGF0YVJlc291cmNlPixcbiAgICAgICAgICAgIGluc3RhbmNlX3JlbGF0aW9uc2hpcHM6IGJvb2xlYW5cbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGxldCBhbGxfcmVzb3VyY2VzOmFueSA9IHsgfSA7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgbGV0IHJlc291cmNlcyA9IHsgfTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxfcmVzb3VyY2VzLCAocmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIShyZXNvdXJjZS50eXBlIGluIHJlc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdID0geyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV1bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZXM7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMganNvbjJyZXNvdXJjZShqc29uX3Jlc291cmNlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UsIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gc2VydmljZSBub3QgcmVnaXN0ZXJlZFxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyBqc29uX3Jlc291cmNlLnR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBqc29uMnJlc291cmNlKCknKTtcbiAgICAgICAgICAgICAgICBsZXQgdGVtcCA9IG5ldyBKc29uYXBpLlJlc291cmNlKCk7XG4gICAgICAgICAgICAgICAgdGVtcC5pZCA9IGpzb25fcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgdGVtcC50eXBlID0ganNvbl9yZXNvdXJjZS50eXBlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGdldFNlcnZpY2UodHlwZTogc3RyaW5nKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIHJldHVybiBhIHJlc291cmNlIHR5cGUocmVzb3J1Y2Vfc2VydmljZSkgd2l0aCBkYXRhKGRhdGEpICovXG4gICAgICAgIHN0YXRpYyBwcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZTogSnNvbmFwaS5JUmVzb3VyY2UsIGRhdGE6IEpzb25hcGkuSURhdGFSZXNvdXJjZSk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmICghKCd0eXBlJyBpbiBkYXRhICYmICdpZCcgaW4gZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdKc29uYXBpIFJlc291cmNlIGlzIG5vdCBjb3JyZWN0JywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBuZXcgKDxhbnk+cmVzb3VyY2Vfc2VydmljZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdGF0aWMgYnVpbGQoZG9jdW1lbnRfZnJvbTogSURhdGFPYmplY3QgfCBJRGF0YUNvbGxlY3Rpb24sIHJlc291cmNlX2Rlc3Q6IElSZXNvdXJjZSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBhbnksIHJlc291cmNlX2Rlc3Q6IGFueSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0ge307XG4gICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBkb2N1bWVudF9mcm9tKSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShkb2N1bWVudF9mcm9tLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzQXJyYXkoZG9jdW1lbnRfZnJvbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tOiBJRGF0YUNvbGxlY3Rpb24sIHJlc291cmNlX2Rlc3Q6IEFycmF5PElEYXRhQ29sbGVjdGlvbj4sIHNjaGVtYTogSVNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGRhdGEgb2YgZG9jdW1lbnRfZnJvbS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghKGRhdGEuaWQgaW4gcmVzb3VyY2VfZGVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyAoPGFueT5yZXNvdXJjZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbTogSURhdGFSZXNvdXJjZSwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXMgPyBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXMgOiB7IH07XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9fYnVpbGRSZWxhdGlvbnNoaXBzKHJlbGF0aW9uc2hpcHNfZnJvbTogQXJyYXk8YW55PiwgcmVsYXRpb25zaGlwc19kZXN0OiBBcnJheTxhbnk+LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbl92YWx1ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gJiYgc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA8IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgKHJlbGF0aW9uX3ZhbHVlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhW3RtcC5pZF0gPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbjogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbmNsdWRlZF9hcnJheSk6IEpzb25hcGkuSVJlc291cmNlIHwgSnNvbmFwaS5JRGF0YVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1cbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyByZXNvdXJjZSBub3QgaW5jbHVkZWQsIHJldHVybiBkaXJlY3RseSB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG5cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBqc29uX2FycmF5XzEgPSBqc29uX2FycmF5OyBfaSA8IGpzb25fYXJyYXlfMS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IGpzb25fYXJyYXlfMVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIHZhciBhbGxfcmVzb3VyY2VzID0ge307XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuanNvbjJyZXNvdXJjZSA9IGZ1bmN0aW9uIChqc29uX3Jlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgdmFyIHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfTtcbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgQ29udmVydGVyLnByb2NyZWF0ZSA9IGZ1bmN0aW9uIChyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gbmV3IHJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIC8vIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBJRGF0YU9iamVjdCB8IElEYXRhQ29sbGVjdGlvbiwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgQ29udmVydGVyLmJ1aWxkID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSkge1xuICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgaWYgKCdpbmNsdWRlZCcgaW4gZG9jdW1lbnRfZnJvbSkge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoZG9jdW1lbnRfZnJvbS5pbmNsdWRlZCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNBcnJheShkb2N1bWVudF9mcm9tLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2VzID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBkb2N1bWVudF9mcm9tLmRhdGE7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfYVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghKGRhdGEuaWQgaW4gcmVzb3VyY2VfZGVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyByZXNvdXJjZS5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkYXRhLCByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuYXR0cmlidXRlcyA9IGRvY3VtZW50X2Zyb20uYXR0cmlidXRlcyA/IGRvY3VtZW50X2Zyb20uYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5pZCA9IGRvY3VtZW50X2Zyb20uaWQ7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXBzKGRvY3VtZW50X2Zyb20ucmVsYXRpb25zaGlwcywgcmVzb3VyY2VfZGVzdC5yZWxhdGlvbnNoaXBzLCBpbmNsdWRlZCwgc2NoZW1hKTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXBzID0gZnVuY3Rpb24gKHJlbGF0aW9uc2hpcHNfZnJvbSwgcmVsYXRpb25zaGlwc19kZXN0LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIGZ1bmN0aW9uIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSB7XG4gICAgICAgICAgICAgICAgLy8gcmVsYXRpb24gaXMgaW4gc2NoZW1hPyBoYXZlIGRhdGEgb3IganVzdCBsaW5rcz9cbiAgICAgICAgICAgICAgICBpZiAoIShyZWxhdGlvbl9rZXkgaW4gcmVsYXRpb25zaGlwc19kZXN0KSAmJiAoJ2RhdGEnIGluIHJlbGF0aW9uX3ZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gc29tZXRpbWUgZGF0YT1udWxsIG9yIHNpbXBsZSB7IH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uX3ZhbHVlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBpZiAoc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSAmJiBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uX3ZhbHVlLmRhdGEubGVuZ3RoIDwgMSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX3ZhbHVlLmRhdGFbMF0udHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0ge307IC8vIGZvcmNlIHRvIG9iamVjdCAobm90IGFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGZ1bmN0aW9uIChyZWxhdGlvbl92YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGFbdG1wLmlkXSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUuZGF0YSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uIChyZWxhdGlvbiwgaW5jbHVkZWRfYXJyYXkpIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV0pIHtcbiAgICAgICAgICAgICAgICAvLyBpdCdzIGluIGluY2x1ZGVkXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluY2x1ZGVkX2FycmF5W3JlbGF0aW9uLnR5cGVdW3JlbGF0aW9uLmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHJlc291cmNlIG5vdCBpbmNsdWRlZCwgcmV0dXJuIGRpcmVjdGx5IHRoZSBvYmplY3RcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVsYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBDb252ZXJ0ZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvbnZlcnRlciA9IENvbnZlcnRlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb3JlIGltcGxlbWVudHMgSnNvbmFwaS5JQ29yZSB7XG4gICAgICAgIHB1YmxpYyByb290UGF0aDogc3RyaW5nID0gJ2h0dHA6Ly9yZXllc29mdC5kZG5zLm5ldDo5OTk5L2FwaS92MS9jb21wYW5pZXMvMic7XG4gICAgICAgIHB1YmxpYyByZXNvdXJjZXM6IEFycmF5PEpzb25hcGkuSVJlc291cmNlPiA9IFtdO1xuXG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0NvdW50ZXI6IG51bWJlciA9IDA7XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc1N0YXJ0ID0gKCkgPT4ge307XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0RvbmUgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzRXJyb3IgPSAoKSA9PiB7fTtcblxuICAgICAgICBwdWJsaWMgc3RhdGljIE1lOiBKc29uYXBpLklDb3JlID0gbnVsbDtcbiAgICAgICAgcHVibGljIHN0YXRpYyBTZXJ2aWNlczogYW55ID0gbnVsbDtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUNvcmVTZXJ2aWNlc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9yZWdpc3RlcihjbGFzZSk6IGJvb2xlYW4ge1xuICAgICAgICAgICAgaWYgKGNsYXNlLnR5cGUgaW4gdGhpcy5yZXNvdXJjZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0UmVzb3VyY2UodHlwZTogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvdXJjZXNbdHlwZV07XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgcmVmcmVzaExvYWRpbmdzKGZhY3RvcjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmUnLCBDb3JlKTtcbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvcmUgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmUocnNKc29uYXBpQ29uZmlnLCBKc29uYXBpQ29yZVNlcnZpY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuSnNvbmFwaUNvcmVTZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgICAgICB0aGlzLnJvb3RQYXRoID0gJ2h0dHA6Ly9yZXllc29mdC5kZG5zLm5ldDo5OTk5L2FwaS92MS9jb21wYW5pZXMvMic7XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0ID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRXJyb3IgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgfVxuICAgICAgICBDb3JlLnByb3RvdHlwZS5fcmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2xhc2UpIHtcbiAgICAgICAgICAgIGlmIChjbGFzZS50eXBlIGluIHRoaXMucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5nZXRSZXNvdXJjZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvdXJjZXNbdHlwZV07XG4gICAgICAgIH07XG4gICAgICAgIENvcmUucHJvdG90eXBlLnJlZnJlc2hMb2FkaW5ncyA9IGZ1bmN0aW9uIChmYWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb3JlLk1lID0gbnVsbDtcbiAgICAgICAgQ29yZS5TZXJ2aWNlcyA9IG51bGw7XG4gICAgICAgIHJldHVybiBDb3JlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db3JlID0gQ29yZTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgUmVzb3VyY2UgaW1wbGVtZW50cyBJUmVzb3VyY2Uge1xuICAgICAgICBwdWJsaWMgc2NoZW1hOiBJU2NoZW1hO1xuICAgICAgICBwcm90ZWN0ZWQgcGF0aDogc3RyaW5nOyAgIC8vIHdpdGhvdXQgc2xhc2hlc1xuXG4gICAgICAgIHB1YmxpYyBpc19uZXcgPSB0cnVlO1xuICAgICAgICBwdWJsaWMgdHlwZTogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgaWQ6IHN0cmluZztcbiAgICAgICAgcHVibGljIGF0dHJpYnV0ZXM6IGFueSA7XG4gICAgICAgIHB1YmxpYyByZWxhdGlvbnNoaXBzOiBhbnkgPSB7fTsgLy9bXTtcbiAgICAgICAgcHVibGljIGNhY2hlOiBPYmplY3Q7XG5cbiAgICAgICAgcHVibGljIGNsb25lKCk6IGFueSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgKDxhbnk+dGhpcy5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgUmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBAcmV0dXJuIHRydWUgaWYgdGhlIHJlc291cmNlIGRvbid0IGV4aXN0IGFuZCByZWdpc3RlcmVkIG9rXG4gICAgICAgICoqL1xuICAgICAgICBwdWJsaWMgcmVnaXN0ZXIoKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoSnNvbmFwaS5Db3JlLk1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0Vycm9yOiB5b3UgYXJlIHRyeWluZyByZWdpc3RlciAtLT4gJyArIHRoaXMudHlwZSArICcgPC0tIGJlZm9yZSBpbmplY3QgSnNvbmFwaUNvcmUgc29tZXdoZXJlLCBhbG1vc3Qgb25lIHRpbWUuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiBzZXJ2aWNlIGlzIHJlZ2lzdGVyZWQsIG5vdCBjbG9uZWQgb2JqZWN0XG4gICAgICAgICAgICB0aGlzLmNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldzxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KCk6IFQge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMuaWQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KHBhcmFtczogSnNvbmFwaS5JUGFyYW1zKTogSnNvbmFwaS5JRGF0YU9iamVjdCB7XG4gICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcblxuICAgICAgICAgICAgbGV0IHJlbGF0aW9uc2hpcHMgPSB7IH07XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWQgPSBbIF07XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWRfaWRzID0gWyBdOyAvL2p1c3QgZm9yIGNvbnRyb2wgZG9uJ3QgcmVwZWF0IGFueSByZXNvdXJjZVxuXG4gICAgICAgICAgICAvLyBhZ3JlZ28gY2FkYSByZWxhdGlvbnNoaXBcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gJiYgdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcblxuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIChyZXNvdXJjZTogSnNvbmFwaS5JUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghKCdpZCcgaW4gcmVsYXRpb25zaGlwLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVsYXRpb25fYWxpYXMgKyAnIGRlZmluZWQgd2l0aCBoYXNNYW55OmZhbHNlLCBidXQgSSBoYXZlIGEgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgaWQ6IHJlbGF0aW9uc2hpcC5kYXRhLmlkLCB0eXBlOiByZWxhdGlvbnNoaXAuZGF0YS50eXBlIH0gfTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICBsZXQgdGVtcG9yYWxfaWQgPSByZWxhdGlvbnNoaXAuZGF0YS50eXBlICsgJ18nICsgcmVsYXRpb25zaGlwLmRhdGEuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25zaGlwLmRhdGEudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlbGF0aW9uc2hpcC5kYXRhLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGV0IHJldDogSURhdGFPYmplY3QgPSB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoaW5jbHVkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldC5pbmNsdWRlZCA9IGluY2x1ZGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KGlkOiBzdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBUIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGRlbGV0ZShpZDogc3RyaW5nLCBwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgICAgICAgICB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2RlbGV0ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFsbDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHNhdmU8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogQXJyYXk8VD4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdzYXZlJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgVGhpcyBtZXRob2Qgc29ydCBwYXJhbXMgZm9yIG5ldygpLCBnZXQoKSBhbmQgdXBkYXRlKClcbiAgICAgICAgKi9cbiAgICAgICAgcHJpdmF0ZSBfX2V4ZWMoaWQ6IHN0cmluZywgcGFyYW1zOiBKc29uYXBpLklQYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGU6IHN0cmluZyk6IGFueSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gSnNvbmFwaS5CYXNlLlBhcmFtcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBKc29uYXBpLkJhc2UuUGFyYW1zO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkge307XG5cbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcblxuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlbGV0ZShpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9nZXQoaWQ6IHN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlID8gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdIDogdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogT2JqZWN0IHsgLy8gQXJyYXk8SVJlc291cmNlPiB7XG5cbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHsgfTtcbiAgICAgICAgICAgIGlmICh0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IG1ha2VcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGUocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZGVsZXRlKGlkOiBzdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiB2b2lkIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5kZWxldGUocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfc2F2ZShwYXJhbXM6IElQYXJhbXMsIGZjX3N1Y2Nlc3M6IEZ1bmN0aW9uLCBmY19lcnJvcjogRnVuY3Rpb24pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG5cbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKCdkYXRhJyBpbiBlcnJvciA/IGVycm9yLmRhdGEgOiBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFkZFJlbGF0aW9uc2hpcDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlOiBULCB0eXBlX2FsaWFzPzogc3RyaW5nKSB7XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgb2JqZWN0X2tleSA9IHJlc291cmNlLmlkO1xuICAgICAgICAgICAgaWYgKCFvYmplY3Rfa2V5KSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0X2tleSA9ICduZXdfJyArIChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDApKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZW1vdmVSZWxhdGlvbnNoaXAodHlwZV9hbGlhczogc3RyaW5nLCBpZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoISgnZGF0YScgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGlkIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtpZF07XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlKHJlc291cmNlcykge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlcy5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZXMocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlUmVzb3VyY2VzPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2VzOiBBcnJheTxUPikge1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlcywgKHJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlUmVzb3VyY2U8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihyZXNvdXJjZTogVCkge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlLmlkKVxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgcHVibGljIGdldFNlcnZpY2UoKTogYW55IHtcbiAgICAgICAgICAgIHJldHVybiBDb252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9OyAvL1tdO1xuICAgICAgICB9XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBhdHRyaWJ1dCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2F0dHJpYnV0XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xvbmVPYmpbYXR0cmlidXRdID0gdGhpc1thdHRyaWJ1dF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNsb25lT2JqO1xuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgUmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBAcmV0dXJuIHRydWUgaWYgdGhlIHJlc291cmNlIGRvbid0IGV4aXN0IGFuZCByZWdpc3RlcmVkIG9rXG4gICAgICAgICoqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoSnNvbmFwaS5Db3JlLk1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0Vycm9yOiB5b3UgYXJlIHRyeWluZyByZWdpc3RlciAtLT4gJyArIHRoaXMudHlwZSArICcgPC0tIGJlZm9yZSBpbmplY3QgSnNvbmFwaUNvcmUgc29tZXdoZXJlLCBhbG1vc3Qgb25lIHRpbWUuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiBzZXJ2aWNlIGlzIHJlZ2lzdGVyZWQsIG5vdCBjbG9uZWQgb2JqZWN0XG4gICAgICAgICAgICB0aGlzLmNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9O1xuICAgICAgICAvLyBlbXB0eSBzZWxmIG9iamVjdFxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUubmV3ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV1bJ2RhdGEnXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmlzX25ldyA9IHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWQgPSBbXTtcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZF9pZHMgPSBbXTsgLy9qdXN0IGZvciBjb250cm9sIGRvbid0IHJlcGVhdCBhbnkgcmVzb3VyY2VcbiAgICAgICAgICAgIC8vIGFncmVnbyBjYWRhIHJlbGF0aW9uc2hpcFxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoX3RoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdICYmIF90aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHt9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoISgnaWQnIGluIHJlbGF0aW9uc2hpcC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKHJlbGF0aW9uX2FsaWFzICsgJyBkZWZpbmVkIHdpdGggaGFzTWFueTpmYWxzZSwgYnV0IEkgaGF2ZSBhIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyBpZDogcmVsYXRpb25zaGlwLmRhdGEuaWQsIHR5cGU6IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgfSB9O1xuICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcG9yYWxfaWQgPSByZWxhdGlvbnNoaXAuZGF0YS50eXBlICsgJ18nICsgcmVsYXRpb25zaGlwLmRhdGEuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25zaGlwLmRhdGEudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlbGF0aW9uc2hpcC5kYXRhLnRvT2JqZWN0KHt9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIHJldCA9IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoaW5jbHVkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldC5pbmNsdWRlZCA9IGluY2x1ZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZGVsZXRlJyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdzYXZlJyk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX19leGVjID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGUpIHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBKc29uYXBpLkJhc2UuUGFyYW1zO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBKc29uYXBpLkJhc2UuUGFyYW1zO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlbGV0ZShpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgPyB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gOiB0aGlzLm5ldygpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgX3RoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2FsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHt9O1xuICAgICAgICAgICAgaWYgKHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgZG9uJ3QgbWFrZVxuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSwgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2Vba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgX3RoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGUocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmRlbGV0ZShwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX3NhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hZGRSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAocmVzb3VyY2UsIHR5cGVfYWxpYXMpIHtcbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBvYmplY3Rfa2V5ID0gcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICBpZiAoIW9iamVjdF9rZXkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rfa2V5ID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlbW92ZVJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uICh0eXBlX2FsaWFzLCBpZCkge1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoJ2RhdGEnIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShpZCBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11baWRdO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5maWxsQ2FjaGUgPSBmdW5jdGlvbiAocmVzb3VyY2VzKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VzLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZXMocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlcyA9IGZ1bmN0aW9uIChyZXNvdXJjZXMpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlID0gZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2UuaWQpXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBAcmV0dXJuIFRoaXMgcmVzb3VyY2UgbGlrZSBhIHNlcnZpY2VcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRTZXJ2aWNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UodGhpcy50eXBlKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFJlc291cmNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5SZXNvdXJjZSA9IFJlc291cmNlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuXG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuXG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvYmFzZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHNcIi8+XG4vLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY29yZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3Jlc291cmNlLnRzXCIvPlxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9iYXNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
