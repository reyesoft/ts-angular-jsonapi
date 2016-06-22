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
                    console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsOffline for catch it) error =>', error);
                    Jsonapi.Core.Me.loadingsOffline(error);
                }
                else {
                    console.warn('Jsonapi.Http.exec (use JsonapiCore.loadingsError for catch it) error =>', error);
                    Jsonapi.Core.Me.loadingsError(error);
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
            var resource = {};
            // (!params.path): becouse we need real type, not this.getService().cache
            if (!params.path && this.getService().cache && this.getService().cache_vars['__path'] === this.getPath()) {
                // we don't make
                angular.forEach(this.getService().cache, function (value, key) {
                    resource[key] = value;
                });
            }
            Jsonapi.Core.Services.JsonapiHttp
                .get(path.get())
                .then(function (success) {
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvYmFzZS50cyIsInNlcnZpY2VzL2Jhc2UuanMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9wYXRoLW1ha2VyLnRzIiwic2VydmljZXMvcGF0aC1tYWtlci5qcyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci5qcyIsImNvcmUudHMiLCJjb3JlLmpzIiwicmVzb3VyY2UudHMiLCJyZXNvdXJjZS5qcyIsIl9hbGwudHMiLCJfYWxsLmpzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsQ0FBQyxVQUFVLFNBQU87O0lBRWQsUUFBUSxPQUFPLGtCQUFrQjtTQUNoQyxTQUFTLG1CQUFtQjtRQUN6QixLQUFLO1FBQ0wsT0FBTztRQUNQLG1CQUFtQjtRQUNuQixtQkFBbUI7O0lBR3ZCLFFBQVEsT0FBTyxvQkFBb0I7SUFFbkMsUUFBUSxPQUFPLGFBQWE7UUFDeEI7UUFDQTtRQUNBOztHQUdMO0FDSEg7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7UUFBQSxTQUFBLE9BQUE7O1FBQ1csS0FBQSxTQUEwQjtZQUM3QixJQUFJO1lBQ0osU0FBUzs7UUFHTixLQUFBLFNBQVM7WUFDWixZQUFZO1lBQ1osZUFBZTs7UUFFdkIsT0FBQTs7SUFWYSxRQUFBLE9BQUk7R0FEZCxZQUFBLFVBQU87QUNpQmQ7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7OztRQUdJLFNBQUEsS0FDYyxPQUNBLFVBQ0EsaUJBQ0EsSUFBRTtZQUhGLEtBQUEsUUFBQTtZQUNBLEtBQUEsV0FBQTtZQUNBLEtBQUEsa0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLFNBQVAsVUFBYyxNQUFZO1lBQ3RCLE9BQU8sS0FBSyxLQUFLLE1BQU07O1FBR3BCLEtBQUEsVUFBQSxNQUFQLFVBQVcsTUFBWTtZQUNuQixPQUFPLEtBQUssS0FBSyxNQUFNOztRQUdqQixLQUFBLFVBQUEsT0FBVixVQUFlLE1BQWMsUUFBZ0IsTUFBMEI7WUFDbkUsSUFBSSxNQUFNO2dCQUNOLFFBQVE7Z0JBQ1IsS0FBSyxLQUFLLGdCQUFnQixNQUFNO2dCQUNoQyxTQUFTO29CQUNMLGdCQUFnQjs7O1lBR3hCLFNBQVMsSUFBSSxVQUFVO1lBQ3ZCLElBQUksVUFBVSxLQUFLLE1BQU07WUFFekIsSUFBSSxXQUFXLEtBQUssR0FBRztZQUN2QixJQUFJLE9BQU87WUFDWCxRQUFRLEtBQUssR0FBRyxnQkFBZ0I7WUFDaEMsUUFBUSxLQUNKLFVBQUEsU0FBTzs7Z0JBRUgsS0FBSyxTQUFVLFlBQUE7b0JBQ1gsUUFBUSxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7b0JBQ2pDLFNBQVMsUUFBUTttQkFDbEIsS0FBSyxnQkFBZ0I7ZUFFNUIsVUFBQSxPQUFLO2dCQUNELFFBQVEsS0FBSyxHQUFHLGdCQUFnQixDQUFDO2dCQUNqQyxJQUFJLE1BQU0sVUFBVSxHQUFHOztvQkFFbkIsUUFBUSxLQUFLLDZFQUE2RTtvQkFDMUYsUUFBUSxLQUFLLEdBQUcsZ0JBQWdCOztxQkFDN0I7b0JBQ0gsUUFBUSxLQUFLLDJFQUEyRTtvQkFDeEYsUUFBUSxLQUFLLEdBQUcsY0FBYzs7Z0JBRWxDLFNBQVMsT0FBTzs7WUFHeEIsT0FBTyxTQUFTOztRQUV4QixPQUFBOztJQXpEYSxRQUFBLE9BQUk7SUEwRGpCLFFBQVEsT0FBTyxvQkFBb0IsUUFBUSxlQUFlO0dBM0R2RCxZQUFBLFVBQU87QUN1RGQ7QUN2REEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxhQUFBLFlBQUE7UUFBQSxTQUFBLFlBQUE7WUFDVyxLQUFBLFFBQXVCO1lBQ3ZCLEtBQUEsV0FBMEI7O1FBRTFCLFVBQUEsVUFBQSxVQUFQLFVBQWUsT0FBYTtZQUN4QixLQUFLLE1BQU0sS0FBSzs7UUFHYixVQUFBLFVBQUEsYUFBUCxVQUFrQixlQUE0QjtZQUMxQyxLQUFLLFdBQVc7O1FBR2IsVUFBQSxVQUFBLE1BQVAsWUFBQTtZQUNJLElBQUksYUFBNEI7WUFFaEMsSUFBSSxLQUFLLFNBQVMsU0FBUyxHQUFHO2dCQUMxQixXQUFXLEtBQUssYUFBYSxLQUFLLFNBQVMsS0FBSzs7WUFHcEQsT0FBTyxLQUFLLE1BQU0sS0FBSztpQkFDbEIsV0FBVyxTQUFTLElBQUksTUFBTSxXQUFXLEtBQUssT0FBTzs7UUFFbEUsT0FBQTs7SUF0QmEsUUFBQSxZQUFTO0dBRG5CLFlBQUEsVUFBTztBQ3lCZDtBQ3pCQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGFBQUEsWUFBQTtRQUFBLFNBQUEsWUFBQTs7Ozs7UUFLVyxVQUFBLDZCQUFQLFVBQ0ksWUFDQTtZQUNBLGdCQUFzQjtZQUF0QixJQUFBLG1CQUFBLEtBQUEsR0FBc0IsRUFBdEIsaUJBQUE7WUFFQSxJQUFJLENBQUMsbUJBQW1CO2dCQUNwQixvQkFBb0I7O1lBRXhCLElBQUksUUFBUTtZQUNaLEtBQWlCLElBQUEsS0FBQSxHQUFBLGVBQUEsWUFBQSxLQUFBLGFBQUEsUUFBQSxNQUFXO2dCQUF2QixJQUFJLE9BQUksYUFBQTtnQkFDVCxJQUFJLFdBQVcsUUFBUSxVQUFVLGNBQWMsTUFBTTtnQkFDckQsSUFBSSxnQkFBZ0I7b0JBQ2hCLGtCQUFrQixTQUFTLE1BQU07O3FCQUM5Qjs7b0JBRUgsa0JBQWtCLFNBQVMsT0FBTyxNQUFNLFNBQVMsTUFBTTs7Z0JBRzNEOzs7WUFHSixPQUFPOzs7OztRQU1KLFVBQUEscUNBQVAsVUFDSSxZQUNBLHdCQUErQjtZQUUvQixJQUFJLGdCQUFvQjtZQUN4QixVQUFVLDJCQUEyQixZQUFZLGVBQWU7WUFDaEUsSUFBSSxZQUFZO1lBQ2hCLFFBQVEsUUFBUSxlQUFlLFVBQUMsVUFBUTtnQkFDcEMsSUFBSSxFQUFFLFNBQVMsUUFBUSxZQUFZO29CQUMvQixVQUFVLFNBQVMsUUFBUTs7Z0JBRS9CLFVBQVUsU0FBUyxNQUFNLFNBQVMsTUFBTTs7WUFFNUMsT0FBTzs7UUFHSixVQUFBLGdCQUFQLFVBQXFCLGVBQXNDLHdCQUFzQjtZQUM3RSxJQUFJLG1CQUFtQixRQUFRLFVBQVUsV0FBVyxjQUFjO1lBQ2xFLElBQUksa0JBQWtCO2dCQUNsQixPQUFPLFFBQVEsVUFBVSxVQUFVLGtCQUFrQjs7aUJBQ2xEOztnQkFFSCxRQUFRLEtBQUssTUFBTSxjQUFjLE9BQU8sS0FBSztnQkFDN0MsSUFBSSxPQUFPLElBQUksUUFBUTtnQkFDdkIsS0FBSyxLQUFLLGNBQWM7Z0JBQ3hCLEtBQUssT0FBTyxjQUFjO2dCQUMxQixPQUFPOzs7UUFJUixVQUFBLGFBQVAsVUFBa0IsTUFBWTtZQUMxQixJQUFJLG1CQUFtQixRQUFRLEtBQUssR0FBRyxZQUFZO1lBQ25ELElBQUksUUFBUSxZQUFZLG1CQUFtQjtnQkFDdkMsUUFBUSxLQUFLLE1BQU0sT0FBTyxLQUFLOztZQUVuQyxPQUFPOzs7UUFJSixVQUFBLFlBQVAsVUFBaUIsa0JBQXFDLE1BQTJCO1lBQzdFLElBQUksRUFBRSxVQUFVLFFBQVEsUUFBUSxPQUFPO2dCQUNuQyxRQUFRLE1BQU0sbUNBQW1DOztZQUVyRCxJQUFJLFdBQVcsSUFBVSxpQkFBaUI7WUFDMUMsU0FBUztZQUNULFNBQVMsS0FBSyxLQUFLO1lBQ25CLFNBQVMsYUFBYSxLQUFLLGFBQWEsS0FBSyxhQUFhO1lBQzFELFNBQVMsU0FBUztZQUNsQixPQUFPOztRQUdKLFVBQUEsUUFBUCxVQUFhLGVBQW9CLGVBQW9CLFFBQWU7O1lBRWhFLElBQUksV0FBVztZQUNmLElBQUksY0FBYyxlQUFlO2dCQUM3QixXQUFXLFVBQVUsbUNBQW1DLGNBQWMsVUFBVTs7WUFHcEYsSUFBSSxRQUFRLFFBQVEsY0FBYyxPQUFPO2dCQUNyQyxVQUFVLGdCQUFnQixlQUFlLGVBQWUsUUFBUTs7aUJBQzdEO2dCQUNILFVBQVUsZUFBZSxjQUFjLE1BQU0sZUFBZSxRQUFROzs7UUFJckUsVUFBQSxrQkFBUCxVQUF1QixlQUFnQyxlQUF1QyxRQUFpQixVQUFRO1lBQ25ILEtBQWlCLElBQUEsS0FBQSxHQUFBLEtBQUEsY0FBYyxNQUFkLEtBQUEsR0FBQSxRQUFBLE1BQW1CO2dCQUEvQixJQUFJLE9BQUksR0FBQTtnQkFDVCxJQUFJLFdBQVcsUUFBUSxVQUFVLFdBQVcsS0FBSztnQkFDakQsSUFBSSxFQUFFLEtBQUssTUFBTSxnQkFBZ0I7b0JBQzdCLGNBQWMsS0FBSyxNQUFNLElBQVUsU0FBUztvQkFDNUMsY0FBYyxLQUFLLElBQUk7O2dCQUUzQixVQUFVLGVBQWUsTUFBTSxjQUFjLEtBQUssS0FBSyxRQUFROzs7UUFJaEUsVUFBQSxpQkFBUCxVQUFzQixlQUE4QixlQUEwQixRQUFpQixVQUFRO1lBQ25HLGNBQWMsYUFBYSxjQUFjO1lBQ3pDLGNBQWMsS0FBSyxjQUFjO1lBQ2pDLGNBQWMsU0FBUztZQUN2QixVQUFVLHFCQUFxQixjQUFjLGVBQWUsY0FBYyxlQUFlLFVBQVU7O1FBR2hHLFVBQUEsdUJBQVAsVUFBNEIsb0JBQWdDLG9CQUFnQyxnQkFBZ0IsUUFBZTs7WUFFdkgsUUFBUSxRQUFRLG9CQUFvQixVQUFDLGdCQUFnQixjQUFZOztnQkFHN0QsSUFBSSxFQUFFLGdCQUFnQix3QkFBd0IsVUFBVSxpQkFBaUI7b0JBQ3JFLG1CQUFtQixnQkFBZ0IsRUFBRSxNQUFNOzs7Z0JBSS9DLElBQUksQ0FBQyxlQUFlO29CQUNoQjtnQkFFSixJQUFJLE9BQU8sY0FBYyxpQkFBaUIsT0FBTyxjQUFjLGNBQWMsU0FBUztvQkFDbEYsSUFBSSxlQUFlLEtBQUssU0FBUzt3QkFDN0I7b0JBQ0osSUFBSSxtQkFBbUIsUUFBUSxVQUFVLFdBQVcsZUFBZSxLQUFLLEdBQUc7b0JBQzNFLElBQUksa0JBQWtCO3dCQUNsQixtQkFBbUIsY0FBYyxPQUFPO3dCQUN4QyxRQUFRLFFBQVEsZUFBZSxNQUFNLFVBQUMsZ0JBQXFDOzRCQUN2RSxJQUFJLE1BQU0sVUFBVSxvQkFBb0IsZ0JBQWdCOzRCQUN4RCxtQkFBbUIsY0FBYyxLQUFLLElBQUksTUFBTTs7OztxQkFHckQ7b0JBQ0gsbUJBQW1CLGNBQWMsT0FBTyxVQUFVLG9CQUFvQixlQUFlLE1BQU07Ozs7UUFLaEcsVUFBQSxzQkFBUCxVQUEyQixVQUFpQyxnQkFBYztZQUN0RSxJQUFJLFNBQVMsUUFBUTtnQkFDakIsU0FBUyxNQUFNLGVBQWUsU0FBUyxPQUN6Qzs7Z0JBRUUsT0FBTyxlQUFlLFNBQVMsTUFBTSxTQUFTOztpQkFDM0M7O2dCQUVILE9BQU87OztRQVFuQixPQUFBOztJQWpLYSxRQUFBLFlBQVM7R0FEbkIsWUFBQSxVQUFPO0FDc0pkO0FDdEpBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsUUFBQSxZQUFBOzs7UUFjSSxTQUFBLEtBQ2MsaUJBQ0EscUJBQW1CO1lBRG5CLEtBQUEsa0JBQUE7WUFDQSxLQUFBLHNCQUFBO1lBZlAsS0FBQSxXQUFtQjtZQUNuQixLQUFBLFlBQXNDO1lBRXRDLEtBQUEsa0JBQTBCO1lBQzFCLEtBQUEsZ0JBQWdCLFlBQUE7WUFDaEIsS0FBQSxlQUFlLFlBQUE7WUFDZixLQUFBLGdCQUFnQixZQUFBO1lBQ2hCLEtBQUEsa0JBQWtCLFlBQUE7WUFVckIsUUFBUSxLQUFLLEtBQUs7WUFDbEIsUUFBUSxLQUFLLFdBQVc7O1FBR3JCLEtBQUEsVUFBQSxZQUFQLFVBQWlCLE9BQUs7WUFDbEIsSUFBSSxNQUFNLFFBQVEsS0FBSyxXQUFXO2dCQUM5QixPQUFPOztZQUVYLEtBQUssVUFBVSxNQUFNLFFBQVE7WUFDN0IsT0FBTzs7UUFHSixLQUFBLFVBQUEsY0FBUCxVQUFtQixNQUFZO1lBQzNCLE9BQU8sS0FBSyxVQUFVOztRQUduQixLQUFBLFVBQUEsa0JBQVAsVUFBdUIsUUFBYztZQUNqQyxLQUFLLG1CQUFtQjtZQUN4QixJQUFJLEtBQUssb0JBQW9CLEdBQUc7Z0JBQzVCLEtBQUs7O2lCQUNGLElBQUksS0FBSyxvQkFBb0IsR0FBRztnQkFDbkMsS0FBSzs7O1FBN0JDLEtBQUEsS0FBb0I7UUFDcEIsS0FBQSxXQUFnQjtRQStCbEMsT0FBQTs7SUExQ2EsUUFBQSxPQUFJO0lBMkNqQixRQUFRLE9BQU8sb0JBQW9CLFFBQVEsZUFBZTtHQTVDdkQsWUFBQSxVQUFPO0FDMkNkO0FDM0NBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsWUFBQSxZQUFBO1FBQUEsU0FBQSxXQUFBO1lBSVcsS0FBQSxTQUFTO1lBSVQsS0FBQSxnQkFBcUI7WUFHckIsS0FBQSxhQUFxQjs7UUFFckIsU0FBQSxVQUFBLFFBQVAsWUFBQTtZQUNJLElBQUksV0FBVyxJQUFVLEtBQUs7WUFDOUIsS0FBSyxJQUFJLFlBQVksTUFBTTtnQkFDdkIsSUFBSSxPQUFPLEtBQUssY0FBYyxVQUFVO29CQUNwQyxTQUFTLFlBQVksS0FBSzs7O1lBR2xDLE9BQU87Ozs7OztRQU9KLFNBQUEsVUFBQSxXQUFQLFlBQUE7WUFDSSxJQUFJLFFBQVEsS0FBSyxPQUFPLE1BQU07Z0JBQzFCLE1BQU0sd0NBQXdDLEtBQUssT0FBTzs7O1lBRzlELEtBQUssUUFBUTtZQUNiLE9BQU8sUUFBUSxLQUFLLEdBQUcsVUFBVTs7UUFHOUIsU0FBQSxVQUFBLFVBQVAsWUFBQTtZQUNJLE9BQU8sS0FBSyxPQUFPLEtBQUssT0FBTyxLQUFLOzs7UUFJakMsU0FBQSxVQUFBLE1BQVAsWUFBQTtZQUNJLElBQUksV0FBVyxLQUFLO1lBQ3BCLFNBQVM7WUFDVCxPQUFPOztRQUdKLFNBQUEsVUFBQSxRQUFQLFlBQUE7WUFDSSxJQUFJLE9BQU87WUFDWCxLQUFLLEtBQUs7WUFDVixLQUFLLGFBQWE7WUFDbEIsS0FBSyxnQkFBZ0I7WUFDckIsUUFBUSxRQUFRLEtBQUssT0FBTyxlQUFlLFVBQUMsT0FBTyxLQUFHO2dCQUNsRCxLQUFLLGNBQWMsT0FBTztnQkFDMUIsS0FBSyxjQUFjLEtBQUssVUFBVTs7WUFFdEMsS0FBSyxTQUFTOztRQUdYLFNBQUEsVUFBQSxXQUFQLFVBQWdCLFFBQXdCO1lBQXhDLElBQUEsUUFBQTtZQUNJLFNBQVMsUUFBUSxPQUFPLElBQUksUUFBUSxLQUFLLFFBQVE7WUFDakQsS0FBSyxTQUFTLFFBQVEsT0FBTyxJQUFJLFFBQVEsS0FBSyxRQUFRLEtBQUs7WUFFM0QsSUFBSSxnQkFBZ0I7WUFDcEIsSUFBSSxXQUFXO1lBQ2YsSUFBSSxlQUFlOztZQUduQixRQUFRLFFBQVEsS0FBSyxlQUFlLFVBQUMsY0FBYyxnQkFBYztnQkFFN0QsSUFBSSxNQUFLLE9BQU8sY0FBYyxtQkFBbUIsTUFBSyxPQUFPLGNBQWMsZ0JBQWdCLFNBQVM7O29CQUVoRyxjQUFjLGtCQUFrQixFQUFFLE1BQU07b0JBRXhDLFFBQVEsUUFBUSxhQUFhLE1BQU0sVUFBQyxVQUEyQjt3QkFDM0QsSUFBSSxtQkFBbUIsRUFBRSxJQUFJLFNBQVMsSUFBSSxNQUFNLFNBQVM7d0JBQ3pELGNBQWMsZ0JBQWdCLFFBQVEsS0FBSzs7d0JBRzNDLElBQUksY0FBYyxTQUFTLE9BQU8sTUFBTSxTQUFTO3dCQUNqRCxJQUFJLGFBQWEsUUFBUSxpQkFBaUIsQ0FBQyxLQUFLLE9BQU8sUUFBUSxRQUFRLG9CQUFvQixDQUFDLEdBQUc7NEJBQzNGLGFBQWEsS0FBSzs0QkFDbEIsU0FBUyxLQUFLLFNBQVMsU0FBUyxJQUFLOzs7O3FCQUcxQzs7b0JBRUgsSUFBSSxFQUFFLFFBQVEsYUFBYSxTQUFTLENBQUMsUUFBUSxPQUFPLElBQUksYUFBYSxPQUFPO3dCQUN4RSxRQUFRLEtBQUssaUJBQWlCOztvQkFHbEMsSUFBSSxhQUFhLEtBQUssTUFBTSxhQUFhLEtBQUssTUFBTTt3QkFDaEQsY0FBYyxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsSUFBSSxhQUFhLEtBQUssSUFBSSxNQUFNLGFBQWEsS0FBSzs7eUJBQ3pGO3dCQUNILGNBQWMsa0JBQWtCLEVBQUUsTUFBTTs7O29CQUk1QyxJQUFJLGNBQWMsYUFBYSxLQUFLLE9BQU8sTUFBTSxhQUFhLEtBQUs7b0JBQ25FLElBQUksYUFBYSxRQUFRLGlCQUFpQixDQUFDLEtBQUssT0FBTyxRQUFRLFFBQVEsYUFBYSxLQUFLLFVBQVUsQ0FBQyxHQUFHO3dCQUNuRyxhQUFhLEtBQUs7d0JBQ2xCLFNBQVMsS0FBSyxhQUFhLEtBQUssU0FBUyxJQUFLOzs7O1lBSzFELElBQUksTUFBbUI7Z0JBQ25CLE1BQU07b0JBQ0YsTUFBTSxLQUFLO29CQUNYLElBQUksS0FBSztvQkFDVCxZQUFZLEtBQUs7b0JBQ2pCLGVBQWU7OztZQUl2QixJQUFJLFNBQVMsU0FBUyxHQUFHO2dCQUNyQixJQUFJLFdBQVc7O1lBR25CLE9BQU87O1FBR0osU0FBQSxVQUFBLE1BQVAsVUFBd0MsSUFBWSxRQUE0QixZQUF1QixVQUFtQjtZQUN0SCxPQUFPLEtBQUssT0FBTyxJQUFJLFFBQVEsWUFBWSxVQUFVOztRQUdsRCxTQUFBLFVBQUEsU0FBUCxVQUFjLElBQVksUUFBNEIsWUFBdUIsVUFBbUI7WUFDNUYsS0FBSyxPQUFPLElBQUksUUFBUSxZQUFZLFVBQVU7O1FBRzNDLFNBQUEsVUFBQSxNQUFQLFVBQXdDLFFBQTRCLFlBQXVCLFVBQW1CO1lBQzFHLE9BQU8sS0FBSyxPQUFPLE1BQU0sUUFBUSxZQUFZLFVBQVU7O1FBR3BELFNBQUEsVUFBQSxtQkFBUCxVQUFxRCxnQkFDakQsUUFBNEIsWUFBdUIsVUFBbUI7WUFFdEUsT0FBTyxLQUFLLE9BQU8sZ0JBQWdCLFFBQVEsWUFBWSxVQUFVOztRQUc5RCxTQUFBLFVBQUEsT0FBUCxVQUF5QyxRQUE0QixZQUF1QixVQUFtQjtZQUMzRyxPQUFPLEtBQUssT0FBTyxNQUFNLFFBQVEsWUFBWSxVQUFVOzs7OztRQU1uRCxTQUFBLFVBQUEsU0FBUixVQUFlLElBQVksUUFBeUIsWUFBWSxVQUFVLFdBQWlCOztZQUV2RixJQUFJLFFBQVEsV0FBVyxTQUFTO2dCQUM1QixXQUFXO2dCQUNYLGFBQWE7Z0JBQ2IsU0FBUyxRQUFRLE9BQU8sSUFBSSxRQUFRLEtBQUs7O2lCQUN0QztnQkFDSCxJQUFJLFFBQVEsWUFBWSxTQUFTO29CQUM3QixTQUFTLFFBQVEsT0FBTyxJQUFJLFFBQVEsS0FBSzs7cUJBQ3RDO29CQUNILFNBQVMsUUFBUSxPQUFPLElBQUksUUFBUSxLQUFLLFFBQVE7OztZQUl6RCxhQUFhLFFBQVEsV0FBVyxjQUFjLGFBQWEsWUFBQTtZQUMzRCxXQUFXLFFBQVEsV0FBVyxZQUFZLFdBQVcsWUFBQTtZQUVyRCxLQUFLLFNBQVMsUUFBUSxPQUFPLElBQUksUUFBUSxLQUFLLFFBQVEsS0FBSztZQUUzRCxRQUFRO2dCQUNKLEtBQUs7b0JBQ0wsT0FBTyxLQUFLLEtBQUssSUFBSSxRQUFRLFlBQVk7Z0JBQ3pDLEtBQUs7b0JBQ0wsT0FBTyxPQUFPO29CQUNkLE9BQU8sS0FBSyxLQUFLLFFBQVEsWUFBWTtnQkFDckMsS0FBSztvQkFDTCxPQUFPLEtBQUssUUFBUSxJQUFJLFFBQVEsWUFBWTtnQkFDNUMsS0FBSztvQkFDTCxPQUFPLEtBQUssS0FBSyxRQUFRLFlBQVk7Z0JBQ3JDLEtBQUs7b0JBQ0wsT0FBTyxLQUFLLE1BQU0sUUFBUSxZQUFZOzs7UUFJdkMsU0FBQSxVQUFBLE9BQVAsVUFBWSxJQUFZLFFBQVEsWUFBWSxVQUFRO1lBQXBELElBQUEsUUFBQTs7WUFFSSxJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLEtBQUssUUFBUTtZQUNiLE9BQU8sVUFBVSxLQUFLLFdBQVcsT0FBTyxXQUFXO1lBRW5ELElBQUksV0FBVyxLQUFLLGFBQWEsU0FBUyxLQUFLLGFBQWEsTUFBTSxNQUFNLEtBQUssYUFBYSxNQUFNLE1BQU0sS0FBSztZQUUzRyxRQUFRLEtBQUssU0FBUztpQkFDckIsSUFBSSxLQUFLO2lCQUNULEtBQ0csVUFBQSxTQUFPO2dCQUNILFFBQUEsVUFBVSxNQUFNLFFBQVEsTUFBTSxVQUFVLE1BQUs7Z0JBQzdDLE1BQUssa0JBQWtCO2dCQUN2QixXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVM7O1lBSWpCLE9BQU87O1FBR0osU0FBQSxVQUFBLE9BQVAsVUFBWSxRQUFRLFlBQVksVUFBUTtZQUF4QyxJQUFBLFFBQUE7O1lBR0ksSUFBSSxPQUFPLElBQUksUUFBUTtZQUN2QixLQUFLLFFBQVEsS0FBSztZQUNsQixPQUFPLE9BQU8sS0FBSyxRQUFRLE9BQU8sUUFBUTtZQUMxQyxPQUFPLFVBQVUsS0FBSyxXQUFXLE9BQU8sV0FBVzs7WUFHbkQsSUFBSSxXQUFXOztZQUVmLElBQUksQ0FBQyxPQUFPLFFBQVEsS0FBSyxhQUFhLFNBQVMsS0FBSyxhQUFhLFdBQVcsY0FBYyxLQUFLLFdBQVc7O2dCQUV0RyxRQUFRLFFBQVEsS0FBSyxhQUFhLE9BQU8sVUFBQyxPQUFPLEtBQUc7b0JBQ2hELFNBQVMsT0FBTzs7O1lBSXhCLFFBQVEsS0FBSyxTQUFTO2lCQUNyQixJQUFJLEtBQUs7aUJBQ1QsS0FDRyxVQUFBLFNBQU87Z0JBQ0gsUUFBQSxVQUFVLE1BQU0sUUFBUSxNQUFNLFVBQVUsTUFBSzs7Ozs7Z0JBSzdDLElBQUksQ0FBQyxPQUFPLE1BQU07b0JBQ2QsTUFBSyxVQUFVOztnQkFFbkIsV0FBVztlQUVmLFVBQUEsT0FBSztnQkFDRCxTQUFTOztZQUdqQixPQUFPOztRQUdKLFNBQUEsVUFBQSxVQUFQLFVBQWUsSUFBWSxRQUFRLFlBQVksVUFBUTtZQUF2RCxJQUFBLFFBQUE7O1lBRUksSUFBSSxPQUFPLElBQUksUUFBUTtZQUN2QixLQUFLLFFBQVEsS0FBSztZQUNsQixLQUFLLFFBQVE7WUFFYixRQUFRLEtBQUssU0FBUztpQkFDckIsT0FBTyxLQUFLO2lCQUNaLEtBQ0csVUFBQSxTQUFPO2dCQUNILElBQUksTUFBSyxhQUFhLFNBQVMsTUFBSyxhQUFhLE1BQU0sS0FBSztvQkFDeEQsTUFBSyxhQUFhLE1BQU0sSUFBSSxRQUFRO29CQUNwQyxNQUFLLGFBQWEsTUFBTSxJQUFJLGdCQUFnQjtvQkFDNUMsT0FBTyxNQUFLLGFBQWEsTUFBTTs7Z0JBRW5DLFdBQVc7ZUFFZixVQUFBLE9BQUs7Z0JBQ0QsU0FBUzs7O1FBS2QsU0FBQSxVQUFBLFFBQVAsVUFBYSxRQUFpQixZQUFzQixVQUFrQjtZQUNsRSxJQUFJLFNBQVMsS0FBSyxTQUFTOztZQUczQixJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLEtBQUssTUFBTSxLQUFLLFFBQVEsS0FBSztZQUM3QixPQUFPLFVBQVUsS0FBSyxXQUFXLE9BQU8sV0FBVztZQUVuRCxJQUFJLFdBQVcsS0FBSztZQUVwQixJQUFJLFVBQVUsUUFBUSxLQUFLLFNBQVMsWUFBWSxLQUFLLEtBQUssT0FBTyxLQUFLLEtBQUssUUFBUSxRQUFRO1lBRTNGLFFBQVEsS0FDSixVQUFBLFNBQU87Z0JBQ0gsSUFBSSxRQUFRLFFBQVEsS0FBSztnQkFDekIsU0FBUyxhQUFhLE1BQU07Z0JBQzVCLFNBQVMsS0FBSyxNQUFNO2dCQUVwQixXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVMsVUFBVSxRQUFRLE1BQU0sT0FBTzs7WUFJaEQsT0FBTzs7UUFHSixTQUFBLFVBQUEsa0JBQVAsVUFBb0QsVUFBYSxZQUFtQjtZQUNoRixJQUFJLGFBQWEsU0FBUztZQUMxQixJQUFJLENBQUMsWUFBWTtnQkFDYixhQUFhLFVBQVUsS0FBSyxNQUFNLEtBQUssV0FBVzs7WUFHdEQsY0FBYyxhQUFhLGFBQWEsU0FBUztZQUNqRCxJQUFJLEVBQUUsY0FBYyxLQUFLLGdCQUFnQjtnQkFDckMsS0FBSyxjQUFjLGNBQWMsRUFBRSxNQUFNOztZQUc3QyxJQUFJLEtBQUssT0FBTyxjQUFjLFlBQVksU0FBUztnQkFDL0MsS0FBSyxjQUFjLFlBQVksUUFBUSxjQUFjOztpQkFDbEQ7Z0JBQ0gsS0FBSyxjQUFjLFlBQVksVUFBVTs7O1FBSTFDLFNBQUEsVUFBQSxxQkFBUCxVQUEwQixZQUFvQixJQUFVO1lBQ3BELElBQUksRUFBRSxjQUFjLEtBQUssZ0JBQWdCO2dCQUNyQyxPQUFPOztZQUVYLElBQUksRUFBRSxVQUFVLEtBQUssY0FBYyxjQUFjO2dCQUM3QyxPQUFPOztZQUVYLElBQUksRUFBRSxNQUFNLEtBQUssY0FBYyxZQUFZLFVBQVU7Z0JBQ2pELE9BQU87O1lBRVgsT0FBTyxLQUFLLGNBQWMsWUFBWSxRQUFRO1lBQzlDLE9BQU87O1FBR0gsU0FBQSxVQUFBLFlBQVIsVUFBa0IsV0FBUztZQUN2QixJQUFJLFVBQVUsSUFBSTtnQkFDZCxLQUFLLGtCQUFrQjs7aUJBQ3BCO2dCQUNILEtBQUssYUFBYSxXQUFXLFlBQVksS0FBSztnQkFDOUMsS0FBSyxtQkFBbUI7OztRQUl4QixTQUFBLFVBQUEscUJBQVIsVUFBd0QsV0FBbUI7WUFBM0UsSUFBQSxRQUFBO1lBQ0ksUUFBUSxRQUFRLFdBQVcsVUFBQyxVQUFRO2dCQUNoQyxNQUFLLGtCQUFrQjs7O1FBSXZCLFNBQUEsVUFBQSxvQkFBUixVQUF1RCxVQUFXO1lBQzlELElBQUksU0FBUyxJQUFJO2dCQUNiLEtBQUssYUFBYSxNQUFNLFNBQVMsTUFBTTs7Ozs7O1FBT3hDLFNBQUEsVUFBQSxhQUFQLFlBQUE7WUFDSSxPQUFPLFFBQUEsVUFBVSxXQUFXLEtBQUs7O1FBRXpDLE9BQUE7O0lBcFdhLFFBQUEsV0FBUTtHQURsQixZQUFBLFVBQU87QUMrU2Q7QUMvU0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdUJBO0FDdkJBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsZ0JBQUEsWUFBQTs7O1FBR0ksU0FBQSxhQUNjLGFBQVc7WUFBWCxLQUFBLGNBQUE7O1FBSWxCLE9BQUE7O0lBUmEsUUFBQSxlQUFZO0lBVXpCLFFBQVEsT0FBTyxvQkFBb0IsUUFBUSx1QkFBdUI7R0FYL0QsWUFBQSxVQUFPO0FDWWQ7QUNaQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGlCQUFBLFlBQUE7O1FBR0ksU0FBQSxnQkFBQTs7UUFJTyxjQUFBLFVBQUEsV0FBUCxVQUFnQixhQUFtQjtZQUMvQixPQUFPOztRQUVmLE9BQUE7O0lBVmEsUUFBQSxnQkFBYTtHQUR2QixZQUFBLFVBQU87QUNhZDtBQ2JBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsa0JBQUEsWUFBQTs7UUFHSSxTQUFBLGlCQUFBOztRQU9PLGVBQUEsVUFBQSxNQUFQLFVBQVcsS0FBRzs7OztRQUtQLGVBQUEsVUFBQSxRQUFQLFVBQWEsS0FBSyxNQUFJOzs7O1FBTTFCLE9BQUE7O0lBckJhLFFBQUEsaUJBQWM7R0FEeEIsWUFBQSxVQUFPO0FDa0JkIiwiZmlsZSI6InRzLWFuZ3VsYXItanNvbmFwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuXG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLycsXG4gICAgICAgIGRlbGF5OiAwLFxuICAgICAgICB1bmlmeV9jb25jdXJyZW5jeTogdHJ1ZSxcbiAgICAgICAgY2FjaGVfcHJlcmVxdWVzdHM6IHRydWVcbiAgICB9KTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xuXG59KShhbmd1bGFyKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJyxcbiAgICAgICAgZGVsYXk6IDAsXG4gICAgICAgIHVuaWZ5X2NvbmN1cnJlbmN5OiB0cnVlLFxuICAgICAgICBjYWNoZV9wcmVyZXF1ZXN0czogdHJ1ZVxuICAgIH0pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLCBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcbn0pKGFuZ3VsYXIpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBCYXNlIHtcbiAgICAgICAgc3RhdGljIFBhcmFtczogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBzdGF0aWMgU2NoZW1hID0ge1xuICAgICAgICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgICB9O1xuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEJhc2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBCYXNlKCkge1xuICAgICAgICB9XG4gICAgICAgIEJhc2UuUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcbiAgICAgICAgQmFzZS5TY2hlbWEgPSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBCYXNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5CYXNlID0gQmFzZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBIdHRwIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCAkaHR0cCxcbiAgICAgICAgICAgIHByb3RlY3RlZCAkdGltZW91dCxcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJHFcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBkZWxldGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdERUxFVEUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQocGF0aDogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKHBhdGgsICdHRVQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3RlY3RlZCBleGVjKHBhdGg6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGRhdGE/OiBKc29uYXBpLklEYXRhT2JqZWN0KSB7XG4gICAgICAgICAgICBsZXQgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgbGV0IHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG5cbiAgICAgICAgICAgIGxldCBkZWZlcnJlZCA9IHRoaXMuJHEuZGVmZXIoKTtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRpbWVvdXQganVzdCBmb3IgZGV2ZWxvcCBlbnZpcm9ubWVudFxuICAgICAgICAgICAgICAgICAgICBzZWxmLiR0aW1lb3V0KCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgICAgIH0sIHNlbGYucnNKc29uYXBpQ29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb2ZmbGluZT9cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgKHVzZSBKc29uYXBpQ29yZS5sb2FkaW5nc09mZmxpbmUgZm9yIGNhdGNoIGl0KSBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc09mZmxpbmUoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyAodXNlIEpzb25hcGlDb3JlLmxvYWRpbmdzRXJyb3IgZm9yIGNhdGNoIGl0KSBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc0Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCAkdGltZW91dCwgcnNKc29uYXBpQ29uZmlnLCAkcSkge1xuICAgICAgICAgICAgdGhpcy4kaHR0cCA9ICRodHRwO1xuICAgICAgICAgICAgdGhpcy4kdGltZW91dCA9ICR0aW1lb3V0O1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLiRxID0gJHE7XG4gICAgICAgIH1cbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0RFTEVURScpO1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAocGF0aCwgbWV0aG9kLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKDEpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dCBqdXN0IGZvciBkZXZlbG9wIGVudmlyb25tZW50XG4gICAgICAgICAgICAgICAgc2VsZi4kdGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sIHNlbGYucnNKc29uYXBpQ29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgIGlmIChlcnJvci5zdGF0dXMgPD0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBvZmZsaW5lP1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkuSHR0cC5leGVjICh1c2UgSnNvbmFwaUNvcmUubG9hZGluZ3NPZmZsaW5lIGZvciBjYXRjaCBpdCkgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc09mZmxpbmUoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyAodXNlIEpzb25hcGlDb3JlLmxvYWRpbmdzRXJyb3IgZm9yIGNhdGNoIGl0KSBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLmxvYWRpbmdzRXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBQYXRoTWFrZXIge1xuICAgICAgICBwdWJsaWMgcGF0aHM6IEFycmF5PFN0cmluZz4gPSBbXTtcbiAgICAgICAgcHVibGljIGluY2x1ZGVzOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgcHVibGljIGFkZFBhdGgodmFsdWU6IFN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzZXRJbmNsdWRlKHN0cmluZ3NfYXJyYXk6IEFycmF5PFN0cmluZz4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldCgpOiBTdHJpbmcge1xuICAgICAgICAgICAgbGV0IGdldF9wYXJhbXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFBhdGhNYWtlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIFBhdGhNYWtlcigpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmFkZFBhdGggPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMucHVzaCh2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuc2V0SW5jbHVkZSA9IGZ1bmN0aW9uIChzdHJpbmdzX2FycmF5KSB7XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gc3RyaW5nc19hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZ2V0X3BhcmFtcyA9IFtdO1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aHMuam9pbignLycpICtcbiAgICAgICAgICAgICAgICAoZ2V0X3BhcmFtcy5sZW5ndGggPiAwID8gJz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBQYXRoTWFrZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlBhdGhNYWtlciA9IFBhdGhNYWtlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb252ZXJ0ZXIge1xuXG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBSZXNvdXJjZXMgYXJyYXlzIHdpdGhvdXQgW2tleXNdXG4gICAgICAgICoqL1xuICAgICAgICBzdGF0aWMganNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoXG4gICAgICAgICAgICBqc29uX2FycmF5OiBBcnJheTxKc29uYXBpLklEYXRhUmVzb3VyY2U+LFxuICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXk/OiBPYmplY3QsIC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPixcbiAgICAgICAgICAgIHVzZV9pZF9mb3Jfa2V5ID0gZmFsc2VcbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGlmICghZGVzdGluYXRpb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGRhdGEgb2YganNvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmpzb24ycmVzb3VyY2UoZGF0YSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmICh1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmNsdWRlZCBmb3IgZXhhbXBsZSBuZWVkIGEgZXh0cmEgcGFyYW1ldGVyXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVzdGluYXRpb25fYXJyYXkucHVzaChyZXNvdXJjZS5pZCArIHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZGVzdGluYXRpb25fYXJyYXlbJyRjb3VudCddID0gY291bnQ7IC8vIHByb2JsZW0gd2l0aCB0b0FycmF5IG9yIGFuZ3VsYXIuZm9yRWFjaCBuZWVkIGEgIWlzT2JqZWN0XG4gICAgICAgICAgICByZXR1cm4gZGVzdGluYXRpb25fYXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gaW5kZXhlZCBSZXNvdXJjZXMgYXJyYXkgYnkgW3R5cGVdW2lkXVxuICAgICAgICAqKi9cbiAgICAgICAgc3RhdGljIGpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUgKFxuICAgICAgICAgICAganNvbl9hcnJheTogQXJyYXk8SnNvbmFwaS5JRGF0YVJlc291cmNlPixcbiAgICAgICAgICAgIGluc3RhbmNlX3JlbGF0aW9uc2hpcHM6IGJvb2xlYW5cbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGxldCBhbGxfcmVzb3VyY2VzOmFueSA9IHsgfSA7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgbGV0IHJlc291cmNlcyA9IHsgfTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxfcmVzb3VyY2VzLCAocmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIShyZXNvdXJjZS50eXBlIGluIHJlc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdID0geyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV1bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZXM7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMganNvbjJyZXNvdXJjZShqc29uX3Jlc291cmNlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UsIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gc2VydmljZSBub3QgcmVnaXN0ZXJlZFxuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyBqc29uX3Jlc291cmNlLnR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBqc29uMnJlc291cmNlKCknKTtcbiAgICAgICAgICAgICAgICBsZXQgdGVtcCA9IG5ldyBKc29uYXBpLlJlc291cmNlKCk7XG4gICAgICAgICAgICAgICAgdGVtcC5pZCA9IGpzb25fcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICAgICAgdGVtcC50eXBlID0ganNvbl9yZXNvdXJjZS50eXBlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGdldFNlcnZpY2UodHlwZTogc3RyaW5nKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIHJldHVybiBhIHJlc291cmNlIHR5cGUocmVzb3J1Y2Vfc2VydmljZSkgd2l0aCBkYXRhKGRhdGEpICovXG4gICAgICAgIHN0YXRpYyBwcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZTogSnNvbmFwaS5JUmVzb3VyY2UsIGRhdGE6IEpzb25hcGkuSURhdGFSZXNvdXJjZSk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmICghKCd0eXBlJyBpbiBkYXRhICYmICdpZCcgaW4gZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdKc29uYXBpIFJlc291cmNlIGlzIG5vdCBjb3JyZWN0JywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBuZXcgKDxhbnk+cmVzb3VyY2Vfc2VydmljZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgYnVpbGQoZG9jdW1lbnRfZnJvbTogYW55LCByZXNvdXJjZV9kZXN0OiBhbnksIHNjaGVtYTogSVNjaGVtYSkge1xuICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgaWYgKCdpbmNsdWRlZCcgaW4gZG9jdW1lbnRfZnJvbSkge1xuICAgICAgICAgICAgICAgIGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoZG9jdW1lbnRfZnJvbS5pbmNsdWRlZCwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0FycmF5KGRvY3VtZW50X2Zyb20uZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2VzKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbS5kYXRhLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBfYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbTogSURhdGFDb2xsZWN0aW9uLCByZXNvdXJjZV9kZXN0OiBBcnJheTxJRGF0YUNvbGxlY3Rpb24+LCBzY2hlbWE6IElTY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBkYXRhIG9mIGRvY3VtZW50X2Zyb20uZGF0YSkge1xuICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoZGF0YS50eXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoIShkYXRhLmlkIGluIHJlc291cmNlX2Rlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0gPSBuZXcgKDxhbnk+cmVzb3VyY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0ucmVzZXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlKGRhdGEsIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0sIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9idWlsZFJlc291cmNlKGRvY3VtZW50X2Zyb206IElEYXRhUmVzb3VyY2UsIHJlc291cmNlX2Rlc3Q6IElSZXNvdXJjZSwgc2NoZW1hOiBJU2NoZW1hLCBpbmNsdWRlZCkge1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5hdHRyaWJ1dGVzID0gZG9jdW1lbnRfZnJvbS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5pZCA9IGRvY3VtZW50X2Zyb20uaWQ7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXBzKGRvY3VtZW50X2Zyb20ucmVsYXRpb25zaGlwcywgcmVzb3VyY2VfZGVzdC5yZWxhdGlvbnNoaXBzLCBpbmNsdWRlZCwgc2NoZW1hKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBfX2J1aWxkUmVsYXRpb25zaGlwcyhyZWxhdGlvbnNoaXBzX2Zyb206IEFycmF5PGFueT4sIHJlbGF0aW9uc2hpcHNfZGVzdDogQXJyYXk8YW55PiwgaW5jbHVkZWRfYXJyYXksIHNjaGVtYTogSVNjaGVtYSkge1xuICAgICAgICAgICAgLy8gcmVjb3JybyBsb3MgcmVsYXRpb25zaGlwcyBsZXZhbnRvIGVsIHNlcnZpY2UgY29ycmVzcG9uZGllbnRlXG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwc19mcm9tLCAocmVsYXRpb25fdmFsdWUsIHJlbGF0aW9uX2tleSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gcmVsYXRpb24gaXMgaW4gc2NoZW1hPyBoYXZlIGRhdGEgb3IganVzdCBsaW5rcz9cbiAgICAgICAgICAgICAgICBpZiAoIShyZWxhdGlvbl9rZXkgaW4gcmVsYXRpb25zaGlwc19kZXN0KSAmJiAoJ2RhdGEnIGluIHJlbGF0aW9uX3ZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzb21ldGltZSBkYXRhPW51bGwgb3Igc2ltcGxlIHsgfVxuICAgICAgICAgICAgICAgIGlmICghcmVsYXRpb25fdmFsdWUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDtcblxuICAgICAgICAgICAgICAgIGlmIChzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldICYmIHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YS5sZW5ndGggPCAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX3ZhbHVlLmRhdGFbMF0udHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0ge307IC8vIGZvcmNlIHRvIG9iamVjdCAobm90IGFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIChyZWxhdGlvbl92YWx1ZTogSnNvbmFwaS5JRGF0YVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRtcCA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YVt0bXAuaWRdID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUuZGF0YSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb246IEpzb25hcGkuSURhdGFSZXNvdXJjZSwgaW5jbHVkZWRfYXJyYXkpOiBKc29uYXBpLklSZXNvdXJjZSB8IEpzb25hcGkuSURhdGFSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAocmVsYXRpb24udHlwZSBpbiBpbmNsdWRlZF9hcnJheSAmJlxuICAgICAgICAgICAgICAgIHJlbGF0aW9uLmlkIGluIGluY2x1ZGVkX2FycmF5W3JlbGF0aW9uLnR5cGVdXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAvLyBpdCdzIGluIGluY2x1ZGVkXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluY2x1ZGVkX2FycmF5W3JlbGF0aW9uLnR5cGVdW3JlbGF0aW9uLmlkXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzb3VyY2Ugbm90IGluY2x1ZGVkLCByZXR1cm4gZGlyZWN0bHkgdGhlIG9iamVjdFxuICAgICAgICAgICAgICAgIHJldHVybiByZWxhdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cblxuXG5cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb252ZXJ0ZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBDb252ZXJ0ZXIoKSB7XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIFJlc291cmNlcyBhcnJheXMgd2l0aG91dCBba2V5c11cbiAgICAgICAgKiovXG4gICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheSA9IGZ1bmN0aW9uIChqc29uX2FycmF5LCBkZXN0aW5hdGlvbl9hcnJheSwgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+LFxuICAgICAgICAgICAgdXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgIGlmICh1c2VfaWRfZm9yX2tleSA9PT0gdm9pZCAwKSB7IHVzZV9pZF9mb3Jfa2V5ID0gZmFsc2U7IH1cbiAgICAgICAgICAgIGlmICghZGVzdGluYXRpb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAodmFyIF9pID0gMCwganNvbl9hcnJheV8xID0ganNvbl9hcnJheTsgX2kgPCBqc29uX2FycmF5XzEubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBqc29uX2FycmF5XzFbX2ldO1xuICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmpzb24ycmVzb3VyY2UoZGF0YSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmICh1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluY2x1ZGVkIGZvciBleGFtcGxlIG5lZWQgYSBleHRyYSBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZGVzdGluYXRpb25fYXJyYXlbJyRjb3VudCddID0gY291bnQ7IC8vIHByb2JsZW0gd2l0aCB0b0FycmF5IG9yIGFuZ3VsYXIuZm9yRWFjaCBuZWVkIGEgIWlzT2JqZWN0XG4gICAgICAgICAgICByZXR1cm4gZGVzdGluYXRpb25fYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBpbmRleGVkIFJlc291cmNlcyBhcnJheSBieSBbdHlwZV1baWRdXG4gICAgICAgICoqL1xuICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZSA9IGZ1bmN0aW9uIChqc29uX2FycmF5LCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgYWxsX3Jlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KGpzb25fYXJyYXksIGFsbF9yZXNvdXJjZXMsIGZhbHNlKTtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZXMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxfcmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIShyZXNvdXJjZS50eXBlIGluIHJlc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmpzb24ycmVzb3VyY2UgPSBmdW5jdGlvbiAoanNvbl9yZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGpzb25fcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwganNvbl9yZXNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBzZXJ2aWNlIG5vdCByZWdpc3RlcmVkXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIGpzb25fcmVzb3VyY2UudHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGpzb24ycmVzb3VyY2UoKScpO1xuICAgICAgICAgICAgICAgIHZhciB0ZW1wID0gbmV3IEpzb25hcGkuUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICB0ZW1wLmlkID0ganNvbl9yZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICB0ZW1wLnR5cGUgPSBqc29uX3Jlc291cmNlLnR5cGU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRlbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5nZXRTZXJ2aWNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsgdHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGdldFNlcnZpY2UoKScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH07XG4gICAgICAgIC8qIHJldHVybiBhIHJlc291cmNlIHR5cGUocmVzb3J1Y2Vfc2VydmljZSkgd2l0aCBkYXRhKGRhdGEpICovXG4gICAgICAgIENvbnZlcnRlci5wcm9jcmVhdGUgPSBmdW5jdGlvbiAocmVzb3VyY2Vfc2VydmljZSwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKCEoJ3R5cGUnIGluIGRhdGEgJiYgJ2lkJyBpbiBkYXRhKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0pzb25hcGkgUmVzb3VyY2UgaXMgbm90IGNvcnJlY3QnLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IG5ldyByZXNvdXJjZV9zZXJ2aWNlLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXMgPyBkYXRhLmF0dHJpYnV0ZXMgOiB7fTtcbiAgICAgICAgICAgIHJlc291cmNlLmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuYnVpbGQgPSBmdW5jdGlvbiAoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hKSB7XG4gICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgdmFyIGluY2x1ZGVkID0ge307XG4gICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBkb2N1bWVudF9mcm9tKSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShkb2N1bWVudF9mcm9tLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0FycmF5KGRvY3VtZW50X2Zyb20uZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2VzKGRvY3VtZW50X2Zyb20sIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlKGRvY3VtZW50X2Zyb20uZGF0YSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMgPSBmdW5jdGlvbiAoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCkge1xuICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBfYSA9IGRvY3VtZW50X2Zyb20uZGF0YTsgX2kgPCBfYS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IF9hW19pXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGRhdGEudHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKCEoZGF0YS5pZCBpbiByZXNvdXJjZV9kZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZV9kZXN0W2RhdGEuaWRdID0gbmV3IHJlc291cmNlLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0ucmVzZXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlKGRhdGEsIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0sIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UgPSBmdW5jdGlvbiAoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCkge1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5hdHRyaWJ1dGVzID0gZG9jdW1lbnRfZnJvbS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgcmVzb3VyY2VfZGVzdC5pZCA9IGRvY3VtZW50X2Zyb20uaWQ7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlzX25ldyA9IGZhbHNlO1xuICAgICAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXBzKGRvY3VtZW50X2Zyb20ucmVsYXRpb25zaGlwcywgcmVzb3VyY2VfZGVzdC5yZWxhdGlvbnNoaXBzLCBpbmNsdWRlZCwgc2NoZW1hKTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXBzID0gZnVuY3Rpb24gKHJlbGF0aW9uc2hpcHNfZnJvbSwgcmVsYXRpb25zaGlwc19kZXN0LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIGZ1bmN0aW9uIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSB7XG4gICAgICAgICAgICAgICAgLy8gcmVsYXRpb24gaXMgaW4gc2NoZW1hPyBoYXZlIGRhdGEgb3IganVzdCBsaW5rcz9cbiAgICAgICAgICAgICAgICBpZiAoIShyZWxhdGlvbl9rZXkgaW4gcmVsYXRpb25zaGlwc19kZXN0KSAmJiAoJ2RhdGEnIGluIHJlbGF0aW9uX3ZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gc29tZXRpbWUgZGF0YT1udWxsIG9yIHNpbXBsZSB7IH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbGF0aW9uX3ZhbHVlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBpZiAoc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSAmJiBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uX3ZhbHVlLmRhdGEubGVuZ3RoIDwgMSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX3ZhbHVlLmRhdGFbMF0udHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0ge307IC8vIGZvcmNlIHRvIG9iamVjdCAobm90IGFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGZ1bmN0aW9uIChyZWxhdGlvbl92YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGFbdG1wLmlkXSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUuZGF0YSwgaW5jbHVkZWRfYXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uIChyZWxhdGlvbiwgaW5jbHVkZWRfYXJyYXkpIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV0pIHtcbiAgICAgICAgICAgICAgICAvLyBpdCdzIGluIGluY2x1ZGVkXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluY2x1ZGVkX2FycmF5W3JlbGF0aW9uLnR5cGVdW3JlbGF0aW9uLmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHJlc291cmNlIG5vdCBpbmNsdWRlZCwgcmV0dXJuIGRpcmVjdGx5IHRoZSBvYmplY3RcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVsYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBDb252ZXJ0ZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvbnZlcnRlciA9IENvbnZlcnRlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb3JlIGltcGxlbWVudHMgSnNvbmFwaS5JQ29yZSB7XG4gICAgICAgIHB1YmxpYyByb290UGF0aDogc3RyaW5nID0gJ2h0dHA6Ly9yZXllc29mdC5kZG5zLm5ldDo5OTk5L2FwaS92MS9jb21wYW5pZXMvMic7XG4gICAgICAgIHB1YmxpYyByZXNvdXJjZXM6IEFycmF5PEpzb25hcGkuSVJlc291cmNlPiA9IFtdO1xuXG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0NvdW50ZXI6IG51bWJlciA9IDA7XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc1N0YXJ0ID0gKCkgPT4ge307XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0RvbmUgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzRXJyb3IgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzT2ZmbGluZSA9ICgpID0+IHt9O1xuXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgTWU6IEpzb25hcGkuSUNvcmUgPSBudWxsO1xuICAgICAgICBwdWJsaWMgc3RhdGljIFNlcnZpY2VzOiBhbnkgPSBudWxsO1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIHJzSnNvbmFwaUNvbmZpZyxcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpQ29yZVNlcnZpY2VzXG4gICAgICAgICkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3JlZ2lzdGVyKGNsYXNlKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZXNvdXJjZSh0eXBlOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZWZyZXNoTG9hZGluZ3MoZmFjdG9yOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29yZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZShyc0pzb25hcGlDb25maWcsIEpzb25hcGlDb3JlU2VydmljZXMpIHtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpQ29yZVNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgICAgIHRoaXMucm9vdFBhdGggPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciA9IDA7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NFcnJvciA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NPZmZsaW5lID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cbiAgICAgICAgQ29yZS5wcm90b3R5cGUuX3JlZ2lzdGVyID0gZnVuY3Rpb24gKGNsYXNlKSB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUuZ2V0UmVzb3VyY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5yZWZyZXNoTG9hZGluZ3MgPSBmdW5jdGlvbiAoZmFjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5NZSA9IG51bGw7XG4gICAgICAgIENvcmUuU2VydmljZXMgPSBudWxsO1xuICAgICAgICByZXR1cm4gQ29yZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZSA9IENvcmU7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFJlc291cmNlIGltcGxlbWVudHMgSVJlc291cmNlIHtcbiAgICAgICAgcHVibGljIHNjaGVtYTogSVNjaGVtYTtcbiAgICAgICAgcHJvdGVjdGVkIHBhdGg6IHN0cmluZzsgICAvLyB3aXRob3V0IHNsYXNoZXNcblxuICAgICAgICBwdWJsaWMgaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgcHVibGljIHR5cGU6IHN0cmluZztcbiAgICAgICAgcHVibGljIGlkOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBhbnkgO1xuICAgICAgICBwdWJsaWMgcmVsYXRpb25zaGlwczogYW55ID0ge307IC8vW107XG5cbiAgICAgICAgcHVibGljIGNhY2hlOiBPYmplY3Q7XG4gICAgICAgIHB1YmxpYyBjYWNoZV92YXJzOiBPYmplY3QgPSB7fTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIHB1YmxpYyByZWdpc3RlcigpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmIChKc29uYXBpLkNvcmUuTWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnRXJyb3I6IHlvdSBhcmUgdHJ5aW5nIHJlZ2lzdGVyIC0tPiAnICsgdGhpcy50eXBlICsgJyA8LS0gYmVmb3JlIGluamVjdCBKc29uYXBpQ29yZSBzb21ld2hlcmUsIGFsbW9zdCBvbmUgdGltZS4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gb25seSB3aGVuIHNlcnZpY2UgaXMgcmVnaXN0ZXJlZCwgbm90IGNsb25lZCBvYmplY3RcbiAgICAgICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFBhdGgoKTogc3RyaW5nIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBzZWxmIG9iamVjdFxuICAgICAgICBwdWJsaWMgbmV3PFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4oKTogVCB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV1bJ2RhdGEnXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLmlzX25ldyA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QocGFyYW1zPzogSnNvbmFwaS5JUGFyYW1zKTogSURhdGFPYmplY3Qge1xuICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLnNjaGVtYSA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuU2NoZW1hLCB0aGlzLnNjaGVtYSk7XG5cbiAgICAgICAgICAgIGxldCByZWxhdGlvbnNoaXBzID0geyB9O1xuICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0gWyBdO1xuICAgICAgICAgICAgbGV0IGluY2x1ZGVkX2lkcyA9IFsgXTsgLy9qdXN0IGZvciBjb250cm9sIGRvbid0IHJlcGVhdCBhbnkgcmVzb3VyY2VcblxuICAgICAgICAgICAgLy8gUkVBTFRJT05TSElQU1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSAmJiB0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBtYW55IChoYXNNYW55OnRydWUpXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXAuZGF0YSwgKHJlc291cmNlOiBKc29uYXBpLklSZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRlbXBvcmFsX2lkID0gcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbl9hbGlhcykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRfaWRzLnB1c2godGVtcG9yYWxfaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVzb3VyY2UudG9PYmplY3QoeyB9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaGFzIG9uZSAoaGFzTWFueTpmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoJ2lkJyBpbiByZWxhdGlvbnNoaXAuZGF0YSkgJiYgIWFuZ3VsYXIuZXF1YWxzKHt9LCByZWxhdGlvbnNoaXAuZGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZWxhdGlvbl9hbGlhcyArICcgZGVmaW5lZCB3aXRoIGhhc01hbnk6ZmFsc2UsIGJ1dCBJIGhhdmUgYSBjb2xsZWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLmRhdGEuaWQgJiYgcmVsYXRpb25zaGlwLmRhdGEudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgaWQ6IHJlbGF0aW9uc2hpcC5kYXRhLmlkLCB0eXBlOiByZWxhdGlvbnNoaXAuZGF0YS50eXBlIH0gfTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7IH0gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wb3JhbF9pZCA9IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgKyAnXycgKyByZWxhdGlvbnNoaXAuZGF0YS5pZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbnNoaXAuZGF0YS50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVsYXRpb25zaGlwLmRhdGEudG9PYmplY3QoeyB9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsZXQgcmV0OiBJRGF0YU9iamVjdCA9IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChpbmNsdWRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0LmluY2x1ZGVkID0gaW5jbHVkZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0PFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4oaWQ6IHN0cmluZywgcGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvbik6IFQge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKGlkOiBzdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZGVsZXRlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWxsPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvbik6IEFycmF5PFQ+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnYWxsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0UmVsYXRpb25zaGlwczxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmVudF9wYXRoX2lkOiBzdHJpbmcsXG4gICAgICAgICAgICBwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uXG4gICAgICAgICk6IEFycmF5PFQ+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhwYXJlbnRfcGF0aF9pZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldFJlbGF0aW9uc2hpcHMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzYXZlPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvbik6IEFycmF5PFQ+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnc2F2ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIFRoaXMgbWV0aG9kIHNvcnQgcGFyYW1zIGZvciBuZXcoKSwgZ2V0KCkgYW5kIHVwZGF0ZSgpXG4gICAgICAgICovXG4gICAgICAgIHByaXZhdGUgX19leGVjKGlkOiBzdHJpbmcsIHBhcmFtczogSnNvbmFwaS5JUGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgZXhlY190eXBlOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICAgICAgLy8gbWFrZXMgYHBhcmFtc2Agb3B0aW9uYWxcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7fTtcblxuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0UmVsYXRpb25zaGlwcyc6XG4gICAgICAgICAgICAgICAgcGFyYW1zLnBhdGggPSBpZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlbGV0ZShpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9nZXQoaWQ6IHN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSA/IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSA6IHRoaXMubmV3KCk7XG5cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIENvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IE9iamVjdCB7IC8vIEFycmF5PElSZXNvdXJjZT4ge1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLnBhdGggPyBwYXRoLmFkZFBhdGgocGFyYW1zLnBhdGgpIDogbnVsbDtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0geyB9O1xuICAgICAgICAgICAgLy8gKCFwYXJhbXMucGF0aCk6IGJlY291c2Ugd2UgbmVlZCByZWFsIHR5cGUsIG5vdCB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVxuICAgICAgICAgICAgaWYgKCFwYXJhbXMucGF0aCAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9PT0gdGhpcy5nZXRQYXRoKCkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBkb24ndCBtYWtlXG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgLmdldChwYXRoLmdldCgpKVxuICAgICAgICAgICAgLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIENvbnZlcnRlci5idWlsZChzdWNjZXNzLmRhdGEsIHJlc291cmNlLCB0aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAgICghcGFyYW1zLnBhdGgpOiBmaWxsIGNhY2hlIG5lZWQgd29yayB3aXRoIHJlbGF0aW9uc2hpcHMgdG9vLFxuICAgICAgICAgICAgICAgICAgICBmb3IgdGhlIG1vbW1lbnQgd2UncmUgY3JlYXRlZCB0aGlzIGlmXG4gICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFyYW1zLnBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZGVsZXRlKGlkOiBzdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiB2b2lkIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5kZWxldGUocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF1bJ2lkJ10gPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXVsnYXR0cmlidXRlcyddID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3NhdmUocGFyYW1zOiBJUGFyYW1zLCBmY19zdWNjZXNzOiBGdW5jdGlvbiwgZmNfZXJyb3I6IEZ1bmN0aW9uKTogSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCBvYmplY3QgPSB0aGlzLnRvT2JqZWN0KHBhcmFtcyk7XG5cbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG5cbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmV4ZWMocGF0aC5nZXQoKSwgdGhpcy5pZCA/ICdQVVQnIDogJ1BPU1QnLCBvYmplY3QpO1xuXG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcblxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhZGRSZWxhdGlvbnNoaXA8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihyZXNvdXJjZTogVCwgdHlwZV9hbGlhcz86IHN0cmluZykge1xuICAgICAgICAgICAgbGV0IG9iamVjdF9rZXkgPSByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgIGlmICghb2JqZWN0X2tleSkge1xuICAgICAgICAgICAgICAgIG9iamVjdF9rZXkgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YTogeyB9IH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtvYmplY3Rfa2V5XSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlbW92ZVJlbGF0aW9uc2hpcCh0eXBlX2FsaWFzOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKCdkYXRhJyBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaWQgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW2lkXTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBmaWxsQ2FjaGUocmVzb3VyY2VzKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VzLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9IHRoaXMuZ2V0UGF0aCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2VzKHJlc291cmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIGZpbGxDYWNoZVJlc291cmNlczxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlczogQXJyYXk8VD4pIHtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIGZpbGxDYWNoZVJlc291cmNlPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2U6IFQpIHtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZS5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgcHVibGljIGdldFNlcnZpY2UoKTogYW55IHtcbiAgICAgICAgICAgIHJldHVybiBDb252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9OyAvL1tdO1xuICAgICAgICAgICAgdGhpcy5jYWNoZV92YXJzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChKc29uYXBpLkNvcmUuTWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnRXJyb3I6IHlvdSBhcmUgdHJ5aW5nIHJlZ2lzdGVyIC0tPiAnICsgdGhpcy50eXBlICsgJyA8LS0gYmVmb3JlIGluamVjdCBKc29uYXBpQ29yZSBzb21ld2hlcmUsIGFsbW9zdCBvbmUgdGltZS4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gb25seSB3aGVuIHNlcnZpY2UgaXMgcmVnaXN0ZXJlZCwgbm90IGNsb25lZCBvYmplY3RcbiAgICAgICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5uZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IFtdO1xuICAgICAgICAgICAgdmFyIGluY2x1ZGVkX2lkcyA9IFtdOyAvL2p1c3QgZm9yIGNvbnRyb2wgZG9uJ3QgcmVwZWF0IGFueSByZXNvdXJjZVxuICAgICAgICAgICAgLy8gUkVBTFRJT05TSElQU1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoX3RoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdICYmIF90aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBtYW55IChoYXNNYW55OnRydWUpXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHt9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgb25lIChoYXNNYW55OmZhbHNlKVxuICAgICAgICAgICAgICAgICAgICBpZiAoISgnaWQnIGluIHJlbGF0aW9uc2hpcC5kYXRhKSAmJiAhYW5ndWxhci5lcXVhbHMoe30sIHJlbGF0aW9uc2hpcC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKHJlbGF0aW9uX2FsaWFzICsgJyBkZWZpbmVkIHdpdGggaGFzTWFueTpmYWxzZSwgYnV0IEkgaGF2ZSBhIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLmRhdGEuaWQgJiYgcmVsYXRpb25zaGlwLmRhdGEudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgaWQ6IHJlbGF0aW9uc2hpcC5kYXRhLmlkLCB0eXBlOiByZWxhdGlvbnNoaXAuZGF0YS50eXBlIH0gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7fSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wb3JhbF9pZCA9IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgKyAnXycgKyByZWxhdGlvbnNoaXAuZGF0YS5pZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbnNoaXAuZGF0YS50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVsYXRpb25zaGlwLmRhdGEudG9PYmplY3Qoe30pLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgcmV0ID0ge1xuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzOiByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0LmluY2x1ZGVkID0gaW5jbHVkZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdkZWxldGUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UmVsYXRpb25zaGlwcyA9IGZ1bmN0aW9uIChwYXJlbnRfcGF0aF9pZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKHBhcmVudF9wYXRoX2lkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0UmVsYXRpb25zaGlwcycpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIFRoaXMgbWV0aG9kIHNvcnQgcGFyYW1zIGZvciBuZXcoKSwgZ2V0KCkgYW5kIHVwZGF0ZSgpXG4gICAgICAgICovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fX2V4ZWMgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgLy8gbWFrZXMgYHBhcmFtc2Agb3B0aW9uYWxcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0UmVsYXRpb25zaGlwcyc6XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wYXRoID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlbGV0ZShpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdID8gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdIDogdGhpcy5uZXcoKTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIF90aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXJhbXMucGF0aCA/IHBhdGguYWRkUGF0aChwYXJhbXMucGF0aCkgOiBudWxsO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0ge307XG4gICAgICAgICAgICAvLyAoIXBhcmFtcy5wYXRoKTogYmVjb3VzZSB3ZSBuZWVkIHJlYWwgdHlwZSwgbm90IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlXG4gICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID09PSB0aGlzLmdldFBhdGgoKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IG1ha2VcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIF90aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAoIXBhcmFtcy5wYXRoKTogZmlsbCBjYWNoZSBuZWVkIHdvcmsgd2l0aCByZWxhdGlvbnNoaXBzIHRvbyxcbiAgICAgICAgICAgICAgICBmb3IgdGhlIG1vbW1lbnQgd2UncmUgY3JlYXRlZCB0aGlzIGlmXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmZpbGxDYWNoZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5kZWxldGUocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIGlmIChfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgX3RoaXMuZ2V0U2VydmljZSgpLmNhY2hlW2lkXSkge1xuICAgICAgICAgICAgICAgICAgICBfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdWydpZCddID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF1bJ2F0dHJpYnV0ZXMnXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBfdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5leGVjKHBhdGguZ2V0KCksIHRoaXMuaWQgPyAnUFVUJyA6ICdQT1NUJywgb2JqZWN0KTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKCdkYXRhJyBpbiBlcnJvciA/IGVycm9yLmRhdGEgOiBlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFkZFJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uIChyZXNvdXJjZSwgdHlwZV9hbGlhcykge1xuICAgICAgICAgICAgdmFyIG9iamVjdF9rZXkgPSByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgIGlmICghb2JqZWN0X2tleSkge1xuICAgICAgICAgICAgICAgIG9iamVjdF9rZXkgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHt9IH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bb2JqZWN0X2tleV0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZW1vdmVSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAodHlwZV9hbGlhcywgaWQpIHtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKCdkYXRhJyBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaWQgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW2lkXTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZmlsbENhY2hlID0gZnVuY3Rpb24gKHJlc291cmNlcykge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlcy5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID0gdGhpcy5nZXRQYXRoKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZXMocmVzb3VyY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlcyA9IGZ1bmN0aW9uIChyZXNvdXJjZXMpIHtcbiAgICAgICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZVJlc291cmNlID0gZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2UuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUmVzb3VyY2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlJlc291cmNlID0gUmVzb3VyY2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9yZXNvdXJjZS5kLnRzXCIvPlxuXG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9iYXNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3BhcmFtcy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9lcnJvcnMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvbGlua3MuZC50c1wiLz5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2Jhc2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtY29udmVydGVyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29yZVNlcnZpY2VzIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpSHR0cFxuICAgICAgICApIHtcblxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZVNlcnZpY2VzJywgQ29yZVNlcnZpY2VzKTtcbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvcmVTZXJ2aWNlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZVNlcnZpY2VzKEpzb25hcGlIdHRwKSB7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlIdHRwID0gSnNvbmFwaUh0dHA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENvcmVTZXJ2aWNlcztcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZVNlcnZpY2VzID0gQ29yZVNlcnZpY2VzO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVBhcnNlciB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyB0b09iamVjdChqc29uX3N0cmluZzogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ganNvbl9zdHJpbmc7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpUGFyc2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBKc29uYXBpUGFyc2VyKCkge1xuICAgICAgICB9XG4gICAgICAgIEpzb25hcGlQYXJzZXIucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKGpzb25fc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4ganNvbl9zdHJpbmc7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBKc29uYXBpUGFyc2VyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpUGFyc2VyID0gSnNvbmFwaVBhcnNlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBKc29uYXBpU3RvcmFnZSB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICAvLyBwcm90ZWN0ZWQgc3RvcmUsXG4gICAgICAgICAgICAvLyBwcm90ZWN0ZWQgUmVhbEpzb25hcGlcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQoa2V5KSB7XG4gICAgICAgICAgICAvKiBsZXQgZGF0YSA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5mcm9tSnNvbihkYXRhKTsqL1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIG1lcmdlKGtleSwgZGF0YSkge1xuICAgICAgICAgICAgLyogbGV0IGFjdHVhbF9kYXRhID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGxldCBhY3R1YWxfaW5mbyA9IGFuZ3VsYXIuZnJvbUpzb24oYWN0dWFsX2RhdGEpOyAqL1xuXG5cbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEpzb25hcGlTdG9yYWdlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBKc29uYXBpU3RvcmFnZSgpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpU3RvcmFnZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfTtcbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLm1lcmdlID0gZnVuY3Rpb24gKGtleSwgZGF0YSkge1xuICAgICAgICAgICAgLyogbGV0IGFjdHVhbF9kYXRhID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgICAgICAgIGxldCBhY3R1YWxfaW5mbyA9IGFuZ3VsYXIuZnJvbUpzb24oYWN0dWFsX2RhdGEpOyAqL1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVN0b3JhZ2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkpzb25hcGlTdG9yYWdlID0gSnNvbmFwaVN0b3JhZ2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
