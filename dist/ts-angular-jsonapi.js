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
        // 'angular-storage',
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

/// <reference path="../_all.ts" />
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
                if (error.status <= 0) {
                    // offline?
                    if (!Jsonapi.Core.Me.loadingsOffline(error)) {
                        console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsOffline for catch it) error =>', error);
                    }
                }
                else {
                    if (!Jsonapi.Core.Me.loadingsError(error)) {
                        console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsError for catch it) error =>', error);
                    }
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
    var Filter = (function () {
        function Filter() {
        }
        Filter.prototype.passFilter = function (resource, filter) {
            for (var attribute in filter) {
                if (attribute in resource.attributes && resource.attributes[attribute] === filter[attribute]) {
                    return true;
                }
            }
            return false;
        };
        return Filter;
    }());
    Jsonapi.Filter = Filter;
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

/// <reference path="./_all.ts" />
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
            this.loadingsOffline = function () { };
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
            this.cache_vars = {};
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
            // REALTIONSHIPS
            angular.forEach(this.relationships, function (relationship, relation_alias) {
                if (_this.schema.relationships[relation_alias] && _this.schema.relationships[relation_alias].hasMany) {
                    // has many (hasMany:true)
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
                    // has one (hasMany:false)
                    if (!('id' in relationship.data) && !angular.equals({}, relationship.data)) {
                        console.warn(relation_alias + ' defined with hasMany:false, but I have a collection');
                    }
                    if (relationship.data.id && relationship.data.type) {
                        relationships[relation_alias] = { data: { id: relationship.data.id, type: relationship.data.type } };
                    }
                    else {
                        relationships[relation_alias] = { data: {} };
                    }
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
        Resource.prototype.getRelationships = function (parent_path_id, params, fc_success, fc_error) {
            return this.__exec(parent_path_id, params, fc_success, fc_error, 'getRelationships');
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
                params = angular.extend({}, Jsonapi.Base.Params);
            }
            else {
                if (angular.isUndefined(params)) {
                    params = angular.extend({}, Jsonapi.Base.Params);
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
                case 'getRelationships':
                    params.path = id;
                    return this._all(params, fc_success, fc_error);
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
            var resource = this.getService().cache && this.getService().cache[id] ? this.getService().cache[id] : this.new();
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
            params.path ? path.addPath(params.path) : null;
            params.include ? path.setInclude(params.include) : null;
            // make request
            var resource;
            resource = Object.defineProperties({}, {
                '$length': {
                    get: function () { return Object.keys(this).length; },
                    enumerable: false
                },
                '$isloading': { value: false, enumerable: false, writable: true },
                '$source': { value: '', enumerable: false, writable: true }
            });
            // MEMORY_CACHE
            // (!params.path): becouse we need real type, not this.getService().cache
            if (!params.path && this.getService().cache && this.getService().cache_vars['__path'] === this.getPath()) {
                // we don't make
                resource.$source = 'cache';
                var filter_1 = new Jsonapi.Filter();
                angular.forEach(this.getService().cache, function (value, key) {
                    if (!params.filter || filter_1.passFilter(value, params.filter)) {
                        resource[key] = value;
                    }
                });
            }
            resource['$isloading'] = true;
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
                resource.$source = 'server';
                resource.$isloading = false;
                Jsonapi.Converter.build(success.data, resource, _this.schema);
                /*
                (!params.path): fill cache need work with relationships too,
                for the momment we're created this if
                */
                if (!params.path) {
                    _this.fillCache(resource);
                }
                // filter getted data
                if (params.filter) {
                    var filter_2 = new Jsonapi.Filter();
                    angular.forEach(resource, function (value, key) {
                        if (!filter_2.passFilter(value, params.filter)) {
                            delete resource[key];
                        }
                    });
                }
                fc_success(success);
            }, function (error) {
                resource.$source = 'server';
                resource.$isloading = false;
                fc_error(error);
            });
            return resource;
        };
        Resource.prototype._delete = function (id, params, fc_success, fc_error) {
            var _this = this;
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            path.addPath(id);
            Jsonapi.Core.Services.JsonapiHttp
                .delete(path.get())
                .then(function (success) {
                if (_this.getService().cache && _this.getService().cache[id]) {
                    _this.getService().cache[id]['id'] = '';
                    _this.getService().cache[id]['attributes'] = null;
                    delete _this.getService().cache[id];
                }
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
            var object_key = resource.id;
            if (!object_key) {
                object_key = 'new_' + (Math.floor(Math.random() * 100000));
            }
            type_alias = (type_alias ? type_alias : resource.type);
            if (!(type_alias in this.relationships)) {
                this.relationships[type_alias] = { data: {} };
            }
            if (this.schema.relationships[type_alias].hasMany) {
                this.relationships[type_alias]['data'][object_key] = resource;
            }
            else {
                this.relationships[type_alias]['data'] = resource;
            }
        };
        Resource.prototype.addRelationships = function (resources, type_alias) {
            var _this = this;
            if (!(type_alias in this.relationships)) {
                this.relationships[type_alias] = { data: {} };
            }
            if (!this.schema.relationships[type_alias].hasMany) {
                console.warn('addRelationships not supported on ' + this.type + ' schema.');
            }
            angular.forEach(resources, function (resource) {
                _this.relationships[type_alias]['data'][resource.id] = resource;
            });
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
                this.getService().cache_vars['__path'] = this.getPath();
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
            if (resource.id) {
                this.getService().cache[resource.id] = resource;
            }
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

/// <reference path="../../typings/index.d.ts" />
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
/// <reference path="./interfaces/collection.d.ts"/>
/// <reference path="./interfaces/resource.d.ts"/>
// TS-Jsonapi classes
/// <reference path="./app.module.ts"/>
/// <reference path="./services/base.ts"/>
/// <reference path="./services/http.service.ts"/>
/// <reference path="./services/filter.ts"/>
/// <reference path="./services/path-maker.ts"/>
/// <reference path="./services/resource-converter.ts"/>
//// <reference path="./services/core-services.service.ts"/>
/// <reference path="./core.ts"/>
/// <reference path="./resource.ts"/>

/// <reference path="../_all.ts" />
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
