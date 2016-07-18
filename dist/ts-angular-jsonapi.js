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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvYmFzZS50cyIsInNlcnZpY2VzL2Jhc2UuanMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9maWx0ZXIudHMiLCJzZXJ2aWNlcy9maWx0ZXIuanMiLCJzZXJ2aWNlcy9wYXRoLW1ha2VyLnRzIiwic2VydmljZXMvcGF0aC1tYWtlci5qcyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci5qcyIsImNvcmUudHMiLCJjb3JlLmpzIiwicmVzb3VyY2UudHMiLCJyZXNvdXJjZS5qcyIsIl9hbGwudHMiLCJfYWxsLmpzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsQ0FBQyxVQUFVLFNBQU87O0lBRWQsUUFBUSxPQUFPLGtCQUFrQjtTQUNoQyxTQUFTLG1CQUFtQjtRQUN6QixLQUFLO1FBQ0wsT0FBTztRQUNQLG1CQUFtQjtRQUNuQixtQkFBbUI7O0lBR3ZCLFFBQVEsT0FBTyxvQkFBb0I7SUFFbkMsUUFBUSxPQUFPLGFBQWE7UUFDeEI7UUFDQTtRQUNBOztHQUdMO0FDSEg7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7UUFBQSxTQUFBLE9BQUE7O1FBQ1csS0FBQSxTQUEwQjtZQUM3QixJQUFJO1lB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LGFBQVc7WUFBWCxLQUFBLGNBQUE7O1FBSWxCLE9BQUE7O0lBUmEsUUFBQSxlQUFZO0lBVXpCLFFBQVEsT0FBTyxvQkFBb0IsUUFBUSx1QkFBdUI7R0FYL0QsWUFBQSxVQUFPO0FDWWQ7QUNaQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGlCQUFBLFlBQUE7O1FBR0ksU0FBQSxnQkFBQTs7UUFJTyxjQUFBLFVBQUEsV0FBUCxVQUFnQixhQUFtQjtZQUMvQixPQUFPOztRQUVmLE9BQUE7O0lBVmEsUUFBQSxnQkFBYTtHQUR2QixZQUFBLFVBQU87QUNhZDtBQ2JBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsa0JBQUEsWUFBQTs7UUFHSSxTQUFBLGlCQUFBOztRQU9PLGVBQUEsVUFBQSxNQUFQLFVBQVcsS0FBRzs7OztRQUtQLGVBQUEsVUFBQSxRQUFQLFVBQWEsS0FBSyxNQUFJOzs7O1FBTTFCLE9BQUE7O0lBckJhLFFBQUEsaUJBQWM7R0FEeEIsWUFBQSxVQUFPO0FDa0JkIiwiZmlsZSI6InRzLWFuZ3VsYXItanNvbmFwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuXG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLycsXG4gICAgICAgIGRlbGF5OiAwLFxuICAgICAgICB1bmlmeV9jb25jdXJyZW5jeTogdHJ1ZSxcbiAgICAgICAgY2FjaGVfcHJlcmVxdWVzdHM6IHRydWVcbiAgICB9KTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xuXG59KShhbmd1bGFyKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJyxcbiAgICAgICAgZGVsYXk6IDAsXG4gICAgICAgIHVuaWZ5X2NvbmN1cnJlbmN5OiB0cnVlLFxuICAgICAgICBjYWNoZV9wcmVyZXF1ZXN0czogdHJ1ZVxuICAgIH0pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLCBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcbn0pKGFuZ3VsYXIpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBCYXNlIHtcbiAgICAgICAgc3RhdGljIFBhcmFtczogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBzdGF0aWMgU2NoZW1hID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgICB9O1xuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEJhc2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBCYXNlKCkge1xuICAgICAgICB9XG4gICAgICAgIEJhc2UuUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcbiAgICAgICAgQmFzZS5TY2hlbWEgPSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBCYXNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5CYXNlID0gQmFzZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBIdHRwIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCAkaHR0cCxcbiAgICAgICAgICAgIHByb3RlY3RlZCAkdGltZW91dCxcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJHFcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBkZWxldGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdERUxFVEUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdHRVQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3RlY3RlZCBleGVjKHBhdGg6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGRhdGE/OiBKc29uYXBpLklEYXRhT2JqZWN0KSB7XG4gICAgICAgICAgICBsZXQgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgbGV0IHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG5cbiAgICAgICAgICAgIGxldCBkZWZlcnJlZCA9IHRoaXMuJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRpbWVvdXQganVzdCBmb3IgZGV2ZWxvcCBlbnZpcm9ubWVudFxuICAgICAgICAgICAgICAgICAgICBzZWxmLiR0aW1lb3V0KCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHNlbGYucnNKc29uYXBpQ29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb2ZmbGluZT9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghSnNvbmFwaS5Db3JlLk1lLmxvYWRpbmdzT2ZmbGluZShlcnJvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkuSHR0cC5leGVjICh1c2UgSnNvbmFwaUNvcmUubG9hZGluZ3NPZmZsaW5lIGZvciBjYXRjaCBpdCkgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc0Vycm9yKGVycm9yKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgKHVzZSBKc29uYXBpQ29yZS5sb2FkaW5nc0Vycm9yIGZvciBjYXRjaCBpdCkgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpSHR0cCcsIEh0dHApO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSHR0cCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSHR0cCgkaHR0cCwgJHRpbWVvdXQsIHJzSnNvbmFwaUNvbmZpZywgJHEpIHtcbiAgICAgICAgICAgIHRoaXMuJGh0dHAgPSAkaHR0cDtcbiAgICAgICAgICAgIHRoaXMuJHRpbWVvdXQgPSAkdGltZW91dDtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy4kcSA9ICRxO1xuICAgICAgICB9XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdERUxFVEUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0dFVCcpO1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5leGVjID0gZnVuY3Rpb24gKHBhdGgsIG1ldGhvZCwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIC8vIHRpbWVvdXQganVzdCBmb3IgZGV2ZWxvcCBlbnZpcm9ubWVudFxuICAgICAgICAgICAgICAgIHNlbGYuJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LCBzZWxmLnJzSnNvbmFwaUNvbmZpZy5kZWxheSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3Iuc3RhdHVzIDw9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gb2ZmbGluZT9cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFKc29uYXBpLkNvcmUuTWUubG9hZGluZ3NPZmZsaW5lKGVycm9yKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyAodXNlIEpzb25hcGlDb3JlLmxvYWRpbmdzT2ZmbGluZSBmb3IgY2F0Y2ggaXQpIGVycm9yID0+JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIUpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc0Vycm9yKGVycm9yKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyAodXNlIEpzb25hcGlDb3JlLmxvYWRpbmdzRXJyb3IgZm9yIGNhdGNoIGl0KSBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBGaWx0ZXIge1xuXG4gICAgICAgIHB1YmxpYyBwYXNzRmlsdGVyKHJlc291cmNlOiBJUmVzb3VyY2UsIGZpbHRlcik6IGJvb2xlYW4ge1xuICAgICAgICAgICAgZm9yIChsZXQgYXR0cmlidXRlIGluICBmaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXR0cmlidXRlIGluIHJlc291cmNlLmF0dHJpYnV0ZXMgJiYgcmVzb3VyY2UuYXR0cmlidXRlc1thdHRyaWJ1dGVdID09PSBmaWx0ZXJbYXR0cmlidXRlXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEZpbHRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIEZpbHRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBGaWx0ZXIucHJvdG90eXBlLnBhc3NGaWx0ZXIgPSBmdW5jdGlvbiAocmVzb3VyY2UsIGZpbHRlcikge1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXRlIGluIGZpbHRlcikge1xuICAgICAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUgaW4gcmVzb3VyY2UuYXR0cmlidXRlcyAmJiByZXNvdXJjZS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPT09IGZpbHRlclthdHRyaWJ1dGVdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEZpbHRlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuRmlsdGVyID0gRmlsdGVyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFBhdGhNYWtlciB7XG4gICAgICAgIHB1YmxpYyBwYXRoczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuICAgICAgICBwdWJsaWMgaW5jbHVkZXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgYWRkUGF0aCh2YWx1ZTogU3RyaW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHNldEluY2x1ZGUoc3RyaW5nc19hcnJheTogQXJyYXk8U3RyaW5nPikge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KCk6IFN0cmluZyB7XG4gICAgICAgICAgICBsZXQgZ2V0X3BhcmFtczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICc/JyArIGdldF9wYXJhbXMuam9pbignJicpIDogJycpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUGF0aE1ha2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUGF0aE1ha2VyKCkge1xuICAgICAgICAgICAgdGhpcy5wYXRocyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuYWRkUGF0aCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5zZXRJbmNsdWRlID0gZnVuY3Rpb24gKHN0cmluZ3NfYXJyYXkpIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBnZXRfcGFyYW1zID0gW107XG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFBhdGhNYWtlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUGF0aE1ha2VyID0gUGF0aE1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvbnZlcnRlciB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIFJlc291cmNlcyBhcnJheXMgd2l0aG91dCBba2V5c11cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheShcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IEFycmF5PEpzb25hcGkuSURhdGFSZXNvdXJjZT4sXG4gICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheT86IE9iamVjdCwgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+LFxuICAgICAgICAgICAgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZVxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBqc29uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluY2x1ZGVkIGZvciBleGFtcGxlIG5lZWQgYSBleHRyYSBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheS5wdXNoKHJlc291cmNlLmlkICsgcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBpbmRleGVkIFJlc291cmNlcyBhcnJheSBieSBbdHlwZV1baWRdXG4gICAgICAgICoqL1xuICAgICAgICBzdGF0aWMganNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZSAoXG4gICAgICAgICAgICBqc29uX2FycmF5OiBBcnJheTxKc29uYXBpLklEYXRhUmVzb3VyY2U+LFxuICAgICAgICAgICAgaW5zdGFuY2VfcmVsYXRpb25zaGlwczogYm9vbGVhblxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgbGV0IGFsbF9yZXNvdXJjZXM6YW55ID0geyB9IDtcbiAgICAgICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheShqc29uX2FycmF5LCBhbGxfcmVzb3VyY2VzLCBmYWxzZSk7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2VzID0geyB9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBqc29uMnJlc291cmNlKGpzb25fcmVzb3VyY2U6IEpzb25hcGkuSURhdGFSZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShqc29uX3Jlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGpzb25fcmVzb3VyY2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBzZXJ2aWNlIG5vdCByZWdpc3RlcmVkXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIGpzb25fcmVzb3VyY2UudHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGpzb24ycmVzb3VyY2UoKScpO1xuICAgICAgICAgICAgICAgIGxldCB0ZW1wID0gbmV3IEpzb25hcGkuUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICB0ZW1wLmlkID0ganNvbl9yZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICB0ZW1wLnR5cGUgPSBqc29uX3Jlc291cmNlLnR5cGU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRlbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgZ2V0U2VydmljZSh0eXBlOiBzdHJpbmcpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29yZS5NZS5nZXRSZXNvdXJjZSh0eXBlKTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHJlc291cmNlX3NlcnZpY2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIHR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBnZXRTZXJ2aWNlKCknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgc3RhdGljIHByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlOiBKc29uYXBpLklSZXNvdXJjZSwgZGF0YTogSnNvbmFwaS5JRGF0YVJlc291cmNlKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgaWYgKCEoJ3R5cGUnIGluIGRhdGEgJiYgJ2lkJyBpbiBkYXRhKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0pzb25hcGkgUmVzb3VyY2UgaXMgbm90IGNvcnJlY3QnLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IG5ldyAoPGFueT5yZXNvdXJjZV9zZXJ2aWNlLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzID8gZGF0YS5hdHRyaWJ1dGVzIDoge307XG4gICAgICAgICAgICByZXNvdXJjZS5pc19uZXcgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBhbnksIHJlc291cmNlX2Rlc3Q6IGFueSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0ge307XG4gICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBkb2N1bWVudF9mcm9tKSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShkb2N1bWVudF9mcm9tLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzQXJyYXkoZG9jdW1lbnRfZnJvbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tOiBJRGF0YUNvbGxlY3Rpb24sIHJlc291cmNlX2Rlc3Q6IEFycmF5PElEYXRhQ29sbGVjdGlvbj4sIHNjaGVtYTogSVNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGRhdGEgb2YgZG9jdW1lbnRfZnJvbS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghKGRhdGEuaWQgaW4gcmVzb3VyY2VfZGVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyAoPGFueT5yZXNvdXJjZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbTogSURhdGFSZXNvdXJjZSwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9fYnVpbGRSZWxhdGlvbnNoaXBzKHJlbGF0aW9uc2hpcHNfZnJvbTogQXJyYXk8YW55PiwgcmVsYXRpb25zaGlwc19kZXN0OiBBcnJheTxhbnk+LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbl92YWx1ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gJiYgc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA8IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgKHJlbGF0aW9uX3ZhbHVlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhW3RtcC5pZF0gPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbjogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbmNsdWRlZF9hcnJheSk6IEpzb25hcGkuSVJlc291cmNlIHwgSnNvbmFwaS5JRGF0YVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1cbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyByZXNvdXJjZSBub3QgaW5jbHVkZWQsIHJldHVybiBkaXJlY3RseSB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG5cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBqc29uX2FycmF5XzEgPSBqc29uX2FycmF5OyBfaSA8IGpzb25fYXJyYXlfMS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IGpzb25fYXJyYXlfMVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIHZhciBhbGxfcmVzb3VyY2VzID0ge307XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuanNvbjJyZXNvdXJjZSA9IGZ1bmN0aW9uIChqc29uX3Jlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgdmFyIHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfTtcbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgQ29udmVydGVyLnByb2NyZWF0ZSA9IGZ1bmN0aW9uIChyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gbmV3IHJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5idWlsZCA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWQgPSB7fTtcbiAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIGRvY3VtZW50X2Zyb20pIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlZCA9IENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKGRvY3VtZW50X2Zyb20uaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzQXJyYXkoZG9jdW1lbnRfZnJvbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbS5kYXRhLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gZG9jdW1lbnRfZnJvbS5kYXRhOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0gX2FbX2ldO1xuICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoZGF0YS50eXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoIShkYXRhLmlkIGluIHJlc291cmNlX2Rlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0gPSBuZXcgcmVzb3VyY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZSA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAocmVsYXRpb25zaGlwc19mcm9tLCByZWxhdGlvbnNoaXBzX2Rlc3QsIGluY2x1ZGVkX2FycmF5LCBzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcHNfZnJvbSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpIHtcbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBzb21ldGltZSBkYXRhPW51bGwgb3Igc2ltcGxlIHsgfVxuICAgICAgICAgICAgICAgIGlmICghcmVsYXRpb25fdmFsdWUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmIChzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldICYmIHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YS5sZW5ndGggPCAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YVt0bXAuaWRdID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHJlbGF0aW9uLCBpbmNsdWRlZF9hcnJheSkge1xuICAgICAgICAgICAgaWYgKHJlbGF0aW9uLnR5cGUgaW4gaW5jbHVkZWRfYXJyYXkgJiZcbiAgICAgICAgICAgICAgICByZWxhdGlvbi5pZCBpbiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXSkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzb3VyY2Ugbm90IGluY2x1ZGVkLCByZXR1cm4gZGlyZWN0bHkgdGhlIG9iamVjdFxuICAgICAgICAgICAgICAgIHJldHVybiByZWxhdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIENvbnZlcnRlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29udmVydGVyID0gQ29udmVydGVyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmUgaW1wbGVtZW50cyBKc29uYXBpLklDb3JlIHtcbiAgICAgICAgcHVibGljIHJvb3RQYXRoOiBzdHJpbmcgPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgcHVibGljIHJlc291cmNlczogQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+ID0gW107XG5cbiAgICAgICAgcHVibGljIGxvYWRpbmdzQ291bnRlcjogbnVtYmVyID0gMDtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzU3RhcnQgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzRG9uZSA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NFcnJvciA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NPZmZsaW5lID0gKCkgPT4ge307XG5cbiAgICAgICAgcHVibGljIHN0YXRpYyBNZTogSnNvbmFwaS5JQ29yZSA9IG51bGw7XG4gICAgICAgIHB1YmxpYyBzdGF0aWMgU2VydmljZXM6IGFueSA9IG51bGw7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlDb3JlU2VydmljZXNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfcmVnaXN0ZXIoY2xhc2UpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmIChjbGFzZS50eXBlIGluIHRoaXMucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFJlc291cmNlKHR5cGU6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlZnJlc2hMb2FkaW5ncyhmYWN0b3I6IG51bWJlcik6IHZvaWQge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBDb3JlKHJzSnNvbmFwaUNvbmZpZywgSnNvbmFwaUNvcmVTZXJ2aWNlcykge1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlDb3JlU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICAgICAgdGhpcy5yb290UGF0aCA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyID0gMDtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0Vycm9yID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc09mZmxpbmUgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgfVxuICAgICAgICBDb3JlLnByb3RvdHlwZS5fcmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2xhc2UpIHtcbiAgICAgICAgICAgIGlmIChjbGFzZS50eXBlIGluIHRoaXMucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5nZXRSZXNvdXJjZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvdXJjZXNbdHlwZV07XG4gICAgICAgIH07XG4gICAgICAgIENvcmUucHJvdG90eXBlLnJlZnJlc2hMb2FkaW5ncyA9IGZ1bmN0aW9uIChmYWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb3JlLk1lID0gbnVsbDtcbiAgICAgICAgQ29yZS5TZXJ2aWNlcyA9IG51bGw7XG4gICAgICAgIHJldHVybiBDb3JlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db3JlID0gQ29yZTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgUmVzb3VyY2UgaW1wbGVtZW50cyBJUmVzb3VyY2Uge1xuICAgICAgICBwdWJsaWMgc2NoZW1hOiBJU2NoZW1hO1xuICAgICAgICBwcm90ZWN0ZWQgcGF0aDogc3RyaW5nOyAgIC8vIHdpdGhvdXQgc2xhc2hlc1xuXG4gICAgICAgIHB1YmxpYyBpc19uZXcgPSB0cnVlO1xuICAgICAgICBwdWJsaWMgdHlwZTogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgaWQ6IHN0cmluZztcbiAgICAgICAgcHVibGljIGF0dHJpYnV0ZXM6IGFueSA7XG4gICAgICAgIHB1YmxpYyByZWxhdGlvbnNoaXBzOiBhbnkgPSB7fTsgLy9bXTtcblxuICAgICAgICBwdWJsaWMgY2FjaGU6IE9iamVjdDtcbiAgICAgICAgcHVibGljIGNhY2hlX3ZhcnM6IE9iamVjdCA9IHt9O1xuXG4gICAgICAgIHB1YmxpYyBjbG9uZSgpOiBhbnkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3ICg8YW55PnRoaXMuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBhdHRyaWJ1dCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2F0dHJpYnV0XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xvbmVPYmpbYXR0cmlidXRdID0gdGhpc1thdHRyaWJ1dF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNsb25lT2JqO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIFJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgQHJldHVybiB0cnVlIGlmIHRoZSByZXNvdXJjZSBkb24ndCBleGlzdCBhbmQgcmVnaXN0ZXJlZCBva1xuICAgICAgICAqKi9cbiAgICAgICAgcHVibGljIHJlZ2lzdGVyKCk6IGJvb2xlYW4ge1xuICAgICAgICAgICAgaWYgKEpzb25hcGkuQ29yZS5NZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRocm93ICdFcnJvcjogeW91IGFyZSB0cnlpbmcgcmVnaXN0ZXIgLS0+ICcgKyB0aGlzLnR5cGUgKyAnIDwtLSBiZWZvcmUgaW5qZWN0IEpzb25hcGlDb3JlIHNvbWV3aGVyZSwgYWxtb3N0IG9uZSB0aW1lLic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBvbmx5IHdoZW4gc2VydmljZSBpcyByZWdpc3RlcmVkLCBub3QgY2xvbmVkIG9iamVjdFxuICAgICAgICAgICAgdGhpcy5jYWNoZSA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29yZS5NZS5fcmVnaXN0ZXIodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0UGF0aCgpOiBzdHJpbmcge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aCA/IHRoaXMucGF0aCA6IHRoaXMudHlwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIHB1YmxpYyBuZXc8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPigpOiBUIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLnJlc2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyB0b09iamVjdChwYXJhbXM/OiBKc29uYXBpLklQYXJhbXMpOiBJRGF0YU9iamVjdCB7XG4gICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcblxuICAgICAgICAgICAgbGV0IHJlbGF0aW9uc2hpcHMgPSB7IH07XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWQgPSBbIF07XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWRfaWRzID0gWyBdOyAvL2p1c3QgZm9yIGNvbnRyb2wgZG9uJ3QgcmVwZWF0IGFueSByZXNvdXJjZVxuXG4gICAgICAgICAgICAvLyBSRUFMVElPTlNISVBTXG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5yZWxhdGlvbnNoaXBzLCAocmVsYXRpb25zaGlwLCByZWxhdGlvbl9hbGlhcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdICYmIHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaGFzIG1hbnkgKGhhc01hbnk6dHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG5cbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCAocmVzb3VyY2U6IEpzb25hcGkuSVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVhdGlvbmFsX29iamVjdCA9IHsgaWQ6IHJlc291cmNlLmlkLCB0eXBlOiByZXNvdXJjZS50eXBlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXVsnZGF0YSddLnB1c2gocmVhdGlvbmFsX29iamVjdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGVtcG9yYWxfaWQgPSByZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uX2FsaWFzKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZXNvdXJjZS50b09iamVjdCh7IH0pLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgb25lIChoYXNNYW55OmZhbHNlKVxuICAgICAgICAgICAgICAgICAgICBpZiAoISgnaWQnIGluIHJlbGF0aW9uc2hpcC5kYXRhKSAmJiAhYW5ndWxhci5lcXVhbHMoe30sIHJlbGF0aW9uc2hpcC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKHJlbGF0aW9uX2FsaWFzICsgJyBkZWZpbmVkIHdpdGggaGFzTWFueTpmYWxzZSwgYnV0IEkgaGF2ZSBhIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAuZGF0YS5pZCAmJiByZWxhdGlvbnNoaXAuZGF0YS50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyBpZDogcmVsYXRpb25zaGlwLmRhdGEuaWQsIHR5cGU6IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgfSB9O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IHRlbXBvcmFsX2lkID0gcmVsYXRpb25zaGlwLmRhdGEudHlwZSArICdfJyArIHJlbGF0aW9uc2hpcC5kYXRhLmlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZWxhdGlvbnNoaXAuZGF0YS50b09iamVjdCh7IH0pLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxldCByZXQ6IElEYXRhT2JqZWN0ID0ge1xuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzOiByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGluY2x1ZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXQuaW5jbHVkZWQgPSBpbmNsdWRlZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQ8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihpZDogc3RyaW5nLCBwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogVCB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBkZWxldGUoaWQ6IHN0cmluZywgcGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvbik6IHZvaWQge1xuICAgICAgICAgICAgdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdkZWxldGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhbGw8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogQXJyYXk8VD4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZWxhdGlvbnNoaXBzPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocGFyZW50X3BhdGhfaWQ6IHN0cmluZyxcbiAgICAgICAgICAgIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb25cbiAgICAgICAgKTogQXJyYXk8VD4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKHBhcmVudF9wYXRoX2lkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0UmVsYXRpb25zaGlwcycpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHNhdmU8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogQXJyYXk8VD4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdzYXZlJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgVGhpcyBtZXRob2Qgc29ydCBwYXJhbXMgZm9yIG5ldygpLCBnZXQoKSBhbmQgdXBkYXRlKClcbiAgICAgICAgKi9cbiAgICAgICAgcHJpdmF0ZSBfX2V4ZWMoaWQ6IHN0cmluZywgcGFyYW1zOiBKc29uYXBpLklQYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGU6IHN0cmluZyk6IGFueSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfc3VjY2VzcykgPyBmY19zdWNjZXNzIDogZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgICAgICAgICB0aGlzLnNjaGVtYSA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuU2NoZW1hLCB0aGlzLnNjaGVtYSk7XG5cbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0KGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXRSZWxhdGlvbnNoaXBzJzpcbiAgICAgICAgICAgICAgICBwYXJhbXMucGF0aCA9IGlkO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVsZXRlKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2F2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2dldChpZDogc3RyaW5nLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogSVJlc291cmNlIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdID8gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdIDogdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogSUNvbGxlY3Rpb24geyAvLyBBcnJheTxJUmVzb3VyY2U+IHtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5wYXRoID8gcGF0aC5hZGRQYXRoKHBhcmFtcy5wYXRoKSA6IG51bGw7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCByZXNvdXJjZTogSUNvbGxlY3Rpb247XG5cbiAgICAgICAgICAgIHJlc291cmNlID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoe30sIHtcbiAgICAgICAgICAgICAgICAnJGxlbmd0aCc6IHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMpLmxlbmd0aDsgfSxcbiAgICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICckaXNsb2FkaW5nJzogeyB2YWx1ZTogZmFsc2UsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICckc291cmNlJzogeyB2YWx1ZTogJycsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIE1FTU9SWV9DQUNIRVxuICAgICAgICAgICAgLy8gKCFwYXJhbXMucGF0aCk6IGJlY291c2Ugd2UgbmVlZCByZWFsIHR5cGUsIG5vdCB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVxuICAgICAgICAgICAgaWYgKCFwYXJhbXMucGF0aCAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9PT0gdGhpcy5nZXRQYXRoKCkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBkb24ndCBtYWtlXG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdjYWNoZSc7XG4gICAgICAgICAgICAgICAgbGV0IGZpbHRlciA9IG5ldyBKc29uYXBpLkZpbHRlcigpO1xuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSwgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJhbXMuZmlsdGVyIHx8IGZpbHRlci5wYXNzRmlsdGVyKHZhbHVlLCBwYXJhbXMuZmlsdGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2Vba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlc291cmNlWyckaXNsb2FkaW5nJ10gPSB0cnVlO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdzZXJ2ZXInO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS4kaXNsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIENvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAgICghcGFyYW1zLnBhdGgpOiBmaWxsIGNhY2hlIG5lZWQgd29yayB3aXRoIHJlbGF0aW9uc2hpcHMgdG9vLFxuICAgICAgICAgICAgICAgICAgICBmb3IgdGhlIG1vbW1lbnQgd2UncmUgY3JlYXRlZCB0aGlzIGlmXG4gICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyYW1zLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpbHRlciBnZXR0ZWQgZGF0YVxuICAgICAgICAgICAgICAgICAgICBpZiAocGFyYW1zLmZpbHRlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGZpbHRlciA9IG5ldyBKc29uYXBpLkZpbHRlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZmlsdGVyLnBhc3NGaWx0ZXIodmFsdWUsIHBhcmFtcy5maWx0ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZXNvdXJjZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdzZXJ2ZXInO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS4kaXNsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9kZWxldGUoaWQ6IHN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IHZvaWQge1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG5cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgLmRlbGV0ZShwYXRoLmdldCgpKVxuICAgICAgICAgICAgLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXVsnaWQnXSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdWydhdHRyaWJ1dGVzJ10gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfc2F2ZShwYXJhbXM6IElQYXJhbXMsIGZjX3N1Y2Nlc3M6IEZ1bmN0aW9uLCBmY19lcnJvcjogRnVuY3Rpb24pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG5cbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKCdkYXRhJyBpbiBlcnJvciA/IGVycm9yLmRhdGEgOiBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFkZFJlbGF0aW9uc2hpcDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlOiBULCB0eXBlX2FsaWFzPzogc3RyaW5nKSB7XG4gICAgICAgICAgICBsZXQgb2JqZWN0X2tleSA9IHJlc291cmNlLmlkO1xuICAgICAgICAgICAgaWYgKCFvYmplY3Rfa2V5KSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0X2tleSA9ICduZXdfJyArIChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDApKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHlwZV9hbGlhcyA9ICh0eXBlX2FsaWFzID8gdHlwZV9hbGlhcyA6IHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7IH0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW29iamVjdF9rZXldID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWRkUmVsYXRpb25zaGlwczxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlczogQXJyYXk8VD4sIHR5cGVfYWxpYXM6IHN0cmluZykge1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7IH0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2FkZFJlbGF0aW9uc2hpcHMgbm90IHN1cHBvcnRlZCBvbiAnICsgdGhpcy50eXBlICsgJyBzY2hlbWEuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgcmVtb3ZlUmVsYXRpb25zaGlwKHR5cGVfYWxpYXM6IHN0cmluZywgaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoJ2RhdGEnIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShpZCBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11baWRdO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIGZpbGxDYWNoZShyZXNvdXJjZXMpIHtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZXMuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID0gdGhpcy5nZXRQYXRoKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZXMocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlUmVzb3VyY2VzPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2VzOiBBcnJheTxUPikge1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlcywgKHJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlUmVzb3VyY2U8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihyZXNvdXJjZTogVCkge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgQHJldHVybiBUaGlzIHJlc291cmNlIGxpa2UgYSBzZXJ2aWNlXG4gICAgICAgICoqL1xuICAgICAgICBwdWJsaWMgZ2V0U2VydmljZSgpOiBhbnkge1xuICAgICAgICAgICAgcmV0dXJuIENvbnZlcnRlci5nZXRTZXJ2aWNlKHRoaXMudHlwZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBSZXNvdXJjZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIFJlc291cmNlKCkge1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307IC8vW107XG4gICAgICAgICAgICB0aGlzLmNhY2hlX3ZhcnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIFJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgQHJldHVybiB0cnVlIGlmIHRoZSByZXNvdXJjZSBkb24ndCBleGlzdCBhbmQgcmVnaXN0ZXJlZCBva1xuICAgICAgICAqKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKEpzb25hcGkuQ29yZS5NZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRocm93ICdFcnJvcjogeW91IGFyZSB0cnlpbmcgcmVnaXN0ZXIgLS0+ICcgKyB0aGlzLnR5cGUgKyAnIDwtLSBiZWZvcmUgaW5qZWN0IEpzb25hcGlDb3JlIHNvbWV3aGVyZSwgYWxtb3N0IG9uZSB0aW1lLic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBvbmx5IHdoZW4gc2VydmljZSBpcyByZWdpc3RlcmVkLCBub3QgY2xvbmVkIG9iamVjdFxuICAgICAgICAgICAgdGhpcy5jYWNoZSA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29yZS5NZS5fcmVnaXN0ZXIodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aCA/IHRoaXMucGF0aCA6IHRoaXMudHlwZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLm5ldyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLnJlc2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMuaWQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLnNjaGVtYSA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuU2NoZW1hLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgdmFyIGluY2x1ZGVkID0gW107XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWRfaWRzID0gW107IC8vanVzdCBmb3IgY29udHJvbCBkb24ndCByZXBlYXQgYW55IHJlc291cmNlXG4gICAgICAgICAgICAvLyBSRUFMVElPTlNISVBTXG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAocmVsYXRpb25zaGlwLCByZWxhdGlvbl9hbGlhcykge1xuICAgICAgICAgICAgICAgIGlmIChfdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gJiYgX3RoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaGFzIG1hbnkgKGhhc01hbnk6dHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXAuZGF0YSwgZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVhdGlvbmFsX29iamVjdCA9IHsgaWQ6IHJlc291cmNlLmlkLCB0eXBlOiByZXNvdXJjZS50eXBlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXVsnZGF0YSddLnB1c2gocmVhdGlvbmFsX29iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXBvcmFsX2lkID0gcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbl9hbGlhcykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVzb3VyY2UudG9PYmplY3Qoe30pLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBvbmUgKGhhc01hbnk6ZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgIGlmICghKCdpZCcgaW4gcmVsYXRpb25zaGlwLmRhdGEpICYmICFhbmd1bGFyLmVxdWFscyh7fSwgcmVsYXRpb25zaGlwLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVsYXRpb25fYWxpYXMgKyAnIGRlZmluZWQgd2l0aCBoYXNNYW55OmZhbHNlLCBidXQgSSBoYXZlIGEgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXAuZGF0YS5pZCAmJiByZWxhdGlvbnNoaXAuZGF0YS50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyBpZDogcmVsYXRpb25zaGlwLmRhdGEuaWQsIHR5cGU6IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgfSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHt9IH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXBvcmFsX2lkID0gcmVsYXRpb25zaGlwLmRhdGEudHlwZSArICdfJyArIHJlbGF0aW9uc2hpcC5kYXRhLmlkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZWxhdGlvbnNoaXAuZGF0YS50b09iamVjdCh7fSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhciByZXQgPSB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXQuaW5jbHVkZWQgPSBpbmNsdWRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2RlbGV0ZScpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnYWxsJyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRSZWxhdGlvbnNoaXBzID0gZnVuY3Rpb24gKHBhcmVudF9wYXRoX2lkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMocGFyZW50X3BhdGhfaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXRSZWxhdGlvbnNoaXBzJyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnc2F2ZScpO1xuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgVGhpcyBtZXRob2Qgc29ydCBwYXJhbXMgZm9yIG5ldygpLCBnZXQoKSBhbmQgdXBkYXRlKClcbiAgICAgICAgKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9fZXhlYyA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgZXhlY190eXBlKSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0KGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXRSZWxhdGlvbnNoaXBzJzpcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnBhdGggPSBpZDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZGVsZXRlKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZShwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gPyB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gOiB0aGlzLm5ldygpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgX3RoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2FsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5wYXRoID8gcGF0aC5hZGRQYXRoKHBhcmFtcy5wYXRoKSA6IG51bGw7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgLy8gbWFrZSByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2U7XG4gICAgICAgICAgICByZXNvdXJjZSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHt9LCB7XG4gICAgICAgICAgICAgICAgJyRsZW5ndGgnOiB7XG4gICAgICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gT2JqZWN0LmtleXModGhpcykubGVuZ3RoOyB9LFxuICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgJyRpc2xvYWRpbmcnOiB7IHZhbHVlOiBmYWxzZSwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgJyRzb3VyY2UnOiB7IHZhbHVlOiAnJywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gTUVNT1JZX0NBQ0hFXG4gICAgICAgICAgICAvLyAoIXBhcmFtcy5wYXRoKTogYmVjb3VzZSB3ZSBuZWVkIHJlYWwgdHlwZSwgbm90IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlXG4gICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID09PSB0aGlzLmdldFBhdGgoKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IG1ha2VcbiAgICAgICAgICAgICAgICByZXNvdXJjZS4kc291cmNlID0gJ2NhY2hlJztcbiAgICAgICAgICAgICAgICB2YXIgZmlsdGVyXzEgPSBuZXcgSnNvbmFwaS5GaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyYW1zLmZpbHRlciB8fCBmaWx0ZXJfMS5wYXNzRmlsdGVyKHZhbHVlLCBwYXJhbXMuZmlsdGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2Vba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvdXJjZVsnJGlzbG9hZGluZyddID0gdHJ1ZTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHJlc291cmNlLiRzb3VyY2UgPSAnc2VydmVyJztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS4kaXNsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgX3RoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICghcGFyYW1zLnBhdGgpOiBmaWxsIGNhY2hlIG5lZWQgd29yayB3aXRoIHJlbGF0aW9uc2hpcHMgdG9vLFxuICAgICAgICAgICAgICAgIGZvciB0aGUgbW9tbWVudCB3ZSdyZSBjcmVhdGVkIHRoaXMgaWZcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGlmICghcGFyYW1zLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuZmlsbENhY2hlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gZmlsdGVyIGdldHRlZCBkYXRhXG4gICAgICAgICAgICAgICAgaWYgKHBhcmFtcy5maWx0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbHRlcl8yID0gbmV3IEpzb25hcGkuRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvdXJjZSwgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZmlsdGVyXzIucGFzc0ZpbHRlcih2YWx1ZSwgcGFyYW1zLmZpbHRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgcmVzb3VyY2Vba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS4kc291cmNlID0gJ3NlcnZlcic7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuJGlzbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2RlbGV0ZSA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmRlbGV0ZShwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgaWYgKF90aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiBfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF1bJ2lkJ10gPSAnJztcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXVsnYXR0cmlidXRlcyddID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIF90aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9zYXZlID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBvYmplY3QgPSB0aGlzLnRvT2JqZWN0KHBhcmFtcyk7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgdGhpcy5pZCAmJiBwYXRoLmFkZFBhdGgodGhpcy5pZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5uZXcoKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmV4ZWMocGF0aC5nZXQoKSwgdGhpcy5pZCA/ICdQVVQnIDogJ1BPU1QnLCBvYmplY3QpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoJ2RhdGEnIGluIGVycm9yID8gZXJyb3IuZGF0YSA6IGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuYWRkUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHJlc291cmNlLCB0eXBlX2FsaWFzKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0X2tleSA9IHJlc291cmNlLmlkO1xuICAgICAgICAgICAgaWYgKCFvYmplY3Rfa2V5KSB7XG4gICAgICAgICAgICAgICAgb2JqZWN0X2tleSA9ICduZXdfJyArIChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtvYmplY3Rfa2V5XSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFkZFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAocmVzb3VyY2VzLCB0eXBlX2FsaWFzKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7fSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2FkZFJlbGF0aW9uc2hpcHMgbm90IHN1cHBvcnRlZCBvbiAnICsgdGhpcy50eXBlICsgJyBzY2hlbWEuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlbW92ZVJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uICh0eXBlX2FsaWFzLCBpZCkge1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoJ2RhdGEnIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIShpZCBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11baWRdO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5maWxsQ2FjaGUgPSBmdW5jdGlvbiAocmVzb3VyY2VzKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VzLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVfdmFyc1snX19wYXRoJ10gPSB0aGlzLmdldFBhdGgoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlcyhyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZmlsbENhY2hlUmVzb3VyY2VzID0gZnVuY3Rpb24gKHJlc291cmNlcykge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIF90aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZmlsbENhY2hlUmVzb3VyY2UgPSBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZS5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgQHJldHVybiBUaGlzIHJlc291cmNlIGxpa2UgYSBzZXJ2aWNlXG4gICAgICAgICoqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0U2VydmljZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKHRoaXMudHlwZSk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBSZXNvdXJjZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUmVzb3VyY2UgPSBSZXNvdXJjZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cblxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3BhcmFtcy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9lcnJvcnMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvbGlua3MuZC50c1wiLz5cblxuLy8gUGFyYW1ldGVycyBmb3IgVFMtSnNvbmFwaSBDbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3NjaGVtYS5kLnRzXCIvPlxuXG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvYmFzZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2ZpbHRlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHNcIi8+XG4vLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY29yZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3Jlc291cmNlLnRzXCIvPlxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2Jhc2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9maWx0ZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtY29udmVydGVyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29yZVNlcnZpY2VzIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpSHR0cFxuICAgICAgICApIHtcblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZVNlcnZpY2VzJywgQ29yZVNlcnZpY2VzKTtcbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvcmVTZXJ2aWNlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZVNlcnZpY2VzKEpzb25hcGlIdHRwKSB7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlIdHRwID0gSnNvbmFwaUh0dHA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENvcmVTZXJ2aWNlcztcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZVNlcnZpY2VzID0gQ29yZVNlcnZpY2VzO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVBhcnNlciB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyB0b09iamVjdChqc29uX3N0cmluZzogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ganNvbl9zdHJpbmc7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpUGFyc2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBKc29uYXBpUGFyc2VyKCkge1xuICAgICAgICB9XG4gICAgICAgIEpzb25hcGlQYXJzZXIucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKGpzb25fc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ganNvbl9zdHJpbmc7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBKc29uYXBpUGFyc2VyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpUGFyc2VyID0gSnNvbmFwaVBhcnNlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBKc29uYXBpU3RvcmFnZSB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICAvLyBwcm90ZWN0ZWQgc3RvcmUsXG4gICAgICAgICAgICAvLyBwcm90ZWN0ZWQgUmVhbEpzb25hcGlcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQoa2V5KSB7XG4gICAgICAgICAgICAvKiBsZXQgZGF0YSA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5mcm9tSnNvbihkYXRhKTsqL1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIG1lcmdlKGtleSwgZGF0YSkge1xuICAgICAgICAgICAgLyogbGV0IGFjdHVhbF9kYXRhID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGxldCBhY3R1YWxfaW5mbyA9IGFuZ3VsYXIuZnJvbUpzb24oYWN0dWFsX2RhdGEpOyAqL1xuXG5cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEpzb25hcGlTdG9yYWdlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBKc29uYXBpU3RvcmFnZSgpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpU3RvcmFnZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfTtcbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLm1lcmdlID0gZnVuY3Rpb24gKGtleSwgZGF0YSkge1xuICAgICAgICAgICAgLyogbGV0IGFjdHVhbF9kYXRhID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGxldCBhY3R1YWxfaW5mbyA9IGFuZ3VsYXIuZnJvbUpzb24oYWN0dWFsX2RhdGEpOyAqL1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVN0b3JhZ2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkpzb25hcGlTdG9yYWdlID0gSnNvbmFwaVN0b3JhZ2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
