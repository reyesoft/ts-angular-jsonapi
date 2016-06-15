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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvYmFzZS50cyIsInNlcnZpY2VzL2Jhc2UuanMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9odHRwLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9wYXRoLW1ha2VyLnRzIiwic2VydmljZXMvcGF0aC1tYWtlci5qcyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci5qcyIsImNvcmUudHMiLCJjb3JlLmpzIiwicmVzb3VyY2UudHMiLCJyZXNvdXJjZS5qcyIsIl9hbGwudHMiLCJfYWxsLmpzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzIiwic2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS50cyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsQ0FBQyxVQUFVLFNBQU87O0lBRWQsUUFBUSxPQUFPLGtCQUFrQjtTQUNoQyxTQUFTLG1CQUFtQjtRQUN6QixLQUFLO1FBQ0wsT0FBTztRQUNQLG1CQUFtQjtRQUNuQixtQkFBbUI7O0lBR3ZCLFFBQVEsT0FBTyxvQkFBb0I7SUFFbkMsUUFBUSxPQUFPLGFBQWE7UUFDeEI7UUFDQTtRQUNBOztHQUdMO0FDSEg7QUNqQkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7UUFBQSxTQUFBLE9BQUE7O1FBQ1csS0FBQSxTQUEwQjtZQUM3QixJQUFJO1lBQ0osU0FBUzs7UUFHTixLQUFBLFNBQVM7WUFDWixZQUFZO1lBQ1osZUFB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QU87QUNrQmQiLCJmaWxlIjoidHMtYW5ndWxhci1qc29uYXBpLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJyxcbiAgICAgICAgZGVsYXk6IDAsXG4gICAgICAgIHVuaWZ5X2NvbmN1cnJlbmN5OiB0cnVlLFxuICAgICAgICBjYWNoZV9wcmVyZXF1ZXN0czogdHJ1ZVxuICAgIH0pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJywgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG5cbn0pKGFuZ3VsYXIpO1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAgICAgLmNvbnN0YW50KCdyc0pzb25hcGlDb25maWcnLCB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly95b3VyZG9tYWluL2FwaS92MS8nLFxuICAgICAgICBkZWxheTogMCxcbiAgICAgICAgdW5pZnlfY29uY3VycmVuY3k6IHRydWUsXG4gICAgICAgIGNhY2hlX3ByZXJlcXVlc3RzOiB0cnVlXG4gICAgfSk7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xufSkoYW5ndWxhcik7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEJhc2Uge1xuICAgICAgICBzdGF0aWMgUGFyYW1zOiBKc29uYXBpLklQYXJhbXMgPSB7XG4gICAgICAgICAgICBpZDogJycsXG4gICAgICAgICAgICBpbmNsdWRlOiBbXVxuICAgICAgICB9O1xuXG4gICAgICAgIHN0YXRpYyBTY2hlbWEgPSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICAgIH07XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQmFzZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIEJhc2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgQmFzZS5QYXJhbXMgPSB7XG4gICAgICAgICAgICBpZDogJycsXG4gICAgICAgICAgICBpbmNsdWRlOiBbXVxuICAgICAgICB9O1xuICAgICAgICBCYXNlLlNjaGVtYSA9IHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgICAgICAgICAgcmVsYXRpb25zaGlwczoge31cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEJhc2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkJhc2UgPSBCYXNlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEh0dHAge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkICRodHRwLFxuICAgICAgICAgICAgcHJvdGVjdGVkICR0aW1lb3V0LFxuICAgICAgICAgICAgcHJvdGVjdGVkIHJzSnNvbmFwaUNvbmZpZyxcbiAgICAgICAgICAgIHByb3RlY3RlZCAkcVxuICAgICAgICApIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGRlbGV0ZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0RFTEVURScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldChwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0dFVCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvdGVjdGVkIGV4ZWMocGF0aDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgZGF0YT86IEpzb25hcGkuSURhdGFPYmplY3QpIHtcbiAgICAgICAgICAgIGxldCByZXEgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB0aGlzLnJzSnNvbmFwaUNvbmZpZy51cmwgKyBwYXRoLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi92bmQuYXBpK2pzb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGRhdGEgJiYgKHJlcVsnZGF0YSddID0gZGF0YSk7XG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IHRoaXMuJGh0dHAocmVxKTtcblxuICAgICAgICAgICAgbGV0IGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdGltZW91dCBqdXN0IGZvciBkZXZlbG9wIGVudmlyb25tZW50XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuJHRpbWVvdXQoICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgc2VsZi5yc0pzb25hcGlDb25maWcuZGVsYXkpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpLkh0dHAuZXhlYyBlcnJvciA9PicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvZmZsaW5lP1xuICAgICAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLmxvYWRpbmdzRXJyb3IoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCAkdGltZW91dCwgcnNKc29uYXBpQ29uZmlnLCAkcSkge1xuICAgICAgICAgICAgdGhpcy4kaHR0cCA9ICRodHRwO1xuICAgICAgICAgICAgdGhpcy4kdGltZW91dCA9ICR0aW1lb3V0O1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLiRxID0gJHE7XG4gICAgICAgIH1cbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0RFTEVURScpO1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAocGF0aCwgbWV0aG9kLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKDEpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dCBqdXN0IGZvciBkZXZlbG9wIGVudmlyb25tZW50XG4gICAgICAgICAgICAgICAgc2VsZi4kdGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sIHNlbGYucnNKc29uYXBpQ29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaS5IdHRwLmV4ZWMgZXJyb3IgPT4nLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG9mZmxpbmU/XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5sb2FkaW5nc0Vycm9yKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSHR0cDtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSHR0cCA9IEh0dHA7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpSHR0cCcsIEh0dHApO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFBhdGhNYWtlciB7XG4gICAgICAgIHB1YmxpYyBwYXRoczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuICAgICAgICBwdWJsaWMgaW5jbHVkZXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgYWRkUGF0aCh2YWx1ZTogU3RyaW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHNldEluY2x1ZGUoc3RyaW5nc19hcnJheTogQXJyYXk8U3RyaW5nPikge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KCk6IFN0cmluZyB7XG4gICAgICAgICAgICBsZXQgZ2V0X3BhcmFtczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICc/JyArIGdldF9wYXJhbXMuam9pbignJicpIDogJycpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUGF0aE1ha2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUGF0aE1ha2VyKCkge1xuICAgICAgICAgICAgdGhpcy5wYXRocyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuYWRkUGF0aCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5zZXRJbmNsdWRlID0gZnVuY3Rpb24gKHN0cmluZ3NfYXJyYXkpIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBnZXRfcGFyYW1zID0gW107XG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFBhdGhNYWtlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUGF0aE1ha2VyID0gUGF0aE1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvbnZlcnRlciB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIFJlc291cmNlcyBhcnJheXMgd2l0aG91dCBba2V5c11cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheShcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IEFycmF5PEpzb25hcGkuSURhdGFSZXNvdXJjZT4sXG4gICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheT86IE9iamVjdCwgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+LFxuICAgICAgICAgICAgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZVxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBqc29uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluY2x1ZGVkIGZvciBleGFtcGxlIG5lZWQgYSBleHRyYSBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheS5wdXNoKHJlc291cmNlLmlkICsgcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBpbmRleGVkIFJlc291cmNlcyBhcnJheSBieSBbdHlwZV1baWRdXG4gICAgICAgICoqL1xuICAgICAgICBzdGF0aWMganNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZSAoXG4gICAgICAgICAgICBqc29uX2FycmF5OiBBcnJheTxKc29uYXBpLklEYXRhUmVzb3VyY2U+LFxuICAgICAgICAgICAgaW5zdGFuY2VfcmVsYXRpb25zaGlwczogYm9vbGVhblxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgbGV0IGFsbF9yZXNvdXJjZXM6YW55ID0geyB9IDtcbiAgICAgICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheShqc29uX2FycmF5LCBhbGxfcmVzb3VyY2VzLCBmYWxzZSk7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2VzID0geyB9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBqc29uMnJlc291cmNlKGpzb25fcmVzb3VyY2U6IEpzb25hcGkuSURhdGFSZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShqc29uX3Jlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGpzb25fcmVzb3VyY2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBzZXJ2aWNlIG5vdCByZWdpc3RlcmVkXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIGpzb25fcmVzb3VyY2UudHlwZSArICdgJywgJ3NlcnZpY2Ugbm90IGZvdW5kIG9uIGpzb24ycmVzb3VyY2UoKScpO1xuICAgICAgICAgICAgICAgIGxldCB0ZW1wID0gbmV3IEpzb25hcGkuUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICB0ZW1wLmlkID0ganNvbl9yZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICB0ZW1wLnR5cGUgPSBqc29uX3Jlc291cmNlLnR5cGU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRlbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgZ2V0U2VydmljZSh0eXBlOiBzdHJpbmcpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29yZS5NZS5nZXRSZXNvdXJjZSh0eXBlKTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHJlc291cmNlX3NlcnZpY2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdgJyArIHR5cGUgKyAnYCcsICdzZXJ2aWNlIG5vdCBmb3VuZCBvbiBnZXRTZXJ2aWNlKCknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgc3RhdGljIHByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlOiBKc29uYXBpLklSZXNvdXJjZSwgZGF0YTogSnNvbmFwaS5JRGF0YVJlc291cmNlKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgaWYgKCEoJ3R5cGUnIGluIGRhdGEgJiYgJ2lkJyBpbiBkYXRhKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0pzb25hcGkgUmVzb3VyY2UgaXMgbm90IGNvcnJlY3QnLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IG5ldyAoPGFueT5yZXNvdXJjZV9zZXJ2aWNlLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzID8gZGF0YS5hdHRyaWJ1dGVzIDoge307XG4gICAgICAgICAgICByZXNvdXJjZS5pc19uZXcgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBidWlsZChkb2N1bWVudF9mcm9tOiBhbnksIHJlc291cmNlX2Rlc3Q6IGFueSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0ge307XG4gICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBkb2N1bWVudF9mcm9tKSB7XG4gICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShkb2N1bWVudF9mcm9tLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzQXJyYXkoZG9jdW1lbnRfZnJvbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZShkb2N1bWVudF9mcm9tLmRhdGEsIHJlc291cmNlX2Rlc3QsIHNjaGVtYSwgaW5jbHVkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9idWlsZFJlc291cmNlcyhkb2N1bWVudF9mcm9tOiBJRGF0YUNvbGxlY3Rpb24sIHJlc291cmNlX2Rlc3Q6IEFycmF5PElEYXRhQ29sbGVjdGlvbj4sIHNjaGVtYTogSVNjaGVtYSwgaW5jbHVkZWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGRhdGEgb2YgZG9jdW1lbnRfZnJvbS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICghKGRhdGEuaWQgaW4gcmVzb3VyY2VfZGVzdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSA9IG5ldyAoPGFueT5yZXNvdXJjZS5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbTogSURhdGFSZXNvdXJjZSwgcmVzb3VyY2VfZGVzdDogSVJlc291cmNlLCBzY2hlbWE6IElTY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIF9fYnVpbGRSZWxhdGlvbnNoaXBzKHJlbGF0aW9uc2hpcHNfZnJvbTogQXJyYXk8YW55PiwgcmVsYXRpb25zaGlwc19kZXN0OiBBcnJheTxhbnk+LCBpbmNsdWRlZF9hcnJheSwgc2NoZW1hOiBJU2NoZW1hKSB7XG4gICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXBzX2Zyb20sIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWxhdGlvbl92YWx1ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gJiYgc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA8IDEpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgKHJlbGF0aW9uX3ZhbHVlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wID0gQ29udmVydGVyLl9fYnVpbGRSZWxhdGlvbnNoaXAocmVsYXRpb25fdmFsdWUsIGluY2x1ZGVkX2FycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzX2Rlc3RbcmVsYXRpb25fa2V5XS5kYXRhW3RtcC5pZF0gPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbjogSnNvbmFwaS5JRGF0YVJlc291cmNlLCBpbmNsdWRlZF9hcnJheSk6IEpzb25hcGkuSVJlc291cmNlIHwgSnNvbmFwaS5JRGF0YVJlc291cmNlIHtcbiAgICAgICAgICAgIGlmIChyZWxhdGlvbi50eXBlIGluIGluY2x1ZGVkX2FycmF5ICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uaWQgaW4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1cbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyByZXNvdXJjZSBub3QgaW5jbHVkZWQsIHJldHVybiBkaXJlY3RseSB0aGUgb2JqZWN0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuXG5cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBqc29uX2FycmF5XzEgPSBqc29uX2FycmF5OyBfaSA8IGpzb25fYXJyYXlfMS5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IGpzb25fYXJyYXlfMVtfaV07XG4gICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jbHVkZWQgZm9yIGV4YW1wbGUgbmVlZCBhIGV4dHJhIHBhcmFtZXRlclxuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheVtyZXNvdXJjZS50eXBlICsgJ18nICsgcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheVsnJGNvdW50J10gPSBjb3VudDsgLy8gcHJvYmxlbSB3aXRoIHRvQXJyYXkgb3IgYW5ndWxhci5mb3JFYWNoIG5lZWQgYSAhaXNPYmplY3RcbiAgICAgICAgICAgIHJldHVybiBkZXN0aW5hdGlvbl9hcnJheTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGluc3RhbmNlX3JlbGF0aW9uc2hpcHMpIHtcbiAgICAgICAgICAgIHZhciBhbGxfcmVzb3VyY2VzID0ge307XG4gICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoanNvbl9hcnJheSwgYWxsX3Jlc291cmNlcywgZmFsc2UpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2VzO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuanNvbjJyZXNvdXJjZSA9IGZ1bmN0aW9uIChqc29uX3Jlc291cmNlLCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoanNvbl9yZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBqc29uX3Jlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNlcnZpY2Ugbm90IHJlZ2lzdGVyZWRcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ2AnICsganNvbl9yZXNvdXJjZS50eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24ganNvbjJyZXNvdXJjZSgpJyk7XG4gICAgICAgICAgICAgICAgdmFyIHRlbXAgPSBuZXcgSnNvbmFwaS5SZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgIHRlbXAuaWQgPSBqc29uX3Jlc291cmNlLmlkO1xuICAgICAgICAgICAgICAgIHRlbXAudHlwZSA9IGpzb25fcmVzb3VyY2UudHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignYCcgKyB0eXBlICsgJ2AnLCAnc2VydmljZSBub3QgZm91bmQgb24gZ2V0U2VydmljZSgpJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfTtcbiAgICAgICAgLyogcmV0dXJuIGEgcmVzb3VyY2UgdHlwZShyZXNvcnVjZV9zZXJ2aWNlKSB3aXRoIGRhdGEoZGF0YSkgKi9cbiAgICAgICAgQ29udmVydGVyLnByb2NyZWF0ZSA9IGZ1bmN0aW9uIChyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gbmV3IHJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcyA/IGRhdGEuYXR0cmlidXRlcyA6IHt9O1xuICAgICAgICAgICAgcmVzb3VyY2UuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5idWlsZCA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICB2YXIgaW5jbHVkZWQgPSB7fTtcbiAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIGRvY3VtZW50X2Zyb20pIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlZCA9IENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKGRvY3VtZW50X2Zyb20uaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzQXJyYXkoZG9jdW1lbnRfZnJvbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZXMoZG9jdW1lbnRfZnJvbSwgcmVzb3VyY2VfZGVzdCwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZG9jdW1lbnRfZnJvbS5kYXRhLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLl9idWlsZFJlc291cmNlcyA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0gZG9jdW1lbnRfZnJvbS5kYXRhOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0gX2FbX2ldO1xuICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UoZGF0YS50eXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoIShkYXRhLmlkIGluIHJlc291cmNlX2Rlc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlX2Rlc3RbZGF0YS5pZF0gPSBuZXcgcmVzb3VyY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXS5yZXNldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuX2J1aWxkUmVzb3VyY2UoZGF0YSwgcmVzb3VyY2VfZGVzdFtkYXRhLmlkXSwgc2NoZW1hLCBpbmNsdWRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fYnVpbGRSZXNvdXJjZSA9IGZ1bmN0aW9uIChkb2N1bWVudF9mcm9tLCByZXNvdXJjZV9kZXN0LCBzY2hlbWEsIGluY2x1ZGVkKSB7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmF0dHJpYnV0ZXMgPSBkb2N1bWVudF9mcm9tLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXNvdXJjZV9kZXN0LmlkID0gZG9jdW1lbnRfZnJvbS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlX2Rlc3QuaXNfbmV3ID0gZmFsc2U7XG4gICAgICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMoZG9jdW1lbnRfZnJvbS5yZWxhdGlvbnNoaXBzLCByZXNvdXJjZV9kZXN0LnJlbGF0aW9uc2hpcHMsIGluY2x1ZGVkLCBzY2hlbWEpO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcHMgPSBmdW5jdGlvbiAocmVsYXRpb25zaGlwc19mcm9tLCByZWxhdGlvbnNoaXBzX2Rlc3QsIGluY2x1ZGVkX2FycmF5LCBzY2hlbWEpIHtcbiAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcHNfZnJvbSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpIHtcbiAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZWxhdGlvbnNoaXBzX2Rlc3QpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBzb21ldGltZSBkYXRhPW51bGwgb3Igc2ltcGxlIHsgfVxuICAgICAgICAgICAgICAgIGlmICghcmVsYXRpb25fdmFsdWUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmIChzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldICYmIHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YS5sZW5ndGggPCAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSB7fTsgLy8gZm9yY2UgdG8gb2JqZWN0IChub3QgYXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcCA9IENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwKHJlbGF0aW9uX3ZhbHVlLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc19kZXN0W3JlbGF0aW9uX2tleV0uZGF0YVt0bXAuaWRdID0gdG1wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNfZGVzdFtyZWxhdGlvbl9rZXldLmRhdGEgPSBDb252ZXJ0ZXIuX19idWlsZFJlbGF0aW9uc2hpcChyZWxhdGlvbl92YWx1ZS5kYXRhLCBpbmNsdWRlZF9hcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5fX2J1aWxkUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHJlbGF0aW9uLCBpbmNsdWRlZF9hcnJheSkge1xuICAgICAgICAgICAgaWYgKHJlbGF0aW9uLnR5cGUgaW4gaW5jbHVkZWRfYXJyYXkgJiZcbiAgICAgICAgICAgICAgICByZWxhdGlvbi5pZCBpbiBpbmNsdWRlZF9hcnJheVtyZWxhdGlvbi50eXBlXSkge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgaW4gaW5jbHVkZWRcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5jbHVkZWRfYXJyYXlbcmVsYXRpb24udHlwZV1bcmVsYXRpb24uaWRdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzb3VyY2Ugbm90IGluY2x1ZGVkLCByZXR1cm4gZGlyZWN0bHkgdGhlIG9iamVjdFxuICAgICAgICAgICAgICAgIHJldHVybiByZWxhdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIENvbnZlcnRlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29udmVydGVyID0gQ29udmVydGVyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmUgaW1wbGVtZW50cyBKc29uYXBpLklDb3JlIHtcbiAgICAgICAgcHVibGljIHJvb3RQYXRoOiBzdHJpbmcgPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgcHVibGljIHJlc291cmNlczogQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+ID0gW107XG5cbiAgICAgICAgcHVibGljIGxvYWRpbmdzQ291bnRlcjogbnVtYmVyID0gMDtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzU3RhcnQgPSAoKSA9PiB7fTtcbiAgICAgICAgcHVibGljIGxvYWRpbmdzRG9uZSA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NFcnJvciA9ICgpID0+IHt9O1xuXG4gICAgICAgIHB1YmxpYyBzdGF0aWMgTWU6IEpzb25hcGkuSUNvcmUgPSBudWxsO1xuICAgICAgICBwdWJsaWMgc3RhdGljIFNlcnZpY2VzOiBhbnkgPSBudWxsO1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIHJzSnNvbmFwaUNvbmZpZyxcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpQ29yZVNlcnZpY2VzXG4gICAgICAgICkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3JlZ2lzdGVyKGNsYXNlKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZXNvdXJjZSh0eXBlOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZWZyZXNoTG9hZGluZ3MoZmFjdG9yOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29yZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZShyc0pzb25hcGlDb25maWcsIEpzb25hcGlDb3JlU2VydmljZXMpIHtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpQ29yZVNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgICAgIHRoaXMucm9vdFBhdGggPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciA9IDA7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NFcnJvciA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG4gICAgICAgIENvcmUucHJvdG90eXBlLl9yZWdpc3RlciA9IGZ1bmN0aW9uIChjbGFzZSkge1xuICAgICAgICAgICAgaWYgKGNsYXNlLnR5cGUgaW4gdGhpcy5yZXNvdXJjZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIENvcmUucHJvdG90eXBlLmdldFJlc291cmNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUucmVmcmVzaExvYWRpbmdzID0gZnVuY3Rpb24gKGZhY3Rvcikge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvcmUuTWUgPSBudWxsO1xuICAgICAgICBDb3JlLlNlcnZpY2VzID0gbnVsbDtcbiAgICAgICAgcmV0dXJuIENvcmU7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmUgPSBDb3JlO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmUnLCBDb3JlKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBSZXNvdXJjZSBpbXBsZW1lbnRzIElSZXNvdXJjZSB7XG4gICAgICAgIHB1YmxpYyBzY2hlbWE6IElTY2hlbWE7XG4gICAgICAgIHByb3RlY3RlZCBwYXRoOiBzdHJpbmc7ICAgLy8gd2l0aG91dCBzbGFzaGVzXG5cbiAgICAgICAgcHVibGljIGlzX25ldyA9IHRydWU7XG4gICAgICAgIHB1YmxpYyB0eXBlOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBpZDogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgYXR0cmlidXRlczogYW55IDtcbiAgICAgICAgcHVibGljIHJlbGF0aW9uc2hpcHM6IGFueSA9IHt9OyAvL1tdO1xuXG4gICAgICAgIHB1YmxpYyBjYWNoZTogT2JqZWN0O1xuICAgICAgICBwdWJsaWMgY2FjaGVfdmFyczogT2JqZWN0ID0ge307XG5cbiAgICAgICAgcHVibGljIGNsb25lKCk6IGFueSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgKDxhbnk+dGhpcy5jb25zdHJ1Y3RvcikoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgUmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBAcmV0dXJuIHRydWUgaWYgdGhlIHJlc291cmNlIGRvbid0IGV4aXN0IGFuZCByZWdpc3RlcmVkIG9rXG4gICAgICAgICoqL1xuICAgICAgICBwdWJsaWMgcmVnaXN0ZXIoKTogYm9vbGVhbiB7XG4gICAgICAgICAgICBpZiAoSnNvbmFwaS5Db3JlLk1lID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0Vycm9yOiB5b3UgYXJlIHRyeWluZyByZWdpc3RlciAtLT4gJyArIHRoaXMudHlwZSArICcgPC0tIGJlZm9yZSBpbmplY3QgSnNvbmFwaUNvcmUgc29tZXdoZXJlLCBhbG1vc3Qgb25lIHRpbWUuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG9ubHkgd2hlbiBzZXJ2aWNlIGlzIHJlZ2lzdGVyZWQsIG5vdCBjbG9uZWQgb2JqZWN0XG4gICAgICAgICAgICB0aGlzLmNhY2hlID0ge307XG4gICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldzxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KCk6IFQge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgICAgIGxldCBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHRoaXMuaWQgPSAnJztcbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0ge307XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHNlbGYucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc19uZXcgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KHBhcmFtcz86IEpzb25hcGkuSVBhcmFtcyk6IElEYXRhT2JqZWN0IHtcbiAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuXG4gICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwcyA9IHsgfTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IFsgXTtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlZF9pZHMgPSBbIF07IC8vanVzdCBmb3IgY29udHJvbCBkb24ndCByZXBlYXQgYW55IHJlc291cmNlXG5cbiAgICAgICAgICAgIC8vIFJFQUxUSU9OU0hJUFNcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gJiYgdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgbWFueSAoaGFzTWFueTp0cnVlKVxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcblxuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIChyZXNvdXJjZTogSnNvbmFwaS5JUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBvbmUgKGhhc01hbnk6ZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgIGlmICghKCdpZCcgaW4gcmVsYXRpb25zaGlwLmRhdGEpICYmICFhbmd1bGFyLmVxdWFscyh7fSwgcmVsYXRpb25zaGlwLmRhdGEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVsYXRpb25fYWxpYXMgKyAnIGRlZmluZWQgd2l0aCBoYXNNYW55OmZhbHNlLCBidXQgSSBoYXZlIGEgY29sbGVjdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcC5kYXRhLmlkICYmIHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7IGlkOiByZWxhdGlvbnNoaXAuZGF0YS5pZCwgdHlwZTogcmVsYXRpb25zaGlwLmRhdGEudHlwZSB9IH07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogeyB9IH07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBubyBzZSBhZ3JlZ8OzIGHDum4gYSBpbmNsdWRlZCAmJiBzZSBoYSBwZWRpZG8gaW5jbHVpciBjb24gZWwgcGFybXMuaW5jbHVkZVxuICAgICAgICAgICAgICAgICAgICBsZXQgdGVtcG9yYWxfaWQgPSByZWxhdGlvbnNoaXAuZGF0YS50eXBlICsgJ18nICsgcmVsYXRpb25zaGlwLmRhdGEuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25zaGlwLmRhdGEudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZF9pZHMucHVzaCh0ZW1wb3JhbF9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlbGF0aW9uc2hpcC5kYXRhLnRvT2JqZWN0KHsgfSkuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGV0IHJldDogSURhdGFPYmplY3QgPSB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoaW5jbHVkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldC5pbmNsdWRlZCA9IGluY2x1ZGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KGlkOiBzdHJpbmcsIHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBUIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGRlbGV0ZShpZDogc3RyaW5nLCBwYXJhbXM/OiBPYmplY3QgfCBGdW5jdGlvbiwgZmNfc3VjY2Vzcz86IEZ1bmN0aW9uLCBmY19lcnJvcj86IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgICAgICAgICB0aGlzLl9fZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2RlbGV0ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFsbDxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFJlbGF0aW9uc2hpcHM8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihwYXJlbnRfcGF0aF9pZDogc3RyaW5nLFxuICAgICAgICAgICAgcGFyYW1zPzogT2JqZWN0IHwgRnVuY3Rpb24sIGZjX3N1Y2Nlc3M/OiBGdW5jdGlvbiwgZmNfZXJyb3I/OiBGdW5jdGlvblxuICAgICAgICApOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMocGFyZW50X3BhdGhfaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXRSZWxhdGlvbnNoaXBzJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2F2ZTxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHBhcmFtcz86IE9iamVjdCB8IEZ1bmN0aW9uLCBmY19zdWNjZXNzPzogRnVuY3Rpb24sIGZjX2Vycm9yPzogRnVuY3Rpb24pOiBBcnJheTxUPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBwcml2YXRlIF9fZXhlYyhpZDogc3RyaW5nLCBwYXJhbXM6IEpzb25hcGkuSVBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZTogc3RyaW5nKTogYW55IHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkge307XG5cbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcblxuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldFJlbGF0aW9uc2hpcHMnOlxuICAgICAgICAgICAgICAgIHBhcmFtcy5wYXRoID0gaWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9kZWxldGUoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZShwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZ2V0KGlkOiBzdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSAmJiB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gPyB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZVtpZF0gOiB0aGlzLm5ldygpO1xuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlKTtcbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBPYmplY3QgeyAvLyBBcnJheTxJUmVzb3VyY2U+IHtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5wYXRoID8gcGF0aC5hZGRQYXRoKHBhcmFtcy5wYXRoKSA6IG51bGw7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHsgfTtcbiAgICAgICAgICAgIC8vICghcGFyYW1zLnBhdGgpOiBiZWNvdXNlIHdlIG5lZWQgcmVhbCB0eXBlLCBub3QgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVcbiAgICAgICAgICAgIGlmICghcGFyYW1zLnBhdGggJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVfdmFyc1snX19wYXRoJ10gPT09IHRoaXMuZ2V0UGF0aCgpKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgZG9uJ3QgbWFrZVxuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLmdldFNlcnZpY2UoKS5jYWNoZSwgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2Vba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHBcbiAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgIC50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuYnVpbGQoc3VjY2Vzcy5kYXRhLCByZXNvdXJjZSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAgICAoIXBhcmFtcy5wYXRoKTogZmlsbCBjYWNoZSBuZWVkIHdvcmsgd2l0aCByZWxhdGlvbnNoaXBzIHRvbyxcbiAgICAgICAgICAgICAgICAgICAgZm9yIHRoZSBtb21tZW50IHdlJ3JlIGNyZWF0ZWQgdGhpcyBpZlxuICAgICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2RlbGV0ZShpZDogc3RyaW5nLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogdm9pZCB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcblxuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAuZGVsZXRlKHBhdGguZ2V0KCkpXG4gICAgICAgICAgICAudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3NhdmUocGFyYW1zOiBJUGFyYW1zLCBmY19zdWNjZXNzOiBGdW5jdGlvbiwgZmNfZXJyb3I6IEZ1bmN0aW9uKTogSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCBvYmplY3QgPSB0aGlzLnRvT2JqZWN0KHBhcmFtcyk7XG5cbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG5cbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmV4ZWMocGF0aC5nZXQoKSwgdGhpcy5pZCA/ICdQVVQnIDogJ1BPU1QnLCBvYmplY3QpO1xuXG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcblxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhZGRSZWxhdGlvbnNoaXA8VCBleHRlbmRzIEpzb25hcGkuSVJlc291cmNlPihyZXNvdXJjZTogVCwgdHlwZV9hbGlhcz86IHN0cmluZykge1xuICAgICAgICAgICAgbGV0IG9iamVjdF9rZXkgPSByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgIGlmICghb2JqZWN0X2tleSkge1xuICAgICAgICAgICAgICAgIG9iamVjdF9rZXkgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YTogeyB9IH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdLmhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtvYmplY3Rfa2V5XSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlbW92ZVJlbGF0aW9uc2hpcCh0eXBlX2FsaWFzOiBzdHJpbmcsIGlkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKCdkYXRhJyBpbiB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEoaWQgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ10pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW2lkXTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJpdmF0ZSBmaWxsQ2FjaGUocmVzb3VyY2VzKSB7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2VzLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxsQ2FjaGVSZXNvdXJjZShyZXNvdXJjZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9IHRoaXMuZ2V0UGF0aCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2VzKHJlc291cmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIGZpbGxDYWNoZVJlc291cmNlczxUIGV4dGVuZHMgSnNvbmFwaS5JUmVzb3VyY2U+KHJlc291cmNlczogQXJyYXk8VD4pIHtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcml2YXRlIGZpbGxDYWNoZVJlc291cmNlPFQgZXh0ZW5kcyBKc29uYXBpLklSZXNvdXJjZT4ocmVzb3VyY2U6IFQpIHtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZS5pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIEByZXR1cm4gVGhpcyByZXNvdXJjZSBsaWtlIGEgc2VydmljZVxuICAgICAgICAqKi9cbiAgICAgICAgcHVibGljIGdldFNlcnZpY2UoKTogYW55IHtcbiAgICAgICAgICAgIHJldHVybiBDb252ZXJ0ZXIuZ2V0U2VydmljZSh0aGlzLnR5cGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9OyAvL1tdO1xuICAgICAgICAgICAgdGhpcy5jYWNoZV92YXJzID0ge307XG4gICAgICAgIH1cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChKc29uYXBpLkNvcmUuTWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnRXJyb3I6IHlvdSBhcmUgdHJ5aW5nIHJlZ2lzdGVyIC0tPiAnICsgdGhpcy50eXBlICsgJyA8LS0gYmVmb3JlIGluamVjdCBKc29uYXBpQ29yZSBzb21ld2hlcmUsIGFsbW9zdCBvbmUgdGltZS4nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gb25seSB3aGVuIHNlcnZpY2UgaXMgcmVnaXN0ZXJlZCwgbm90IGNsb25lZCBvYmplY3RcbiAgICAgICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5uZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxhdGlvbnNoaXBzW2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuaXNfbmV3ID0gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zLCBwYXJhbXMpO1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBhbmd1bGFyLmV4dGVuZCh7fSwgSnNvbmFwaS5CYXNlLlNjaGVtYSwgdGhpcy5zY2hlbWEpO1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IFtdO1xuICAgICAgICAgICAgdmFyIGluY2x1ZGVkX2lkcyA9IFtdOyAvL2p1c3QgZm9yIGNvbnRyb2wgZG9uJ3QgcmVwZWF0IGFueSByZXNvdXJjZVxuICAgICAgICAgICAgLy8gUkVBTFRJT05TSElQU1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoX3RoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdICYmIF90aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXS5oYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBtYW55IChoYXNNYW55OnRydWUpXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gc2UgYWdyZWfDsyBhw7puIGEgaW5jbHVkZWQgJiYgc2UgaGEgcGVkaWRvIGluY2x1aXIgY29uIGVsIHBhcm1zLmluY2x1ZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wb3JhbF9pZCA9IHJlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlZF9pZHMuaW5kZXhPZih0ZW1wb3JhbF9pZCkgPT09IC0xICYmIHBhcmFtcy5pbmNsdWRlLmluZGV4T2YocmVsYXRpb25fYWxpYXMpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZC5wdXNoKHJlc291cmNlLnRvT2JqZWN0KHt9KS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYXMgb25lIChoYXNNYW55OmZhbHNlKVxuICAgICAgICAgICAgICAgICAgICBpZiAoISgnaWQnIGluIHJlbGF0aW9uc2hpcC5kYXRhKSAmJiAhYW5ndWxhci5lcXVhbHMoe30sIHJlbGF0aW9uc2hpcC5kYXRhKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKHJlbGF0aW9uX2FsaWFzICsgJyBkZWZpbmVkIHdpdGggaGFzTWFueTpmYWxzZSwgYnV0IEkgaGF2ZSBhIGNvbGxlY3Rpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwLmRhdGEuaWQgJiYgcmVsYXRpb25zaGlwLmRhdGEudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IHsgaWQ6IHJlbGF0aW9uc2hpcC5kYXRhLmlkLCB0eXBlOiByZWxhdGlvbnNoaXAuZGF0YS50eXBlIH0gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiB7fSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIHNlIGFncmVnw7MgYcO6biBhIGluY2x1ZGVkICYmIHNlIGhhIHBlZGlkbyBpbmNsdWlyIGNvbiBlbCBwYXJtcy5pbmNsdWRlXG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZW1wb3JhbF9pZCA9IHJlbGF0aW9uc2hpcC5kYXRhLnR5cGUgKyAnXycgKyByZWxhdGlvbnNoaXAuZGF0YS5pZDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVkX2lkcy5pbmRleE9mKHRlbXBvcmFsX2lkKSA9PT0gLTEgJiYgcGFyYW1zLmluY2x1ZGUuaW5kZXhPZihyZWxhdGlvbnNoaXAuZGF0YS50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkX2lkcy5wdXNoKHRlbXBvcmFsX2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkLnB1c2gocmVsYXRpb25zaGlwLmRhdGEudG9PYmplY3Qoe30pLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgcmV0ID0ge1xuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzOiByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0LmluY2x1ZGVkID0gaW5jbHVkZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmRlbGV0ZSA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdkZWxldGUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UmVsYXRpb25zaGlwcyA9IGZ1bmN0aW9uIChwYXJlbnRfcGF0aF9pZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKHBhcmVudF9wYXRoX2lkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0UmVsYXRpb25zaGlwcycpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIFRoaXMgbWV0aG9kIHNvcnQgcGFyYW1zIGZvciBuZXcoKSwgZ2V0KCkgYW5kIHVwZGF0ZSgpXG4gICAgICAgICovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fX2V4ZWMgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgLy8gbWFrZXMgYHBhcmFtc2Agb3B0aW9uYWxcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCBKc29uYXBpLkJhc2UuUGFyYW1zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5QYXJhbXMsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMuc2NoZW1hID0gYW5ndWxhci5leHRlbmQoe30sIEpzb25hcGkuQmFzZS5TY2hlbWEsIHRoaXMuc2NoZW1hKTtcbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0UmVsYXRpb25zaGlwcyc6XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wYXRoID0gaWQ7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2RlbGV0ZShpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUgJiYgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdID8gdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbaWRdIDogdGhpcy5uZXcoKTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIF90aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgX3RoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXJhbXMucGF0aCA/IHBhdGguYWRkUGF0aChwYXJhbXMucGF0aCkgOiBudWxsO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0ge307XG4gICAgICAgICAgICAvLyAoIXBhcmFtcy5wYXRoKTogYmVjb3VzZSB3ZSBuZWVkIHJlYWwgdHlwZSwgbm90IHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlXG4gICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlICYmIHRoaXMuZ2V0U2VydmljZSgpLmNhY2hlX3ZhcnNbJ19fcGF0aCddID09PSB0aGlzLmdldFBhdGgoKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IG1ha2VcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cFxuICAgICAgICAgICAgICAgIC5nZXQocGF0aC5nZXQoKSlcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29udmVydGVyLmJ1aWxkKHN1Y2Nlc3MuZGF0YSwgcmVzb3VyY2UsIF90aGlzLnNjaGVtYSk7XG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAoIXBhcmFtcy5wYXRoKTogZmlsbCBjYWNoZSBuZWVkIHdvcmsgd2l0aCByZWxhdGlvbnNoaXBzIHRvbyxcbiAgICAgICAgICAgICAgICBmb3IgdGhlIG1vbW1lbnQgd2UncmUgY3JlYXRlZCB0aGlzIGlmXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtcy5wYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIF90aGlzLmZpbGxDYWNoZShyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9kZWxldGUgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwXG4gICAgICAgICAgICAgICAgLmRlbGV0ZShwYXRoLmdldCgpKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX3NhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hZGRSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAocmVzb3VyY2UsIHR5cGVfYWxpYXMpIHtcbiAgICAgICAgICAgIHZhciBvYmplY3Rfa2V5ID0gcmVzb3VyY2UuaWQ7XG4gICAgICAgICAgICBpZiAoIW9iamVjdF9rZXkpIHtcbiAgICAgICAgICAgICAgICBvYmplY3Rfa2V5ID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHlwZV9hbGlhcyA9ICh0eXBlX2FsaWFzID8gdHlwZV9hbGlhcyA6IHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7fSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10uaGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW29iamVjdF9rZXldID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVtb3ZlUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHR5cGVfYWxpYXMsIGlkKSB7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoISgnZGF0YScgaW4gdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghKGlkIGluIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtpZF07XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmZpbGxDYWNoZSA9IGZ1bmN0aW9uIChyZXNvdXJjZXMpIHtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZXMuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGxDYWNoZVJlc291cmNlKHJlc291cmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNlcnZpY2UoKS5jYWNoZV92YXJzWydfX3BhdGgnXSA9IHRoaXMuZ2V0UGF0aCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsbENhY2hlUmVzb3VyY2VzKHJlc291cmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5maWxsQ2FjaGVSZXNvdXJjZXMgPSBmdW5jdGlvbiAocmVzb3VyY2VzKSB7XG4gICAgICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlc291cmNlcywgZnVuY3Rpb24gKHJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgX3RoaXMuZmlsbENhY2hlUmVzb3VyY2UocmVzb3VyY2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5maWxsQ2FjaGVSZXNvdXJjZSA9IGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTZXJ2aWNlKCkuY2FjaGVbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBAcmV0dXJuIFRoaXMgcmVzb3VyY2UgbGlrZSBhIHNlcnZpY2VcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRTZXJ2aWNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UodGhpcy50eXBlKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFJlc291cmNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5SZXNvdXJjZSA9IFJlc291cmNlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuXG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuXG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvYmFzZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHNcIi8+XG4vLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY29yZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3Jlc291cmNlLnRzXCIvPlxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9iYXNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
