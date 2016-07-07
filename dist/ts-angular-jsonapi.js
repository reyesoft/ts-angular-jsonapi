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
            // (!params.path): becouse we need real type, not this.getService().cache
            if (!params.path && this.getService().cache && this.getService().cache_vars['__path'] === this.getPath()) {
                // we don't make
                resource.$source = 'cache';
                angular.forEach(this.getService().cache, function (value, key) {
                    resource[key] = value;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvYmFzZS50cyIsInNlcnZpY2VzL2Jhc2UuanMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9wYXRoLW1ha2VyLnRzIiwic2VydmljZXMvcGF0aC1tYWtlci5qcyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci5qcyIsImNvcmUudHMiLCJjb3JlLmpzIiwicmVzb3VyY2UudHMiLCJyZXNvdXJjZS5qcyIsIl9hbGwudHMiLCJfYWxsLmpzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsQ0FBQyxVQUFVLFNBQU87O0lBRWQsUUFBUSxPQUFPLGtCQUFrQjtTQUNoQyxTQUFTLG1CQUFtQjtRQUN6QixLQUFLO1FBQ0wsT0FBTztRQUNQLG1CQUFtQjtRQUNuQixtQkFBbUI7O0lBR3ZCLFFBQVEsT0FBTyxvQkFBb0I7SUFFbkMsUUFBUSxPQUFPLGFBQWE7UUFDeEI7UUFDQTtRQUNBOztHQUdMO0FDSEg7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7UUFBQSxTQUFBLE9BQUE7O1FBQ1csS0FBQSxTQUEwQjtZQUM3QixJQUFJO1lBQ0osU0FBUzs7UUFHTixLQUFBLFNBQVM7WUFDWixZQUFZO1lBQ1osZUFBZTs7UUFFdkIsT0FBQTs7SUFWYSxRQUFBLE9BQUk7R0FEZCxZQUFBLFVBQU87QUNpQmQ7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7OztRQUdJLFNBQUEsS0FDYyxPQUNBLFVBQ0EsaUJBQ0EsSUFBRTtZQUhGLEtBQUEsUUFBQTtZQUNBLEtBQUEsV0FBQTtZQUNBLEtBQUEsa0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLFNBQVAsVUFBYyxNQUFZO1lBQ3RCLE9BQU8sS0FBSyxLQUFLLE1BQU07O1FBR3BCLEtBQUEsVUFBQSxNQUFQLFVBQVcsTUFBWTtZQUNuQixPQUFPLEtBQUssS0FBSyxNQUFNOztRQUdqQixLQUFBLFVBQUEsT0FBVixVQUFlLE1BQWMsUUFBZ0IsTUFBMEI7WUFDbkUsSUFBSSxNQUFNO2dCQUNOLFFBQVE7Z0JBQ1IsS0FBSyxLQUFLLGdCQUFnQixNQUFNO2dCQUNoQyxTQUFTO29CQUNMLGdCQUFnQjs7O1lBR3hCLFNBQVMsSUFBSSxVQUFVO1lBQ3ZCLElBQUksVUFBVSxLQUFLLE1BQU07WUFFekIsSUFBSSxXQUFXLEtBQUssR0FBRztZQUN2QixJQUFJLE9BQU87WUFDWCxRQUFRLEtBQUssR0FBRyxnQkFBZ0I7WUFDaEMsUUFBUSxLQUNKLFVBQUEsU0FBTzs7Z0JBRUgsS0FBSyxTQUFVLFlBQUE7b0JBQ1gsUUFBUSxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7b0JBQ2pDLFNBQVMsUUFBUTttQkFDbEIsS0FBSyxnQkFBZ0I7ZUFFNUIsVUFBQSxPQUFLO2dCQUNELFFBQVEsS0FBSyxHQUFHLGdCQUFnQixDQUFDO2dCQUNqQyxJQUFJLE1BQU0sVUFBVSxHQUFHOztvQkFFbkIsSUFBSSxDQUFDLFFBQVEsS0FBSyxHQUFHLGdCQUFnQixRQUFRO3dCQUN6QyxRQUFRLEtBQUssNkVBQTZFOzs7cUJBRTNGO29CQUNILElBQUksQ0FBQyxRQUFRLEtBQUssR0FBRyxjQUFjLFFBQVE7d0JBQ3ZDLFFBQVEsS0FBSywyRUFBMkU7OztnQkFHaEcsU0FBUyxPQUFPOztZQUd4QixPQUFPLFNBQVM7O1FBRXhCLE9BQUE7O0lBM0RhLFFBQUEsT0FBSTtJQTREakIsUUFBUSxPQUFPLG9CQUFvQixRQUFRLGVBQWU7R0E3RHZELFlBQUEsVUFBTztBQ3lEZDtBQ3pEQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGFBQUEsWUFBQTtRQUFBLFNBQUEsWUFBQTtZQUNXLEtBQUEsUUFBdUI7WUFDdkIsS0FBQSxXQUEwQjs7UUFFMUIsVUFBQSxVQUFBLFVBQVAsVUFBZSxPQUFhO1lBQ3hCLEtBQUssTUFBTSxLQUFLOztRQUdiLFVBQUEsVUFBQSxhQUFQLFVBQWtCLGVBQTRCO1lBQzFDLEtBQUssV0FBVzs7UUFHYixVQUFBLFVBQUEsTUFBUCxZQUFBO1lBQ0ksSUFBSSxhQUE0QjtZQUVoQyxJQUFJLEtBQUssU0FBUyxTQUFTLEdBQUc7Z0JBQzFCLFdBQVcsS0FBSyxhQUFhLEtBQUssU0FBUyxLQUFLOztZQUdwRCxPQUFPLEtBQUssTUFBTSxLQUFLO2lCQUNsQixXQUFXLFNBQVMsSUFBSSxNQUFNLFdBQVcsS0FBSyxPQUFPOztRQUVsRSxPQUFBOztJQXRCYSxRQUFBLFlBQVM7R0FEbkIsWUFBQSxVQUFPO0FDeUJkO0FDekJBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsYUFBQSxZQUFBO1FBQUEsU0FBQSxZQUFBOzs7OztRQUtXLFVBQUEsNkJBQVAsVUFDSSxZQUNBO1lBQ0EsZ0JBQXNCO1lBQXRCLElBQUEsbUJBQUEsS0FBQSxHQUFzQixFQUF0QixpQkFBQTtZQUVBLElBQUksQ0FBQyxtQkFBbUI7Z0JBQ3BCLG9CQUFvQjs7WUFFeEIsSUFBSSxRQUFRO1lBQ1osS0FBaUIsSUFBQSxLQUFBLEdBQUEsZUFBQSxZQUFBLEtBQUEsYUFBQSxRQUFBLE1BQVc7Z0JBQXZCLElBQUksT0FBSSxhQUFBO2dCQUNULElBQUksV0FBVyxRQUFRLFVBQVUsY0FBYyxNQUFNO2dCQUNyRCxJQUFJLGdCQUFnQjtvQkFDaEIsa0JBQWtCLFNBQVMsTUFBTTs7cUJBQzlCOztvQkFFSCxrQkFBa0IsU0FBUyxPQUFPLE1BQU0sU0FBUyxNQUFNOztnQkFHM0Q7OztZQUdKLE9BQU87Ozs7O1FBTUosVUFBQSxxQ0FBUCxVQUNJLFlBQ0Esd0JBQStCO1lBRS9CLElBQUksZ0JBQW9CO1lBQ3hCLFVBQVUsMkJBQTJCLFlBQVksZUFBZTtZQUNoRSxJQUFJLFlBQVk7WUFDaEIsUUFBUSxRQUFRLGVBQWUsVUFBQyxVQUFRO2dCQUNwQyxJQUFJLEVBQUUsU0FBUyxRQUFRLFlBQVk7b0JBQy9CLFVBQVUsU0FBUyxRQUFROztnQkFFL0IsVUFBVSxTQUFTLE1BQU0sU0FBUyxNQUFNOztZQUU1QyxPQUFPOztRQUdKLFVBQUEsZ0JBQVAsVUFBcUIsZUFBc0Msd0JBQXNCO1lBQzdFLElBQUksbUJBQW1CLFFBQVEsVUFBVSxXQUFXLGNBQWM7WUFDbEUsSUFBSSxrQkFBa0I7Z0JBQ2xCLE9BQU8sUUFBUSxVQUFVLFVBQVUsa0JBQWtCOztpQkFDbEQ7O2dCQUVILFFBQVEsS0FBSyxNQUFNLGNBQWMsT0FBTyxLQUFLO2dCQUM3QyxJQUFJLE9BQU8sSUFBSSxRQUFRO2dCQUN2QixLQUFLLEtBQUssY0FBYztnQkFDeEIsS0FBSyxPQUFPLGNBQWM7Z0JBQzFCLE9BQU87OztRQUlSLFVBQUEsYUFBUCxVQUFrQixNQUFZO1lBQzFCLElBQUksbUJBQW1CLFFBQVEsS0FBSyxHQUFHLFlBQVk7WUFDbkQsSUFBSSxRQUFRLFlBQVksbUJBQW1CO2dCQUN2QyxRQUFRLEtBQUssTUFBTSxPQUFPLEtBQUs7O1lBRW5DLE9BQU87OztRQUlKLFVBQUEsWUFBUCxVQUFpQixrQkFBcUMsTUFBMkI7WUFDN0UsSUFBSSxFQUFFLFVBQVUsUUFBUSxRQUFRLE9BQU87Z0JBQ25DLFFBQVEsTUFBTSxtQ0FBbUM7O1lBRXJELElBQUksV0FBVyxJQUFVLGlCQUFpQjtZQUMxQyxTQUFTO1lBQ1QsU0FBUyxLQUFLLEtBQUs7WUFDbkIsU0FBUyxhQUFhLEtBQUssYUFBYSxLQUFLLGFBQWE7WUFDMUQsU0FBUyxTQUFTO1lBQ2xCLE9BQU87O1FBR0osVUFBQSxRQUFQLFVBQWEsZUFBb0IsZUFBb0IsUUFBZTs7WUFFaEUsSUFBSSxXQUFXO1lBQ2YsSUFBSSxjQUFjLGVBQWU7Z0JBQzdCLFdBQVcsVUFBVSxtQ0FBbUMsY0FBYyxVQUFVOztZQUdwRixJQUFJLFFBQVEsUUFBUSxjQUFjLE9BQU87Z0JBQ3JDLFVBQVUsZ0JBQWdCLGVBQWUsZUFBZSxRQUFROztpQkFDN0Q7Z0JBQ0gsVUFBVSxlQUFlLGNBQWMsTUFBTSxlQUFlLFFBQVE7OztRQUlyRSxVQUFBLGtCQUFQLFVBQXVCLGVBQWdDLGVBQXVDLFFBQWlCLFVBQVE7WUFDbkgsS0FBaUIsSUFBQSxLQUFBLEdBQUEsS0FBQSxjQUFjLE1BQWQsS0FBQSxHQUFBLFFBQUEsTUFBbUI7Z0JBQS9CLElBQUksT0FBSSxHQUFBO2dCQUNULElBQUksV0FBVyxRQUFRLFVBQVUsV0FBVyxLQUFLO2dCQUNqRCxJQUFJLEVBQUUsS0FBSyxNQUFNLGdCQUFnQjtvQkFDN0IsY0FBYyxLQUFLLE1BQU0sSUFBVSxTQUFTO29CQUM1QyxjQUFjLEtBQUssSUFBSTs7Z0JBRTNCLFVBQVUsZUFBZSxNQUFNLGNBQWMsS0FBSyxLQUFLLFFBQVE7OztRQUloRSxVQUFBLGlCQUFQLFVBQXNCLGVBQThCLGVBQTBCLFFBQWlCLFVBQVE7WUFDbkcsY0FBYyxhQUFhLGNBQWM7WUFDekMsY0FBYyxLQUFLLGNBQWM7WUFDakMsY0FBYyxTQUFTO1lBQ3ZCLFVBQVUscUJBQXFCLGNBQWMsZUFBZSxjQUFjLGVBQWUsVUFBVTs7UUFHaEcsVUFBQSx1QkFBUCxVQUE0QixvQkFBZ0Msb0JBQWdDLGdCQUFnQixRQUFlOztZQUV2SCxRQUFRLFFBQVEsb0JBQW9CLFVBQUMsZ0JBQWdCLGNBQVk7O2dCQUc3RCxJQUFJLEVBQUUsZ0JBQWdCLHdCQUF3QixVQUFVLGlCQUFpQjtvQkFDckUsbUJBQW1CLGdCQUFnQixFQUFFLE1BQU07OztnQkFJL0MsSUFBSSxDQUFDLGVBQWU7b0JBQ2hCO2dCQUVKLElBQUksT0FBTyxjQUFjLGlCQUFpQixPQUFPLGNBQWMsY0FBYyxTQUFTO29CQUNsRixJQUFJLGVBQWUsS0FBSyxTQUFTO3dCQUM3QjtvQkFDSixJQUFJLG1CQUFtQixRQUFRLFVBQVUsV0FBVyxlQUFlLEtBQUssR0FBRztvQkFDM0UsSUFBSSxrQkFBa0I7d0JBQ2xCLG1CQUFtQixjQUFjLE9BQU87d0JBQ3hDLFFBQVEsUUFBUSxlQUFlLE1BQU0sVUFBQyxnQkFBcUM7NEJBQ3ZFLElBQUksTUFBTSxVQUFVLG9CQUFvQixnQkFBZ0I7NEJBQ3hELG1CQUFtQixjQUFjLEtBQUssSUFBSSxNQUFNOzs7O3FCQUdyRDtvQkFDSCxtQkFBbUIsY0FBYyxPQUFPLFVBQVUsb0JBQW9CLGVBQWUsTUFBTTs7OztRQUtoRyxVQUFBLHNCQUFQLFVBQTJCLFVBQWlDLGdCQUFjO1lBQ3RFLElBQUksU0FBUyxRQUFRO2dCQUNqQixTQUFTLE1BQU0sZUFBZSxTQUFTLE9BQ3pDOztnQkFFRSxPQUFPLGVBQWUsU0FBUyxNQUFNLFNBQVM7O2lCQUMzQzs7Z0JBRUgsT0FBTzs7O1FBUW5CLE9BQUE7O0lBakthLFFBQUEsWUFBUztHQURuQixZQUFBLFVBQU87QUNzSmQ7QUN0SkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7OztRQWNJLFNBQUEsS0FDYyxpQkFDQSxxQkFBbUI7WUFEbkIsS0FBQSxrQkFBQTtZQUNBLEtBQUEsc0JBQUE7WUFmUCxLQUFBLFdBQW1CO1lBQ25CLEtBQUEsWUFBc0M7WUFFdEMsS0FBQSxrQkFBMEI7WUFDMUIsS0FBQSxnQkFBZ0IsWUFBQTtZQUNoQixLQUFBLGVBQWUsWUFBQTtZQUNmLEtBQUEsZ0JBQWdCLFlBQUE7WUFDaEIsS0FBQSxrQkFBa0IsWUFBQTtZQVVyQixRQUFRLEtBQUssS0FBSztZQUNsQixRQUFRLEtBQUssV0FBVzs7UUFHckIsS0FBQSxVQUFBLFlBQVAsVUFBaUIsT0FBSztZQUNsQixJQUFJLE1BQU0sUUFBUSxLQUFLLFdBQVc7Z0JBQzlCLE9BQU87O1lBRVgsS0FBSyxVQUFVLE1BQU0sUUFBUTtZQUM3QixPQUFPOztRQUdKLEtBQUEsVUFBQSxjQUFQLFVBQW1CLE1BQVk7WUFDM0IsT0FBTyxLQUFLLFVBQVU7O1FBR25CLEtBQUEsVUFBQSxrQkFBUCxVQUF1QixRQUFjO1lBQ2pDLEtBQUssbUJBQW1CO1lBQ3hCLElBQUksS0FBSyxvQkFBb0IsR0FBRztnQkFDNUIsS0FBSzs7aUJBQ0YsSUFBSSxLQUFLLG9CQUFvQixHQUFHO2dCQUNuQyxLQUFLOzs7UUE3QkMsS0FBQSxLQUFvQjtRQUNwQixLQUFBLFdBQWdCO1FBK0JsQyxPQUFBOztJQTFDYSxRQUFBLE9BQUk7SUEyQ2pCLFFBQVEsT0FBTyxvQkFBb0IsUUFBUSxlQUFlO0dBNUN2RCxZQUFBLFVBQU87QUMyQ2Q7QUMzQ0EsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxZQUFBLFlBQUE7UUFBQSxTQUFBLFdBQUE7WUFJVyxLQUFBLFNBQVM7WUFJVCxLQUFBLGdCQUFxQjtZQUdyQixLQUFBLGFBQXFCOztRQUVyQixTQUFBLFVBQUEsUUFBUCxZQUFBO1lBQ0ksSUFBSSxXQUFXLElBQVUsS0FBSztZQUM5QixLQUFLLElBQUksWUFBWSxNQUFNO2dCQUN2QixJQUFJLE9BQU8sS0FBSyxjQUFjLFVBQVU7b0JBQ3BDLFNBQVMsWUFBWSxLQUFLOzs7WUFHbEMsT0FBTzs7Ozs7O1FBT0osU0FBQSxVQUFBLFdBQVAsWUFBQTtZQUNJLElBQUksUUFBUSxLQUFLLE9BQU8sTUFBTTtnQkFDMUIsTUFBTSx3Q0FBd0MsS0FBSyxPQUFPOzs7WUFHOUQsS0FBSyxRQUFRO1lBQ2IsT0FBTyxRQUFRLEtBQUssR0FBRyxVQUFVOztRQUc5QixTQUFBLFVBQUEsVUFBUCxZQUFBO1lBQ0ksT0FBTyxLQUFLLE9BQU8sS0FBSyxPQUFPLEtBQUs7OztRQUlqQyxTQUFBLFVBQUEsTUFBUCxZQUFBO1lBQ0ksSUFBSSxXQUFXLEtBQUs7WUFDcEIsU0FBUztZQUNULE9BQU87O1FBR0osU0FBQSxVQUFBLFFBQVAsWUFBQTtZQUNJLElBQUksT0FBTztZQUNYLEtBQUssS0FBSztZQUNWLEtBQUssYUFBYTtZQUNsQixLQUFLLGdCQUFnQjtZQUNyQixRQUFRLFFBQVEsS0FBSyxPQUFPLGVBQWUsVUFBQyxPQUFPLEtBQUc7Z0JBQ2xELEtBQUssY0FBYyxPQUFPO2dCQUMxQixLQUFLLGNBQWMsS0FBSyxVQUFVOztZQUV0QyxLQUFLLFNBQVM7O1FBR1gsU0FBQSxVQUFBLFdBQVAsVUFBZ0IsUUFBd0I7WUFBeEMsSUFBQSxRQUFBO1lBQ0ksU0FBUyxRQUFRLE9BQU8sSUFBSSxRQUFRLEtBQUssUUFBUTtZQUNqRCxLQUFLLFNBQVMsUUFBUSxPQUFPLElBQUksUUFBUSxLQUFLLFFBQVEsS0FBSztZQUUzRCxJQUFJLGdCQUFnQjtZQUNwQixJQUFJLFdBQVc7WUFDZixJQUFJLGVBQWU7O1lBR25CLFFBQVEsUUFBUSxLQUFLLGVBQWUsVUFBQyxjQUFjLGdCQUFjO2dCQUU3RCxJQUFJLE1BQUssT0FBTyxjQUFjLG1CQUFtQixNQUFLLE9BQU8sY0FBYyxnQkFBZ0IsU0FBUzs7b0JBRWhHLGNBQWMsa0JBQWtCLEVBQUUsTUFBTTtvQkFFeEMsUUFBUSxRQUFRLGFBQWEsTUFBTSxVQUFDLFVBQTJCO3dCQUMzRCxJQUFJLG1CQUFtQixFQUFFLElBQUksU0FBUyxJQUFJLE1BQU0sU0FBUzt3QkFDekQsY0FBYyxnQkFBZ0IsUUFBUSxLQUFLOzt3QkFHM0MsSUFBSSxjQUFjLFNBQVMsT0FBTyxNQUFNLFNBQVM7d0JBQ2pELElBQUksYUFBYSxRQUFRLGlCQUFpQixDQUFDLEtBQUssT0FBTyxRQUFRLFFBQVEsb0JBQW9CLENBQUMsR0FBRzs0QkFDM0YsYUFBYSxLQUFLOzRCQUNsQixTQUFTLEtBQUssU0FBUyxTQUFTLElBQUs7Ozs7cUJBRzFDOztvQkFFSCxJQUFJLEVBQUUsUUFBUSxhQUFhLFNBQVMsQ0FBQyxRQUFRLE9BQU8sSUFBSSxhQUFhLE9BQU87d0JBQ3hFLFFBQVEsS0FBSyxpQkFBaUI7O29CQUdsQyxJQUFJLGFBQWEsS0FBSyxNQUFNLGFBQWEsS0FBSyxNQUFNO3dCQUNoRCxjQUFjLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxJQUFJLGFBQWEsS0FBSyxJQUFJLE1BQU0sYUFBYSxLQUFLOzt5QkFDekY7d0JBQ0gsY0FBYyxrQkFBa0IsRUFBRSxNQUFNOzs7b0JBSTVDLElBQUksY0FBYyxhQUFhLEtBQUssT0FBTyxNQUFNLGFBQWEsS0FBSztvQkFDbkUsSUFBSSxhQUFhLFFBQVEsaUJBQWlCLENBQUMsS0FBSyxPQUFPLFFBQVEsUUFBUSxhQUFhLEtBQUssVUFBVSxDQUFDLEdBQUc7d0JBQ25HLGFBQWEsS0FBSzt3QkFDbEIsU0FBUyxLQUFLLGFBQWEsS0FBSyxTQUFTLElBQUs7Ozs7WUFLMUQsSUFBSSxNQUFtQjtnQkFDbkIsTUFBTTtvQkFDRixNQUFNLEtBQUs7b0JBQ1gsSUFBSSxLQUFLO29CQUNULFlBQVksS0FBSztvQkFDakIsZUFBZTs7O1lBSXZCLElBQUksU0FBUyxTQUFTLEdBQUc7Z0JBQ3JCLElBQUksV0FBVzs7WUFHbkIsT0FBTzs7UUFHSixTQUFBLFVBQUEsTUFBUCxVQUF3QyxJQUFZLFFBQTRCLFlBQXVCLFVBQW1CO1lBQ3RILE9BQU8sS0FBSyxPQUFPLElBQUksUUFBUSxZQUFZLFVBQVU7O1FBR2xELFNBQUEsVUFBQSxTQUFQLFVBQWMsSUFBWSxRQUE0QixZQUF1QixVQUFtQjtZQUM1RixLQUFLLE9BQU8sSUFBSSxRQUFRLFlBQVksVUFBVTs7UUFHM0MsU0FBQSxVQUFBLE1BQVAsVUFBd0MsUUFBNEIsWUFBdUIsVUFBbUI7WUFDMUcsT0FBTyxLQUFLLE9BQU8sTUFBTSxRQUFRLFlBQVksVUFBVTs7UUFHcEQsU0FBQSxVQUFBLG1CQUFQLFVBQXFELGdCQUNqRCxRQUE0QixZQUF1QixVQUFtQjtZQUV0RSxPQUFPLEtBQUssT0FBTyxnQkFBZ0IsUUFBUSxZQUFZLFVBQVU7O1FBRzlELFNBQUEsVUFBQSxPQUFQLFVBQXlDLFFBQTRCLFlBQXVCLFVBQW1CO1lBQzNHLE9BQU8sS0FBSyxPQUFPLE1BQU0sUUFBUSxZQUFZLFVBQVU7Ozs7O1FBTW5ELFNBQUEsVUFBQSxTQUFSLFVBQWUsSUFBWSxRQUF5QixZQUFZLFVBQVUsV0FBaUI7O1lBRXZGLElBQUksUUFBUSxXQUFXLFNBQVM7Z0JBQzVCLFdBQVc7Z0JBQ1gsYUFBYTtnQkFDYixTQUFTLFFBQVEsT0FBTyxJQUFJLFFBQVEsS0FBSzs7aUJBQ3RDO2dCQUNILElBQUksUUFBUSxZQUFZLFNBQVM7b0JBQzdCLFNBQVMsUUFBUSxPQUFPLElBQUksUUFBUSxLQUFLOztxQkFDdEM7b0JBQ0gsU0FBUyxRQUFRLE9BQU8sSUFBSSxRQUFRLEtBQUssUUFBUTs7O1lBSXpELGFBQWEsUUFBUSxXQUFXLGNBQWMsYUFBYSxZQUFBO1lBQzNELFdBQVcsUUFBUSxXQUFXLFlBQVksV0FBVyxZQUFBO1lBRXJELEtBQUssU0FBUyxRQUFRLE9BQU8sSUFBSSxRQUFRLEtBQUssUUFBUSxLQUFLO1lBRTNELFFBQVE7Z0JBQ0osS0FBSztvQkFDTCxPQUFPLEtBQUssS0FBSyxJQUFJLFFBQVEsWUFBWTtnQkFDekMsS0FBSztvQkFDTCxPQUFPLE9BQU87b0JBQ2QsT0FBTyxLQUFLLEtBQUssUUFBUSxZQUFZO2dCQUNyQyxLQUFLO29CQUNMLE9BQU8sS0FBSyxRQUFRLElBQUksUUFBUSxZQUFZO2dCQUM1QyxLQUFLO29CQUNMLE9BQU8sS0FBSyxLQUFLLFFBQVEsWUFBWTtnQkFDckMsS0FBSztvQkFDTCxPQUFPLEtBQUssTUFBTSxRQUFRLFlBQVk7OztRQUl2QyxTQUFBLFVBQUEsT0FBUCxVQUFZLElBQVksUUFBUSxZQUFZLFVBQVE7WUFBcEQsSUFBQSxRQUFBOztZQUVJLElBQUksT0FBTyxJQUFJLFFBQVE7WUFDdkIsS0FBSyxRQUFRLEtBQUs7WUFDbEIsS0FBSyxRQUFRO1lBQ2IsT0FBTyxVQUFVLEtBQUssV0FBVyxPQUFPLFdBQVc7WUFFbkQsSUFBSSxXQUFXLEtBQUssYUFBYSxTQUFTLEtBQUssYUFBYSxNQUFNLE1BQU0sS0FBSyxhQUFhLE1BQU0sTUFBTSxLQUFLO1lBRTNHLFFBQVEsS0FBSyxTQUFTO2lCQUNyQixJQUFJLEtBQUs7aUJBQ1QsS0FDRyxVQUFBLFNBQU87Z0JBQ0gsUUFBQSxVQUFVLE1BQU0sUUFBUSxNQUFNLFVBQVUsTUFBSztnQkFDN0MsTUFBSyxrQkFBa0I7Z0JBQ3ZCLFdBQVc7ZUFFZixVQUFBLE9BQUs7Z0JBQ0QsU0FBUzs7WUFJakIsT0FBTzs7UUFHSixTQUFBLFVBQUEsT0FBUCxVQUFZLFFBQVEsWUFBWSxVQUFRO1lBQXhDLElBQUEsUUFBQTs7WUFHSSxJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLE9BQU8sT0FBTyxLQUFLLFFBQVEsT0FBTyxRQUFRO1lBQzFDLE9BQU8sVUFBVSxLQUFLLFdBQVcsT0FBTyxXQUFXOztZQUduRCxJQUFJO1lBRUosV0FBVyxPQUFPLGlCQUFpQixJQUFJO2dCQUNuQyxXQUFXO29CQUNQLEtBQUssWUFBQSxFQUFhLE9BQU8sT0FBTyxLQUFLLE1BQU07b0JBQzNDLFlBQVk7O2dCQUVoQixjQUFjLEVBQUUsT0FBTyxPQUFPLFlBQVksT0FBTyxVQUFVO2dCQUMzRCxXQUFXLEVBQUUsT0FBTyxJQUFJLFlBQVksT0FBTyxVQUFVOzs7WUFJekQsSUFBSSxDQUFDLE9BQU8sUUFBUSxLQUFLLGFBQWEsU0FBUyxLQUFLLGFBQWEsV0FBVyxjQUFjLEtBQUssV0FBVzs7Z0JBRXRHLFNBQVMsVUFBVTtnQkFDbkIsUUFBUSxRQUFRLEtBQUssYUFBYSxPQUFPLFVBQUMsT0FBTyxLQUFHO29CQUNoRCxTQUFTLE9BQU87OztZQUl4QixTQUFTLGdCQUFnQjtZQUN6QixRQUFRLEtBQUssU0FBUztpQkFDckIsSUFBSSxLQUFLO2lCQUNULEtBQ0csVUFBQSxTQUFPO2dCQUNILFNBQVMsVUFBVTtnQkFDbkIsU0FBUyxhQUFhO2dCQUN0QixRQUFBLFVBQVUsTUFBTSxRQUFRLE1BQU0sVUFBVSxNQUFLOzs7OztnQkFLN0MsSUFBSSxDQUFDLE9BQU8sTUFBTTtvQkFDZCxNQUFLLFVBQVU7O2dCQUVuQixXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVMsVUFBVTtnQkFDbkIsU0FBUyxhQUFhO2dCQUN0QixTQUFTOztZQUdqQixPQUFPOztRQUdKLFNBQUEsVUFBQSxVQUFQLFVBQWUsSUFBWSxRQUFRLFlBQVksVUFBUTtZQUF2RCxJQUFBLFFBQUE7O1lBRUksSUFBSSxPQUFPLElBQUksUUFBUTtZQUN2QixLQUFLLFFBQVEsS0FBSztZQUNsQixLQUFLLFFBQVE7WUFFYixRQUFRLEtBQUssU0FBUztpQkFDckIsT0FBTyxLQUFLO2lCQUNaLEtBQ0csVUFBQSxTQUFPO2dCQUNILElBQUksTUFBSyxhQUFhLFNBQVMsTUFBSyxhQUFhLE1BQU0sS0FBSztvQkFDeEQsTUFBSyxhQUFhLE1BQU0sSUFBSSxRQUFRO29CQUNwQyxNQUFLLGFBQWEsTUFBTSxJQUFJLGdCQUFnQjtvQkFDNUMsT0FBTyxNQUFLLGFBQWEsTUFBTTs7Z0JBRW5DLFdBQVc7ZUFFZixVQUFBLE9BQUs7Z0JBQ0QsU0FBUzs7O1FBS2QsU0FBQSxVQUFBLFFBQVAsVUFBYSxRQUFpQixZQUFzQixVQUFrQjtZQUNsRSxJQUFJLFNBQVMsS0FBSyxTQUFTOztZQUczQixJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLEtBQUssTUFBTSxLQUFLLFFBQVEsS0FBSztZQUM3QixPQUFPLFVBQVUsS0FBSyxXQUFXLE9BQU8sV0FBVztZQUVuRCxJQUFJLFdBQVcsS0FBSztZQUVwQixJQUFJLFVBQVUsUUFBUSxLQUFLLFNBQVMsWUFBWSxLQUFLLEtBQUssT0FBTyxLQUFLLEtBQUssUUFBUSxRQUFRO1lBRTNGLFFBQVEsS0FDSixVQUFBLFNBQU87Z0JBQ0gsSUFBSSxRQUFRLFFBQVEsS0FBSztnQkFDekIsU0FBUyxhQUFhLE1BQU07Z0JBQzVCLFNBQVMsS0FBSyxNQUFNO2dCQUVwQixXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVMsVUFBVSxRQUFRLE1BQU0sT0FBTzs7WUFJaEQsT0FBTzs7UUFHSixTQUFBLFVBQUEsa0JBQVAsVUFBb0QsVUFBYSxZQUFtQjtZQUNoRixJQUFJLGFBQWEsU0FBUztZQUMxQixJQUFJLENBQUMsWUFBWTtnQkFDYixhQUFhLFVBQVUsS0FBSyxNQUFNLEtBQUssV0FBVzs7WUFHdEQsY0FBYyxhQUFhLGFBQWEsU0FBUztZQUNqRCxJQUFJLEVBQUUsY0FBYyxLQUFLLGdCQUFnQjtnQkFDckMsS0FBSyxjQUFjLGNBQWMsRUFBRSxNQUFNOztZQUc3QyxJQUFJLEtBQUssT0FBTyxjQUFjLFlBQVksU0FBUztnQkFDL0MsS0FBSyxjQUFjLFlBQVksUUFBUSxjQUFjOztpQkFDbEQ7Z0JBQ0gsS0FBSyxjQUFjLFlBQVksVUFBVTs7O1FBSTFDLFNBQUEsVUFBQSxtQkFBUCxVQUFxRCxXQUFxQixZQUFrQjtZQUE1RixJQUFBLFFBQUE7WUFDSSxJQUFJLEVBQUUsY0FBYyxLQUFLLGdCQUFnQjtnQkFDckMsS0FBSyxjQUFjLGNBQWMsRUFBRSxNQUFNOztZQUc3QyxJQUFJLENBQUMsS0FBSyxPQUFPLGNBQWMsWUFBWSxTQUFTO2dCQUNoRCxRQUFRLEtBQUssdUNBQXVDLEtBQUssT0FBTzs7WUFHcEUsUUFBUSxRQUFRLFdBQVcsVUFBQyxVQUFRO2dCQUNoQyxNQUFLLGNBQWMsWUFBWSxRQUFRLFNBQVMsTUFBTTs7O1FBSXZELFNBQUEsVUFBQSxxQkFBUCxVQUEwQixZQUFvQixJQUFVO1lBQ3BELElBQUksRUFBRSxjQUFjLEtBQUssZ0JBQWdCO2dCQUNyQyxPQUFPOztZQUVYLElBQUksRUFBRSxVQUFVLEtBQUssY0FBYyxjQUFjO2dCQUM3QyxPQUFPOztZQUVYLElBQUksRUFBRSxNQUFNLEtBQUssY0FBYyxZQUFZLFVBQVU7Z0JBQ2pELE9BQU87O1lBRVgsT0FBTyxLQUFLLGNBQWMsWUFBWSxRQUFRO1lBQzlDLE9BQU87O1FBR0gsU0FBQSxVQUFBLFlBQVIsVUFBa0IsV0FBUztZQUN2QixJQUFJLFVBQVUsSUFBSTtnQkFDZCxLQUFLLGtCQUFrQjs7aUJBQ3BCO2dCQUNILEtBQUssYUFBYSxXQUFXLFlBQVksS0FBSztnQkFDOUMsS0FBSyxtQkFBbUI7OztRQUl4QixTQUFBLFVBQUEscUJBQVIsVUFBd0QsV0FBbUI7WUFBM0UsSUFBQSxRQUFBO1lBQ0ksUUFBUSxRQUFRLFdBQVcsVUFBQyxVQUFRO2dCQUNoQyxNQUFLLGtCQUFrQjs7O1FBSXZCLFNBQUEsVUFBQSxvQkFBUixVQUF1RCxVQUFXO1lBQzlELElBQUksU0FBUyxJQUFJO2dCQUNiLEtBQUssYUFBYSxNQUFNLFNBQVMsTUFBTTs7Ozs7O1FBT3hDLFNBQUEsVUFBQSxhQUFQLFlBQUE7WUFDSSxPQUFPLFFBQUEsVUFBVSxXQUFXLEtBQUs7O1FBRXpDLE9BQUE7O0lBbFlhLFFBQUEsV0FBUTtHQURsQixZQUFBLFVBQU87QUN5VWQ7QUN6VUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ3dCQTtBQ3hCQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGdCQUFBLFlBQUE7OztRQUdJLFNBQUEsYUFDYyxhQUFXO1lBQVgsS0FBQSxjQUFBOztRQUlsQixPQUFBOztJQVJhLFFBQUEsZUFBWTtJQVV6QixRQUFRLE9BQU8sb0JBQW9CLFFBQVEsdUJBQXVCO0dBWC9ELFlBQUEsVUFBTztBQ1lkO0FDWkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxpQkFBQSxZQUFBOztRQUdJLFNBQUEsZ0JBQUE7O1FBSU8sY0FBQSxVQUFBLFdBQVAsVUFBZ0IsYUFBbUI7WUFDL0IsT0FBTzs7UUFFZixPQUFBOztJQVZhLFFBQUEsZ0JBQWE7R0FEdkIsWUFBQSxVQUFPO0FDYWQ7QUNiQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGtCQUFBLFlBQUE7O1FBR0ksU0FBQSxpQkFBQTs7UUFPTyxlQUFBLFVBQUEsTUFBUCxVQUFXLEtBQUc7Ozs7UUFLUCxlQUFBLFVBQUEsUUFBUCxVQUFhLEtBQUssTUFBSTs7OztRQU0xQixPQUFBOztJQXJCYSxRQUFBLGlCQUFjO0dBRHhCLFlBQUEsVUFBTztBQ2tCZCIsImZpbGUiOiJ0cy1hbmd1bGFyLWpzb25hcGkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cblxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgLmNvbnN0YW50KCdyc0pzb25hcGlDb25maWcnLCB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly95b3VyZG9tYWluL2FwaS92MS8nLFxuICAgICAgICBkZWxheTogMCxcbiAgICAgICAgdW5pZnlfY29uY3VycmVuY3k6IHRydWUsXG4gICAgICAgIGNhY2hlX3ByZXJlcXVlc3RzOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLCBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcblxufSkoYW5ndWxhcik7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgICAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLycsXG4gICAgICAgIGRlbGF5OiAwLFxuICAgICAgICB1bmlmeV9jb25jdXJyZW5jeTogdHJ1ZSxcbiAgICAgICAgY2FjaGVfcHJlcmVxdWVzdHM6IHRydWVcbiAgICB9KTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJywgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG59KShhbmd1bGFyKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQmFzZSB7XG4gICAgICAgIHN0YXRpYyBQYXJhbXM6IEpzb25hcGkuSVBhcmFtcyA9IHtcbiAgICAgICAgICAgIGlkOiAnJyxcbiAgICAgICAgICAgIGluY2x1ZGU6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgc3RhdGljIFNjaGVtYSA9IHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwczoge31cbiAgICAgICAgfTtcbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBCYXNlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gQmFzZSgpIHtcbiAgICAgICAgfVxuICAgICAgICBCYXNlLlBhcmFtcyA9IHtcbiAgICAgICAgICAgIGlkOiAnJyxcbiAgICAgICAgICAgIGluY2x1ZGU6IFtdXG4gICAgICAgIH07XG4gICAgICAgIEJhc2UuU2NoZW1hID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gQmFzZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQmFzZSA9IEJhc2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSHR0cCB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJGh0dHAsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJHRpbWVvdXQsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkICRxXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnREVMRVRFJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm90ZWN0ZWQgZXhlYyhwYXRoOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBkYXRhPzogSnNvbmFwaS5JRGF0YU9iamVjdCkge1xuICAgICAgICAgICAgbGV0IHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuXG4gICAgICAgICAgICBsZXQgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKDEpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyB0aW1lb3V0IGp1c3QgZm9yIGRldmVsb3AgZW52aXJvbm1lbnRcbiAgICAgICAgICAgICAgICAgICAgc2VsZi4kdGltZW91dCggKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgICAgICB9LCBzZWxmLnJzSnNvbmFwaUNvbmZpZy5kZWxheSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3Iuc3RhdHVzIDw9IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9mZmxpbmU/XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc09mZmxpbmUoZXJyb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyAodXNlIEpzb25hcGlDb3JlLmxvYWRpbmdzT2ZmbGluZSBmb3IgY2F0Y2ggaXQpIGVycm9yID0+JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFKc29uYXBpLkNvcmUuTWUubG9hZGluZ3NFcnJvcihlcnJvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkuSHR0cC5leGVjICh1c2UgSnNvbmFwaUNvcmUubG9hZGluZ3NFcnJvciBmb3IgY2F0Y2ggaXQpIGVycm9yID0+JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEh0dHAgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIEh0dHAoJGh0dHAsICR0aW1lb3V0LCByc0pzb25hcGlDb25maWcsICRxKSB7XG4gICAgICAgICAgICB0aGlzLiRodHRwID0gJGh0dHA7XG4gICAgICAgICAgICB0aGlzLiR0aW1lb3V0ID0gJHRpbWVvdXQ7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJHEgPSAkcTtcbiAgICAgICAgfVxuICAgICAgICBIdHRwLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnREVMRVRFJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdHRVQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZXhlYyA9IGZ1bmN0aW9uIChwYXRoLCBtZXRob2QsIGRhdGEpIHtcbiAgICAgICAgICAgIHZhciByZXEgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB0aGlzLnJzSnNvbmFwaUNvbmZpZy51cmwgKyBwYXRoLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi92bmQuYXBpK2pzb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGRhdGEgJiYgKHJlcVsnZGF0YSddID0gZGF0YSk7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IHRoaXMuJGh0dHAocmVxKTtcbiAgICAgICAgICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAvLyB0aW1lb3V0IGp1c3QgZm9yIGRldmVsb3AgZW52aXJvbm1lbnRcbiAgICAgICAgICAgICAgICBzZWxmLiR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSwgc2VsZi5yc0pzb25hcGlDb25maWcuZGVsYXkpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG9mZmxpbmU/XG4gICAgICAgICAgICAgICAgICAgIGlmICghSnNvbmFwaS5Db3JlLk1lLmxvYWRpbmdzT2ZmbGluZShlcnJvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgKHVzZSBKc29uYXBpQ29yZS5sb2FkaW5nc09mZmxpbmUgZm9yIGNhdGNoIGl0KSBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFKc29uYXBpLkNvcmUuTWUubG9hZGluZ3NFcnJvcihlcnJvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgKHVzZSBKc29uYXBpQ29yZS5sb2FkaW5nc0Vycm9yIGZvciBjYXRjaCBpdCkgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBIdHRwO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5IdHRwID0gSHR0cDtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgUGF0aE1ha2VyIHtcbiAgICAgICAgcHVibGljIHBhdGhzOiBBcnJheTxTdHJpbmc+ID0gW107XG4gICAgICAgIHB1YmxpYyBpbmNsdWRlczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuXG4gICAgICAgIHB1YmxpYyBhZGRQYXRoKHZhbHVlOiBTdHJpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2V0SW5jbHVkZShzdHJpbmdzX2FycmF5OiBBcnJheTxTdHJpbmc+KSB7XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gc3RyaW5nc19hcnJheTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQoKTogU3RyaW5nIHtcbiAgICAgICAgICAgIGxldCBnZXRfcGFyYW1zOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aHMuam9pbignLycpICtcbiAgICAgICAgICAgICAgICAoZ2V0X3BhcmFtcy5sZW5ndGggPiAwID8gJz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBQYXRoTWFrZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBQYXRoTWFrZXIoKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzID0gW107XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5hZGRQYXRoID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLnNldEluY2x1ZGUgPSBmdW5jdGlvbiAoc3RyaW5nc19hcnJheSkge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGdldF9wYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICc/JyArIGdldF9wYXJhbXMuam9pbignJicpIDogJycpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUGF0aE1ha2VyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5QYXRoTWFrZXIgPSBQYXRoTWFrZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29udmVydGVyIHtcblxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgc3RhdGljIGpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KFxuICAgICAgICAgICAganNvbl9hcnJheTogQXJyYXk8SnNvbmFwaS5JRGF0YVJlc291cmNlPixcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5PzogT2JqZWN0LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSA9IGZhbHNlXG4gICAgICAgICk6IE9iamVjdCB7IC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPiB7XG4gICAgICAgICAgICBpZiAoIWRlc3RpbmF0aW9uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXkgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBkYXRhIG9mIGpzb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uMnJlc291cmNlKGRhdGEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uX2FycmF5LnB1c2gocmVzb3VyY2UuaWQgKyByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uX2FycmF5WyckY291bnQnXSA9IGNvdW50OyAvLyBwcm9ibGVtIHdpdGggdG9BcnJheSBvciBhbmd1bGFyLmZvckVhY2ggbmVlZCBhICFpc09iamVjdFxuICAgICAgICAgICAgcmV0dXJuIGRlc3RpbmF0aW9uX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlIChcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IEFycmF5PEpzb25hcGkuSURhdGFSZXNvdXJjZT4sXG4gICAgICAgICAgICBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzOiBib29sZWFuXG4gICAgICAgICk6IE9iamVjdCB7IC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPiB7XG4gICAgICAgICAgICBsZXQgYWxsX3Jlc291cmNlczphbnkgPSB7IH0gO1xuICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KGpzb25fYXJyYXksIGFsbF9yZXNvdXJjZXMsIGZhbHNlKTtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZXMgPSB7IH07XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goYWxsX3Jlc291cmNlcywgKHJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCEocmVzb3VyY2UudHlwZSBpbiByZXNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXSA9IHsgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGpzb24ycmVzb3VyY2UoanNvbl9yZXNvdXJjZTogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGpzb25fcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwganNvbl9yZXNvdXJjZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgbGV0IHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBnZXRTZXJ2aWNlKHR5cGU6IHN0cmluZyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsgdHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGdldFNlcnZpY2UoKScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvKiByZXR1cm4gYSByZXNvdXJjZSB0eXBlKHJlc29ydWNlX3NlcnZpY2UpIHdpdGggZGF0YShkYXRhKSAqL1xuICAgICAgICBzdGF0aWMgcHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2U6IEpzb25hcGkuSVJlc291cmNlLCBkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gbmV3ICg8YW55PnJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXMgPyBkYXRhLmF0dHJpYnV0ZXMgOiB7fTtcbiAgICAgICAgICAgIHJlc291cmNlLmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGJ1aWxkKGRvY3VtZW50X2Zyb206IGFueSwgcmVzb3VyY2VfZGVzdDogYW55LCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICBsZXQgaW5jbHVkZWQgPSB7fTtcbiAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIGRvY3VtZW50X2Zyb20pIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlZCA9IENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKGRvY3VtZW50X2Zyb20uaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNBcnJheShkb2N1bWVudF9mcm9tLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlKGRvY3VtZW50X2Zyb20uZGF0YSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2VzKGRvY3VtZW50X2Zyb206IElEYXRhQ29sbGVjdGlvbiwgcmVzb3VyY2VfZGVzdDogQXJyYXk8SURhdGFDb2xsZWN0aW9uPiwgc2NoZW1hOiBJU2NoZW1hLCBpbmNsdWRlZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBkb2N1bWVudF9mcm9tLmRhdGEpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGRhdGEudHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKCEoZGF0YS5pZCBpbiByZXNvdXJjZV9kZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZV9kZXN0W2RhdGEuaWRdID0gbmV3ICg8YW55PnJlc291cmNlLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkYXRhLCByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBfYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tOiBJRGF0YVJlc291cmNlLCByZXNvdXJjZV9kZXN0OiBJUmVzb3VyY2UsIHNjaGVtYTogSVNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuYXR0cmlidXRlcyA9IGRvY3VtZW50X2Zyb20uYXR0cmlidXRlcztcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaWQgPSBkb2N1bWVudF9mcm9tLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5pc19uZXcgPSBmYWxzZTtcbiAgICAgICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwcyhkb2N1bWVudF9mcm9tLnJlbGF0aW9uc2hpcHMsIHJlc291cmNlX2Rlc3QucmVsYXRpb25zaGlwcywgaW5jbHVkZWQsIHNjaGVtYSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX19idWlsZFJlbGF0aW9uc2hpcHMocmVsYXRpb25zaGlwc19mcm9tOiBBcnJheTxhbnk+LCByZWxhdGlvbnNoaXBzX2Rlc3Q6IEFycmF5PGFueT4sIGluY2x1ZGVkX2FycmF5LCBzY2hlbWE6IElTY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcHNfZnJvbSwgKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIHJlbGF0aW9uIGlzIGluIHNjaGVtYT8gaGF2ZSBkYXRhIG9yIGp1c3QgbGlua3M/XG4gICAgICAgICAgICAgICAgaWYgKCEocmVsYXRpb25fa2V5IGluIHJlbGF0aW9uc2hpcHNfZGVzdCkgJiYgKCdkYXRhJyBpbiByZWxhdGlvbl92YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc29tZXRpbWUgZGF0YT1udWxsIG9yIHNpbXBsZSB7IH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uX3ZhbHVlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSAmJiBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uX3ZhbHVlLmRhdGEubGVuZ3RoIDwgMSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShyZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YSA9IHt9OyAvLyBmb3JjZSB0byBvYmplY3QgKG5vdCBhcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbl92YWx1ZS5kYXRhLCAocmVsYXRpb25fdmFsdWU6IEpzb25hcGkuSURhdGFSZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0bXAgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGFbdG1wLmlkXSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YSA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBfX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uOiBKc29uYXBpLklEYXRhUmVzb3VyY2UsIGluY2x1ZGVkX2FycmF5KTogSnNvbmFwaS5JUmVzb3VyY2UgfCBKc29uYXBpLklEYXRhUmVzb3VyY2Uge1xuICAgICAgICAgICAgaWYgKHJlbGF0aW9uLnR5cGUgaW4gaW5jbHVkZWRfYXJyYXkgJiZcbiAgICAgICAgICAgICAgICByZWxhdGlvbi5pZCBpbiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgLy8gaXQncyBpbiBpbmNsdWRlZFxuICAgICAgICAgICAgICAgIHJldHVybiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXVtyZWxhdGlvbi5pZF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHJlc291cmNlIG5vdCBpbmNsdWRlZCwgcmV0dXJuIGRpcmVjdGx5IHRoZSBvYmplY3RcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVsYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cblxuXG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29udmVydGVyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gQ29udmVydGVyKCkge1xuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBSZXNvdXJjZXMgYXJyYXlzIHdpdGhvdXQgW2tleXNdXG4gICAgICAgICoqL1xuICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkgPSBmdW5jdGlvbiAoanNvbl9hcnJheSwgZGVzdGluYXRpb25fYXJyYXksIC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPixcbiAgICAgICAgICAgIHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkgPT09IHZvaWQgMCkgeyB1c2VfaWRfZm9yX2tleSA9IGZhbHNlOyB9XG4gICAgICAgICAgICBpZiAoIWRlc3RpbmF0aW9uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXkgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIGpzb25fYXJyYXlfMSA9IGpzb25fYXJyYXk7IF9pIDwganNvbl9hcnJheV8xLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0ganNvbl9hcnJheV8xW19pXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uMnJlc291cmNlKGRhdGEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmNsdWRlZCBmb3IgZXhhbXBsZSBuZWVkIGEgZXh0cmEgcGFyYW1ldGVyXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGRlc3RpbmF0aW9uX2FycmF5WyckY291bnQnXSA9IGNvdW50OyAvLyBwcm9ibGVtIHdpdGggdG9BcnJheSBvciBhbmd1bGFyLmZvckVhY2ggbmVlZCBhICFpc09iamVjdFxuICAgICAgICAgICAgcmV0dXJuIGRlc3RpbmF0aW9uX2FycmF5O1xuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gaW5kZXhlZCBSZXNvdXJjZXMgYXJyYXkgYnkgW3R5cGVdW2lkXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUgPSBmdW5jdGlvbiAoanNvbl9hcnJheSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgdmFyIGFsbF9yZXNvdXJjZXMgPSB7fTtcbiAgICAgICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheShqc29uX2FycmF5LCBhbGxfcmVzb3VyY2VzLCBmYWxzZSk7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2VzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goYWxsX3Jlc291cmNlcywgZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEocmVzb3VyY2UudHlwZSBpbiByZXNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXSA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV1bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZXM7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5qc29uMnJlc291cmNlID0gZnVuY3Rpb24gKGpzb25fcmVzb3VyY2UsIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShqc29uX3Jlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGpzb25fcmVzb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gc2VydmljZSBub3QgcmVnaXN0ZXJlZFxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyBqc29uX3Jlc291cmNlLnR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBqc29uMnJlc291cmNlKCknKTtcbiAgICAgICAgICAgICAgICB2YXIgdGVtcCA9IG5ldyBKc29uYXBpLlJlc291cmNlKCk7XG4gICAgICAgICAgICAgICAgdGVtcC5pZCA9IGpzb25fcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgdGVtcC50eXBlID0ganNvbl9yZXNvdXJjZS50eXBlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuZ2V0U2VydmljZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29yZS5NZS5nZXRSZXNvdXJjZSh0eXBlKTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHJlc291cmNlX3NlcnZpY2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIHR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBnZXRTZXJ2aWNlKCknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9O1xuICAgICAgICAvKiByZXR1cm4gYSByZXNvdXJjZSB0eXBlKHJlc29ydWNlX3NlcnZpY2UpIHdpdGggZGF0YShkYXRhKSAqL1xuICAgICAgICBDb252ZXJ0ZXIucHJvY3JlYXRlID0gZnVuY3Rpb24gKHJlc291cmNlX3NlcnZpY2UsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghKCd0eXBlJyBpbiBkYXRhICYmICdpZCcgaW4gZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdKc29uYXBpIFJlc291cmNlIGlzIG5vdCBjb3JyZWN0JywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBuZXcgcmVzb3VyY2Vfc2VydmljZS5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzID8gZGF0YS5hdHRyaWJ1dGVzIDoge307XG4gICAgICAgICAgICByZXNvdXJjZS5pc19uZXcgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmJ1aWxkID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSkge1xuICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgaWYgKCdpbmNsdWRlZCcgaW4gZG9jdW1lbnRfZnJvbSkge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoZG9jdW1lbnRfZnJvbS5pbmNsdWRlZCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNBcnJheShkb2N1bWVudF9mcm9tLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2VzID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBkb2N1bWVudF9mcm9tLmRhdGE7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBfYVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghKGRhdGEuaWQgaW4gcmVzb3VyY2VfZGVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyByZXNvdXJjZS5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkYXRhLCByZXNvdXJjZV9kZXN0W2RhdGEuaWRdLCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlID0gZnVuY3Rpb24gKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuYXR0cmlidXRlcyA9IGRvY3VtZW50X2Zyb20uYXR0cmlidXRlcztcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaWQgPSBkb2N1bWVudF9mcm9tLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5pc19uZXcgPSBmYWxzZTtcbiAgICAgICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwcyhkb2N1bWVudF9mcm9tLnJlbGF0aW9uc2hpcHMsIHJlc291cmNlX2Rlc3QucmVsYXRpb25zaGlwcywgaW5jbHVkZWQsIHNjaGVtYSk7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwcyA9IGZ1bmN0aW9uIChyZWxhdGlvbnNoaXBzX2Zyb20sIHJlbGF0aW9uc2hpcHNfZGVzdCwgaW5jbHVkZWRfYXJyYXksIHNjaGVtYSkge1xuICAgICAgICAgICAgLy8gcmVjb3JybyBsb3MgcmVsYXRpb25zaGlwcyBsZXZhbnRvIGVsIHNlcnZpY2UgY29ycmVzcG9uZGllbnRlXG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwc19mcm9tLCBmdW5jdGlvbiAocmVsYXRpb25fdmFsdWUsIHJlbGF0aW9uX2tleSkge1xuICAgICAgICAgICAgICAgIC8vIHJlbGF0aW9uIGlzIGluIHNjaGVtYT8gaGF2ZSBkYXRhIG9yIGp1c3QgbGlua3M/XG4gICAgICAgICAgICAgICAgaWYgKCEocmVsYXRpb25fa2V5IGluIHJlbGF0aW9uc2hpcHNfZGVzdCkgJiYgKCdkYXRhJyBpbiByZWxhdGlvbl92YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbl92YWx1ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gJiYgc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA8IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShyZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YSA9IHt9OyAvLyBmb3JjZSB0byBvYmplY3QgKG5vdCBhcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbl92YWx1ZS5kYXRhLCBmdW5jdGlvbiAocmVsYXRpb25fdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdG1wID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhW3RtcC5pZF0gPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YSA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAocmVsYXRpb24sIGluY2x1ZGVkX2FycmF5KSB7XG4gICAgICAgICAgICBpZiAocmVsYXRpb24udHlwZSBpbiBpbmNsdWRlZF9hcnJheSAmJlxuICAgICAgICAgICAgICAgIHJlbGF0aW9uLmlkIGluIGluY2x1ZGVkX2FycmF5W3JlbGF0aW9uLnR5cGVdKSB7XG4gICAgICAgICAgICAgICAgLy8gaXQncyBpbiBpbmNsdWRlZFxuICAgICAgICAgICAgICAgIHJldHVybiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXVtyZWxhdGlvbi5pZF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyByZXNvdXJjZSBub3QgaW5jbHVkZWQsIHJldHVybiBkaXJlY3RseSB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gQ29udmVydGVyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db252ZXJ0ZXIgPSBDb252ZXJ0ZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29yZSBpbXBsZW1lbnRzIEpzb25hcGkuSUNvcmUge1xuICAgICAgICBwdWJsaWMgcm9vdFBhdGg6IHN0cmluZyA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICBwdWJsaWMgcmVzb3VyY2VzOiBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgbG9hZGluZ3NDb3VudGVyOiBudW1iZXIgPSAwO1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NTdGFydCA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NEb25lID0gKCkgPT4ge307XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0Vycm9yID0gKCkgPT4ge307XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc09mZmxpbmUgPSAoKSA9PiB7fTtcblxuICAgICAgICBwdWJsaWMgc3RhdGljIE1lOiBKc29uYXBpLklDb3JlID0gbnVsbDtcbiAgICAgICAgcHVibGljIHN0YXRpYyBTZXJ2aWNlczogYW55ID0gbnVsbDtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUNvcmVTZXJ2aWNlc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9yZWdpc3RlcihjbGFzZSk6IGJvb2xlYW4ge1xuICAgICAgICAgICAgaWYgKGNsYXNlLnR5cGUgaW4gdGhpcy5yZXNvdXJjZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0UmVzb3VyY2UodHlwZTogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvdXJjZXNbdHlwZV07XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgcmVmcmVzaExvYWRpbmdzKGZhY3RvcjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmUnLCBDb3JlKTtcbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvcmUgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmUocnNKc29uYXBpQ29uZmlnLCBKc29uYXBpQ29yZVNlcnZpY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuSnNvbmFwaUNvcmVTZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgICAgICB0aGlzLnJvb3RQYXRoID0gJ2h0dHA6Ly9yZXllc29mdC5kZG5zLm5ldDo5OTk5L2FwaS92MS9jb21wYW5pZXMvMic7XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgPSAwO1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0ID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRXJyb3IgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzT2ZmbGluZSA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG4gICAgICAgIENvcmUucHJvdG90eXBlLl9yZWdpc3RlciA9IGZ1bmN0aW9uIChjbGFzZSkge1xuICAgICAgICAgICAgaWYgKGNsYXNlLnR5cGUgaW4gdGhpcy5yZXNvdXJjZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIENvcmUucHJvdG90eXBlLmdldFJlc291cmNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUucmVmcmVzaExvYWRpbmdzID0gZnVuY3Rpb24gKGZhY3Rvcikge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvcmUuTWUgPSBudWxsO1xuICAgICAgICBDb3JlLlNlcnZpY2VzID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIENvcmU7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmUgPSBDb3JlO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmUnLCBDb3JlKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBSZXNvdXJjZSBpbXBsZW1lbnRzIElSZXNvdXJjZSB7XG4gICAgICAgIHB1YmxpYyBzY2hlbWE6IElTY2hlbWE7XG4gICAgICAgIHByb3RlY3RlZCBwYXRoOiBzdHJpbmc7ICAgLy8gd2l0aG91dCBzbGFzaGVzXG5cbiAgICAgICAgcHVibGljIGlzX25ldyA9IHRydWU7XG4gICAgICAgIHB1YmxpYyB0eXBlOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBpZDogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgYXR0cmlidXRlczogYW55IDtcbiAgICAgICAgcHVibGljIHJlbGF0aW9uc2hpcHM6IGFueSA9IHt9OyAvL1tdO1xuXG4gICAgICAgIHB1YmxpYyBjYWNoZTogT2JqZWN0O1xuICAgICAgICBwdWJsaWMgY2FjaGVfdmFyczogT2JqZWN0ID0ge307XG5cbiAgICAgICAgcHVibGljIGNsb25lKCk6IGFueSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgKDxhbnk+dGhpcy5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgUmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBAcmV0dXJuIHRydWUgaWYgdGhlIHJlc291cmNlIGRvbid0IGV4aXN0IGFuZCByZWdpc3RlcmVkIG9rXG4gICAgICAgICoqL1xuICAgICAgICBwdWJsaWMgcmVnaXN0ZXIoKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoSnNvbmFwaS5Db3JlLk1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0Vycm9yOiB5b3UgYXJlIHRyeWluZyByZWdpc3RlciAtLT4gJyArIHRoaXMudHlwZSArICcgPC0tIGJlZm9yZSBpbmplY3QgSnNvbmFwaUNvcmUgc29tZXdoZXJlLCBhbG1vc3Qgb25lIHRpbWUuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiBzZXJ2aWNlIGlzIHJlZ2lzdGVyZWQsIG5vdCBjbG9uZWQgb2JqZWN0XG4gICAgICAgICAgICB0aGlzLmNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldzxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KCk6IFQge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMuaWQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KHBhcmFtcz86IEpzb25hcGkuSVBhcmFtcyk6IElEYXRhT2JqZWN0IHtcbiAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuXG4gICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwcyA9IHsgfTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IFsgXTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZF9pZHMgPSBbIF07IC8vanVzdCBmb3IgY29udHJvbCBkb24ndCByZXBlYXQgYW55IHJlc291cmNlXG5cbiAgICAgICAgICAgIC8vIFJFQUxUSU9OU0hJUFNcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gJiYgdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgbWFueSAoaGFzTWFueTp0cnVlKVxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcblxuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIChyZXNvdXJjZTogSnNvbmFwaS5JUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBvbmUgKGhhc01hbnk6ZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgIGlmICghKCdpZCcgaW4gcmVsYXRpb25zaGlwLmRhdGEpICYmICFhbmd1bGFyLmVxdWFscyh7fSwgcmVsYXRpb25zaGlwLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVsYXRpb25fYWxpYXMgKyAnIGRlZmluZWQgd2l0aCBoYXNNYW55OmZhbHNlLCBidXQgSSBoYXZlIGEgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5kYXRhLmlkICYmIHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7IGlkOiByZWxhdGlvbnNoaXAuZGF0YS5pZCwgdHlwZTogcmVsYXRpb25zaGlwLmRhdGEudHlwZSB9IH07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyB9IH07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICBsZXQgdGVtcG9yYWxfaWQgPSByZWxhdGlvbnNoaXAuZGF0YS50eXBlICsgJ18nICsgcmVsYXRpb25zaGlwLmRhdGEuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25zaGlwLmRhdGEudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlbGF0aW9uc2hpcC5kYXRhLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGV0IHJldDogSURhdGFPYmplY3QgPSB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoaW5jbHVkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldC5pbmNsdWRlZCA9IGluY2x1ZGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KGlkOiBzdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBUIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGRlbGV0ZShpZDogc3RyaW5nLCBwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgICAgICAgICB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2RlbGV0ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFsbDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFJlbGF0aW9uc2hpcHM8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihwYXJlbnRfcGF0aF9pZDogc3RyaW5nLFxuICAgICAgICAgICAgcGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvblxuICAgICAgICApOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMocGFyZW50X3BhdGhfaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXRSZWxhdGlvbnNoaXBzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2F2ZTxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBwcml2YXRlIF9fZXhlYyhpZDogc3RyaW5nLCBwYXJhbXM6IEpzb25hcGkuSVBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZTogc3RyaW5nKTogYW55IHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkge307XG5cbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcblxuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldFJlbGF0aW9uc2hpcHMnOlxuICAgICAgICAgICAgICAgIHBhcmFtcy5wYXRoID0gaWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWxldGUoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZShwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZ2V0KGlkOiBzdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gPyB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gOiB0aGlzLm5ldygpO1xuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBJQ29sbGVjdGlvbiB7IC8vIEFycmF5PElSZXNvdXJjZT4ge1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLnBhdGggPyBwYXRoLmFkZFBhdGgocGFyYW1zLnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHJlc291cmNlOiBJQ29sbGVjdGlvbjtcblxuICAgICAgICAgICAgcmVzb3VyY2UgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh7fSwge1xuICAgICAgICAgICAgICAgICckbGVuZ3RoJzoge1xuICAgICAgICAgICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gT2JqZWN0LmtleXModGhpcykubGVuZ3RoOyB9LFxuICAgICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgJyRpc2xvYWRpbmcnOiB7IHZhbHVlOiBmYWxzZSwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgJyRzb3VyY2UnOiB7IHZhbHVlOiAnJywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gKCFwYXJhbXMucGF0aCk6IGJlY291c2Ugd2UgbmVlZCByZWFsIHR5cGUsIG5vdCB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVxuICAgICAgICAgICAgaWYgKCFwYXJhbXMucGF0aCAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9PT0gdGhpcy5nZXRQYXRoKCkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBkb24ndCBtYWtlXG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdjYWNoZSc7XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlc291cmNlWyckaXNsb2FkaW5nJ10gPSB0cnVlO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdzZXJ2ZXInO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS4kaXNsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIENvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAgICghcGFyYW1zLnBhdGgpOiBmaWxsIGNhY2hlIG5lZWQgd29yayB3aXRoIHJlbGF0aW9uc2hpcHMgdG9vLFxuICAgICAgICAgICAgICAgICAgICBmb3IgdGhlIG1vbW1lbnQgd2UncmUgY3JlYXRlZCB0aGlzIGlmXG4gICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyYW1zLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS4kc291cmNlID0gJ3NlcnZlcic7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLiRpc2xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2RlbGV0ZShpZDogc3RyaW5nLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogdm9pZCB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcblxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZGVsZXRlKHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdWydpZCddID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF1bJ2F0dHJpYnV0ZXMnXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9zYXZlKHBhcmFtczogSVBhcmFtcywgZmNfc3VjY2VzczogRnVuY3Rpb24sIGZjX2Vycm9yOiBGdW5jdGlvbik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgdGhpcy5pZCAmJiBwYXRoLmFkZFBhdGgodGhpcy5pZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuXG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5leGVjKHBhdGguZ2V0KCksIHRoaXMuaWQgPyAnUFVUJyA6ICdQT1NUJywgb2JqZWN0KTtcblxuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoJ2RhdGEnIGluIGVycm9yID8gZXJyb3IuZGF0YSA6IGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWRkUmVsYXRpb25zaGlwPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2U6IFQsIHR5cGVfYWxpYXM/OiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGxldCBvYmplY3Rfa2V5ID0gcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICBpZiAoIW9iamVjdF9rZXkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rfa2V5ID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhZGRSZWxhdGlvbnNoaXBzPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2VzOiBBcnJheTxUPiwgdHlwZV9hbGlhczogc3RyaW5nKSB7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYWRkUmVsYXRpb25zaGlwcyBub3Qgc3VwcG9ydGVkIG9uICcgKyB0aGlzLnR5cGUgKyAnIHNjaGVtYS4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlcywgKHJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZW1vdmVSZWxhdGlvbnNoaXAodHlwZV9hbGlhczogc3RyaW5nLCBpZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoISgnZGF0YScgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGlkIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtpZF07XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByaXZhdGUgZmlsbENhY2hlKHJlc291cmNlcykge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlcy5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVfdmFyc1snX19wYXRoJ10gPSB0aGlzLmdldFBhdGgoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlcyhyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBmaWxsQ2FjaGVSZXNvdXJjZXM8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihyZXNvdXJjZXM6IEFycmF5PFQ+KSB7XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVzb3VyY2VzLCAocmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBmaWxsQ2FjaGVSZXNvdXJjZTxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlOiBUKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2UuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBAcmV0dXJuIFRoaXMgcmVzb3VyY2UgbGlrZSBhIHNlcnZpY2VcbiAgICAgICAgKiovXG4gICAgICAgIHB1YmxpYyBnZXRTZXJ2aWNlKCk6IGFueSB7XG4gICAgICAgICAgICByZXR1cm4gQ29udmVydGVyLmdldFNlcnZpY2UodGhpcy50eXBlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFJlc291cmNlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUmVzb3VyY2UoKSB7XG4gICAgICAgICAgICB0aGlzLmlzX25ldyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTsgLy9bXTtcbiAgICAgICAgICAgIHRoaXMuY2FjaGVfdmFycyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICBmb3IgKHZhciBhdHRyaWJ1dCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2F0dHJpYnV0XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xvbmVPYmpbYXR0cmlidXRdID0gdGhpc1thdHRyaWJ1dF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNsb25lT2JqO1xuICAgICAgICB9O1xuICAgICAgICAvKipcbiAgICAgICAgUmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBAcmV0dXJuIHRydWUgaWYgdGhlIHJlc291cmNlIGRvbid0IGV4aXN0IGFuZCByZWdpc3RlcmVkIG9rXG4gICAgICAgICoqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoSnNvbmFwaS5Db3JlLk1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0Vycm9yOiB5b3UgYXJlIHRyeWluZyByZWdpc3RlciAtLT4gJyArIHRoaXMudHlwZSArICcgPC0tIGJlZm9yZSBpbmplY3QgSnNvbmFwaUNvcmUgc29tZXdoZXJlLCBhbG1vc3Qgb25lIHRpbWUuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiBzZXJ2aWNlIGlzIHJlZ2lzdGVyZWQsIG5vdCBjbG9uZWQgb2JqZWN0XG4gICAgICAgICAgICB0aGlzLmNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9O1xuICAgICAgICAvLyBlbXB0eSBzZWxmIG9iamVjdFxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUubmV3ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV1bJ2RhdGEnXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmlzX25ldyA9IHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcywgcGFyYW1zKTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWQgPSBbXTtcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZF9pZHMgPSBbXTsgLy9qdXN0IGZvciBjb250cm9sIGRvbid0IHJlcGVhdCBhbnkgcmVzb3VyY2VcbiAgICAgICAgICAgIC8vIFJFQUxUSU9OU0hJUFNcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSB7XG4gICAgICAgICAgICAgICAgaWYgKF90aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSAmJiBfdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgbWFueSAoaGFzTWFueTp0cnVlKVxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcG9yYWxfaWQgPSByZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZWRfaWRzLmluZGV4T2YodGVtcG9yYWxfaWQpID09PSAtMSAmJiBwYXJhbXMuaW5jbHVkZS5pbmRleE9mKHJlbGF0aW9uX2FsaWFzKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQucHVzaChyZXNvdXJjZS50b09iamVjdCh7fSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaGFzIG9uZSAoaGFzTWFueTpmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoJ2lkJyBpbiByZWxhdGlvbnNoaXAuZGF0YSkgJiYgIWFuZ3VsYXIuZXF1YWxzKHt9LCByZWxhdGlvbnNoaXAuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZWxhdGlvbl9hbGlhcyArICcgZGVmaW5lZCB3aXRoIGhhc01hbnk6ZmFsc2UsIGJ1dCBJIGhhdmUgYSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5kYXRhLmlkICYmIHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7IGlkOiByZWxhdGlvbnNoaXAuZGF0YS5pZCwgdHlwZTogcmVsYXRpb25zaGlwLmRhdGEudHlwZSB9IH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcG9yYWxfaWQgPSByZWxhdGlvbnNoaXAuZGF0YS50eXBlICsgJ18nICsgcmVsYXRpb25zaGlwLmRhdGEuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25zaGlwLmRhdGEudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlbGF0aW9uc2hpcC5kYXRhLnRvT2JqZWN0KHt9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIHJldCA9IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoaW5jbHVkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldC5pbmNsdWRlZCA9IGluY2x1ZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZGVsZXRlJyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAocGFyZW50X3BhdGhfaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhwYXJlbnRfcGF0aF9pZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldFJlbGF0aW9uc2hpcHMnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdzYXZlJyk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX19leGVjID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGUpIHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfc3VjY2VzcykgPyBmY19zdWNjZXNzIDogZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLnNjaGVtYSA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuU2NoZW1hLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICBzd2l0Y2ggKGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldFJlbGF0aW9uc2hpcHMnOlxuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucGF0aCA9IGlkO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWxldGUoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2F2ZSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2dldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSA/IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSA6IHRoaXMubmV3KCk7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgICAgICAuZ2V0KHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCBfdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgIF90aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fYWxsID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLnBhdGggPyBwYXRoLmFkZFBhdGgocGFyYW1zLnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciByZXNvdXJjZTtcbiAgICAgICAgICAgIHJlc291cmNlID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoe30sIHtcbiAgICAgICAgICAgICAgICAnJGxlbmd0aCc6IHtcbiAgICAgICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBPYmplY3Qua2V5cyh0aGlzKS5sZW5ndGg7IH0sXG4gICAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnJGlzbG9hZGluZyc6IHsgdmFsdWU6IGZhbHNlLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAnJHNvdXJjZSc6IHsgdmFsdWU6ICcnLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyAoIXBhcmFtcy5wYXRoKTogYmVjb3VzZSB3ZSBuZWVkIHJlYWwgdHlwZSwgbm90IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlXG4gICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID09PSB0aGlzLmdldFBhdGgoKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IG1ha2VcbiAgICAgICAgICAgICAgICByZXNvdXJjZS4kc291cmNlID0gJ2NhY2hlJztcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc291cmNlWyckaXNsb2FkaW5nJ10gPSB0cnVlO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdzZXJ2ZXInO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLiRpc2xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCBfdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgKCFwYXJhbXMucGF0aCk6IGZpbGwgY2FjaGUgbmVlZCB3b3JrIHdpdGggcmVsYXRpb25zaGlwcyB0b28sXG4gICAgICAgICAgICAgICAgZm9yIHRoZSBtb21tZW50IHdlJ3JlIGNyZWF0ZWQgdGhpcyBpZlxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgaWYgKCFwYXJhbXMucGF0aCkge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGUocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuJHNvdXJjZSA9ICdzZXJ2ZXInO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLiRpc2xvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5kZWxldGUocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIGlmIChfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgX3RoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSkge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdWydpZCddID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF1bJ2F0dHJpYnV0ZXMnXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5leGVjKHBhdGguZ2V0KCksIHRoaXMuaWQgPyAnUFVUJyA6ICdQT1NUJywgb2JqZWN0KTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKCdkYXRhJyBpbiBlcnJvciA/IGVycm9yLmRhdGEgOiBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFkZFJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uIChyZXNvdXJjZSwgdHlwZV9hbGlhcykge1xuICAgICAgICAgICAgdmFyIG9iamVjdF9rZXkgPSByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgIGlmICghb2JqZWN0X2tleSkge1xuICAgICAgICAgICAgICAgIG9iamVjdF9rZXkgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHt9IH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hZGRSZWxhdGlvbnNoaXBzID0gZnVuY3Rpb24gKHJlc291cmNlcywgdHlwZV9hbGlhcykge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdhZGRSZWxhdGlvbnNoaXBzIG5vdCBzdXBwb3J0ZWQgb24gJyArIHRoaXMudHlwZSArICcgc2NoZW1hLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlcywgZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZW1vdmVSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAodHlwZV9hbGlhcywgaWQpIHtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKCdkYXRhJyBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaWQgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW2lkXTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZmlsbENhY2hlID0gZnVuY3Rpb24gKHJlc291cmNlcykge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlcy5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID0gdGhpcy5nZXRQYXRoKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZXMocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlcyA9IGZ1bmN0aW9uIChyZXNvdXJjZXMpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlID0gZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2UuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUmVzb3VyY2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlJlc291cmNlID0gUmVzb3VyY2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2Jhc2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtY29udmVydGVyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuLy8gUGFyYW1ldGVycyBmb3IgVFMtSnNvbmFwaSBDbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3NjaGVtYS5kLnRzXCIvPlxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9iYXNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
