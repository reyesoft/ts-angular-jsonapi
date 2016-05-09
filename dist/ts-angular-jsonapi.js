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
            }
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
        };
        Converter.getService = function (type) {
            var resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('Jsonapi Resource type `' + type + '` is not registered.');
            }
            return resource_service;
        };
        Converter.procreate = function (resource_service, data) {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            var resource = new resource_service.constructor();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes;
            return resource;
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
            this.relationships = [];
            this.params_base = {
                id: '',
                include: []
            };
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
        };
        Resource.prototype.toObject = function (params) {
            var relationships = {};
            angular.forEach(this.relationships, function (relationship, relation_alias) {
                relationships[relation_alias] = { data: [] };
                angular.forEach(relationship.data, function (resource) {
                    var reational_object = { id: resource.id, tpe: resource.type };
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
                include: {}
            };
            //return object;
        };
        Resource.prototype.get = function (id, params, fc_success, fc_error) {
            return this.__exec(id, params, fc_success, fc_error, 'get');
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
                case 'all':
                    return this._all(params, fc_success, fc_error);
                case 'save':
                    return this._save(params, fc_success, fc_error);
            }
        };
        Resource.prototype._get = function (id, params, fc_success, fc_error) {
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            path.addPath(id);
            params.include ? path.setInclude(params.include) : null;
            //let resource = new Resource();
            var resource = this.new();
            var promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(function (success) {
                var value = success.data.data;
                resource.attributes = value.attributes;
                resource.id = value.id;
                // instancio los include y los guardo en included arrary
                var included = {};
                if ('included' in success.data) {
                    included = Jsonapi.Converter.json_array2resources_array_by_type(success.data.included, false);
                }
                // recorro los relationships levanto el service correspondiente
                angular.forEach(value.relationships, function (relation_value, relation_key) {
                    // relation is in schema? have data or just links?
                    if (!(relation_key in resource.relationships) && ('data' in relation_value)) {
                        console.warn(resource.type + '.relationships.' + relation_key + ' received, but is not defined on schema.');
                        resource.relationships[relation_key] = { data: [] };
                    }
                    // sometime data=null or simple { }
                    if (relation_value.data && relation_value.data.length > 0) {
                        // we use relation_value.data[0].type, becouse maybe is polymophic
                        var resource_service_1 = Jsonapi.Converter.getService(relation_value.data[0].type);
                        if (resource_service_1) {
                            // recorro los resources del relation type
                            var relationship_resources = [];
                            angular.forEach(relation_value.data, function (resource_value) {
                                // está en el included?
                                var tmp_resource;
                                if (resource_value.type in included && resource_value.id in included[resource_value.type]) {
                                    tmp_resource = included[resource_value.type][resource_value.id];
                                }
                                else {
                                    tmp_resource = Jsonapi.Converter.procreate(resource_service_1, resource_value);
                                }
                                resource.relationships[relation_key].data[tmp_resource.id] = tmp_resource;
                            });
                        }
                    }
                });
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
            return resource;
        };
        Resource.prototype._all = function (params, fc_success, fc_error) {
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            params.include ? path.setInclude(params.include) : null;
            // make request
            var response = {}; // if you use [], key like id is not possible
            var promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(function (success) {
                Jsonapi.Converter.json_array2resources_array(success.data.data, response, true);
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
            return response;
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
                // instancio los include y los guardo en included arrary
                // let included = Converter.json_array2resources_array_by_type(success.data.included, false);
                fc_error(success);
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
            if (!resource.id) {
                resource.id = 'new_' + (Math.floor(Math.random() * 100000));
            }
            this.relationships[type_alias]['data'][resource.id] = resource;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLmpzIiwic2VydmljZXMvcGF0aC1tYWtlci50cyIsInNlcnZpY2VzL3BhdGgtbWFrZXIuanMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIuanMiLCJjb3JlLnRzIiwiY29yZS5qcyIsInJlc291cmNlLnRzIiwicmVzb3VyY2UuanMiLCJfYWxsLnRzIiwiX2FsbC5qcyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50cyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS5qcyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXBhcnNlci5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1zdG9yYWdlLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUVBLENBQUMsVUFBVSxTQUFPOztJQUVkLFFBQVEsT0FBTyxrQkFBa0I7U0FDaEMsU0FBUyxtQkFBbUI7UUFDekIsS0FBSzs7SUFHVCxRQUFRLE9BQU8sb0JBQW9CO0lBRW5DLFFBQVEsT0FBTyxhQUNmO1FBQ0k7UUFDQTtRQUNBOztHQUdMO0FDSkg7QUNkQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLFFBQUEsWUFBQTs7O1FBR0ksU0FBQSxLQUNjLE9BQ0EsaUJBQ0EsSUFBRTtZQUZGLEtBQUEsUUFBQTtZQUNBLEtBQUEsa0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLFNBQVAsVUFBYyxNQUFZOztRQUluQixLQUFBLFVBQUEsTUFBUCxVQUFXLE1BQVk7WUFDbkIsT0FBTyxLQUFLLEtBQUss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LFVBQVUsS0FBSyxNQUFNLEtBQUssV0FBVzs7WUFHdkQsS0FBSyxjQUFjLFlBQVksUUFBUSxTQUFTLE1BQU07O1FBRTlELE9BQUE7O0lBelBhLFFBQUEsV0FBUTtHQURsQixZQUFBLFVBQU87QUMrTWQ7QUMvTUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNzQkE7QUN0QkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxnQkFBQSxZQUFBOzs7UUFHSSxTQUFBLGFBQ2MsYUFBVztZQUFYLEtBQUEsY0FBQTs7UUFJbEIsT0FBQTs7SUFSYSxRQUFBLGVBQVk7SUFVekIsUUFBUSxPQUFPLG9CQUFvQixRQUFRLHVCQUF1QjtHQVgvRCxZQUFBLFVBQU87QUNZZDtBQ1pBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsaUJBQUEsWUFBQTs7UUFHSSxTQUFBLGdCQUFBOztRQUlPLGNBQUEsVUFBQSxXQUFQLFVBQWdCLGFBQW1CO1lBQy9CLE9BQU87O1FBRWYsT0FBQTs7SUFWYSxRQUFBLGdCQUFhO0dBRHZCLFlBQUEsVUFBTztBQ2FkO0FDYkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxrQkFBQSxZQUFBOztRQUdJLFNBQUEsaUJBQUE7O1FBT08sZUFBQSxVQUFBLE1BQVAsVUFBVyxLQUFHOzs7O1FBS1AsZUFBQSxVQUFBLFFBQVAsVUFBYSxLQUFLLE1BQUk7Ozs7UUFNMUIsT0FBQTs7SUFyQmEsUUFBQSxpQkFBYztHQUR4QixZQUFBLFVBQU87QUNrQmQiLCJmaWxlIjoidHMtYW5ndWxhci1qc29uYXBpLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJ1xuICAgIH0pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJyxcbiAgICBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcblxufSkoYW5ndWxhcik7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgICAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLydcbiAgICB9KTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJywgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG59KShhbmd1bGFyKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSHR0cCB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJGh0dHAsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkICRxXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKHBhdGg6IHN0cmluZykge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm90ZWN0ZWQgZXhlYyhwYXRoOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBkYXRhPzogSnNvbmFwaS5JRGF0YU9iamVjdCkge1xuICAgICAgICAgICAgbGV0IHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuXG4gICAgICAgICAgICBsZXQgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICBsZXQgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCByc0pzb25hcGlDb25maWcsICRxKSB7XG4gICAgICAgICAgICB0aGlzLiRodHRwID0gJGh0dHA7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJHEgPSAkcTtcbiAgICAgICAgfVxuICAgICAgICBIdHRwLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAocGF0aCwgbWV0aG9kLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICB2YXIgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBQYXRoTWFrZXIge1xuICAgICAgICBwdWJsaWMgcGF0aHM6IEFycmF5PFN0cmluZz4gPSBbXTtcbiAgICAgICAgcHVibGljIGluY2x1ZGVzOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgcHVibGljIGFkZFBhdGgodmFsdWU6IFN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzZXRJbmNsdWRlKHN0cmluZ3NfYXJyYXk6IEFycmF5PFN0cmluZz4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldCgpOiBTdHJpbmcge1xuICAgICAgICAgICAgbGV0IGdldF9wYXJhbXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnLz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBQYXRoTWFrZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBQYXRoTWFrZXIoKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzID0gW107XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5hZGRQYXRoID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLnNldEluY2x1ZGUgPSBmdW5jdGlvbiAoc3RyaW5nc19hcnJheSkge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGdldF9wYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICcvPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFBhdGhNYWtlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUGF0aE1ha2VyID0gUGF0aE1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvbnZlcnRlciB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIFJlc291cmNlcyBhcnJheXMgd2l0aG91dCBba2V5c11cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheShcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IFtKc29uYXBpLklEYXRhUmVzb3VyY2VdLFxuICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXk/OiBPYmplY3QsIC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPixcbiAgICAgICAgICAgIHVzZV9pZF9mb3Jfa2V5ID0gZmFsc2VcbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGlmICghZGVzdGluYXRpb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBqc29uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluY2x1ZGVkIGZvciBleGFtcGxlIG5lZWQgYSBleHRyYSBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheS5wdXNoKHJlc291cmNlLmlkICsgcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRlc3RpbmF0aW9uX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlIChcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IFtKc29uYXBpLklEYXRhUmVzb3VyY2VdLFxuICAgICAgICAgICAgaW5zdGFuY2VfcmVsYXRpb25zaGlwczogYm9vbGVhblxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgbGV0IGFsbF9yZXNvdXJjZXM6YW55ID0geyB9IDtcbiAgICAgICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheShqc29uX2FycmF5LCBhbGxfcmVzb3VyY2VzLCBmYWxzZSk7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2VzID0geyB9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBqc29uMnJlc291cmNlKGpzb25fcmVzb3VyY2U6IEpzb25hcGkuSURhdGFSZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShqc29uX3Jlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGpzb25fcmVzb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGdldFNlcnZpY2UodHlwZTogc3RyaW5nKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaSBSZXNvdXJjZSB0eXBlIGAnICsgdHlwZSArICdgIGlzIG5vdCByZWdpc3RlcmVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgcHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2U6IEpzb25hcGkuSVJlc291cmNlLCBkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gbmV3ICg8YW55PnJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIGpzb25fYXJyYXlfMSA9IGpzb25fYXJyYXk7IF9pIDwganNvbl9hcnJheV8xLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0ganNvbl9hcnJheV8xW19pXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uMnJlc291cmNlKGRhdGEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmNsdWRlZCBmb3IgZXhhbXBsZSBuZWVkIGEgZXh0cmEgcGFyYW1ldGVyXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGVzdGluYXRpb25fYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBpbmRleGVkIFJlc291cmNlcyBhcnJheSBieSBbdHlwZV1baWRdXG4gICAgICAgICoqL1xuICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZSA9IGZ1bmN0aW9uIChqc29uX2FycmF5LCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgYWxsX3Jlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KGpzb25fYXJyYXksIGFsbF9yZXNvdXJjZXMsIGZhbHNlKTtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZXMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxfcmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIShyZXNvdXJjZS50eXBlIGluIHJlc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmpzb24ycmVzb3VyY2UgPSBmdW5jdGlvbiAoanNvbl9yZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGpzb25fcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwganNvbl9yZXNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5nZXRTZXJ2aWNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkgUmVzb3VyY2UgdHlwZSBgJyArIHR5cGUgKyAnYCBpcyBub3QgcmVnaXN0ZXJlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIucHJvY3JlYXRlID0gZnVuY3Rpb24gKHJlc291cmNlX3NlcnZpY2UsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghKCd0eXBlJyBpbiBkYXRhICYmICdpZCcgaW4gZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdKc29uYXBpIFJlc291cmNlIGlzIG5vdCBjb3JyZWN0JywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBuZXcgcmVzb3VyY2Vfc2VydmljZS5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gQ29udmVydGVyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db252ZXJ0ZXIgPSBDb252ZXJ0ZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29yZSBpbXBsZW1lbnRzIEpzb25hcGkuSUNvcmUge1xuICAgICAgICBwdWJsaWMgcm9vdFBhdGg6IHN0cmluZyA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICBwdWJsaWMgcmVzb3VyY2VzOiBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgbG9hZGluZ3NDb3VudGVyOiBudW1iZXIgPSAwO1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NTdGFydCA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NEb25lID0gKCkgPT4ge307XG5cbiAgICAgICAgcHVibGljIHN0YXRpYyBNZTogSnNvbmFwaS5JQ29yZSA9IG51bGw7XG4gICAgICAgIHB1YmxpYyBzdGF0aWMgU2VydmljZXM6IGFueSA9IG51bGw7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlDb3JlU2VydmljZXNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfcmVnaXN0ZXIoY2xhc2UpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmIChjbGFzZS50eXBlIGluIHRoaXMucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFJlc291cmNlKHR5cGU6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlZnJlc2hMb2FkaW5ncyhmYWN0b3I6IG51bWJlcik6IHZvaWQge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBDb3JlKHJzSnNvbmFwaUNvbmZpZywgSnNvbmFwaUNvcmVTZXJ2aWNlcykge1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlDb3JlU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICAgICAgdGhpcy5yb290UGF0aCA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyID0gMDtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cbiAgICAgICAgQ29yZS5wcm90b3R5cGUuX3JlZ2lzdGVyID0gZnVuY3Rpb24gKGNsYXNlKSB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUuZ2V0UmVzb3VyY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5yZWZyZXNoTG9hZGluZ3MgPSBmdW5jdGlvbiAoZmFjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5NZSA9IG51bGw7XG4gICAgICAgIENvcmUuU2VydmljZXMgPSBudWxsO1xuICAgICAgICByZXR1cm4gQ29yZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZSA9IENvcmU7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFJlc291cmNlIGltcGxlbWVudHMgSVJlc291cmNlIHtcbiAgICAgICAgcHVibGljIHNjaGVtYTogSVNjaGVtYTtcbiAgICAgICAgcHJvdGVjdGVkIHBhdGg6IHN0cmluZyA9IG51bGw7ICAgLy8gd2l0aG91dCBzbGFzaGVzXG5cbiAgICAgICAgcHVibGljIHR5cGU6IHN0cmluZztcbiAgICAgICAgcHVibGljIGlkOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBhbnkgO1xuICAgICAgICBwdWJsaWMgcmVsYXRpb25zaGlwczogYW55ID0gW107XG5cbiAgICAgICAgcHJpdmF0ZSBwYXJhbXNfYmFzZTogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIHB1YmxpYyByZWdpc3RlcigpOiBib29sZWFuIHtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFBhdGgoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldygpOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgICAgIGxldCB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KHBhcmFtczogSnNvbmFwaS5JUGFyYW1zKTogSnNvbmFwaS5JRGF0YU9iamVjdCB7XG4gICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwcyA9IHsgfTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCAocmVzb3VyY2U6IEpzb25hcGkuSVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHRwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXVsnZGF0YSddLnB1c2gocmVhdGlvbmFsX29iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgaW5jbHVkZToge1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vcmV0dXJuIG9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQoaWQ6IFN0cmluZywgcGFyYW1zPywgZmNfc3VjY2Vzcz8sIGZjX2Vycm9yPyk6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhbGwocGFyYW1zPywgZmNfc3VjY2Vzcz8sIGZjX2Vycm9yPyk6IEFycmF5PElSZXNvdXJjZT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzYXZlKHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBBcnJheTxJUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnc2F2ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIFRoaXMgbWV0aG9kIHNvcnQgcGFyYW1zIGZvciBuZXcoKSwgZ2V0KCkgYW5kIHVwZGF0ZSgpXG4gICAgICAgICovXG4gICAgICAgIHB1YmxpYyBfX2V4ZWMoaWQ6IFN0cmluZywgcGFyYW1zOiBKc29uYXBpLklQYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGU6IHN0cmluZyk6IGFueSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtc19iYXNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCB0aGlzLnBhcmFtc19iYXNlLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkge307XG5cbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0KGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2F2ZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2dldChpZDogU3RyaW5nLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogSVJlc291cmNlIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgLy9sZXQgcmVzb3VyY2UgPSBuZXcgUmVzb3VyY2UoKTtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG5cbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBzdWNjZXNzLmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoc3VjY2Vzcy5kYXRhLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHZhbHVlLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbGF0aW9uIGlzIGluIHNjaGVtYT8gaGF2ZSBkYXRhIG9yIGp1c3QgbGlua3M/XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShyZWxhdGlvbl9rZXkgaW4gcmVzb3VyY2UucmVsYXRpb25zaGlwcykgJiYgKCdkYXRhJyBpbiByZWxhdGlvbl92YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVzb3VyY2UudHlwZSArICcucmVsYXRpb25zaGlwcy4nICsgcmVsYXRpb25fa2V5ICsgJyByZWNlaXZlZCwgYnV0IGlzIG5vdCBkZWZpbmVkIG9uIHNjaGVtYS4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YSAmJiByZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZSB1c2UgcmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlLCBiZWNvdXNlIG1heWJlIGlzIHBvbHltb3BoaWNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZXNvdXJjZXMgZGVsIHJlbGF0aW9uIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlbGF0aW9uc2hpcF9yZXNvdXJjZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIChyZXNvdXJjZV92YWx1ZTogSnNvbmFwaS5JRGF0YVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlc3TDoSBlbiBlbCBpbmNsdWRlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0bXBfcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2VfdmFsdWUudHlwZSBpbiBpbmNsdWRlZCAmJiByZXNvdXJjZV92YWx1ZS5pZCBpbiBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRtcF9yZXNvdXJjZSA9IGluY2x1ZGVkW3Jlc291cmNlX3ZhbHVlLnR5cGVdW3Jlc291cmNlX3ZhbHVlLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIHJlc291cmNlX3ZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5kYXRhW3RtcF9yZXNvdXJjZS5pZF0gPSB0bXBfcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBPYmplY3QgeyAvLyBBcnJheTxJUmVzb3VyY2U+IHtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0ge307ICAvLyBpZiB5b3UgdXNlIFtdLCBrZXkgbGlrZSBpZCBpcyBub3QgcG9zc2libGVcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KHN1Y2Nlc3MuZGF0YS5kYXRhLCByZXNwb25zZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9zYXZlKHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG5cbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICAgICAgICAgIC8vIGxldCBpbmNsdWRlZCA9IENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKHN1Y2Nlc3MuZGF0YS5pbmNsdWRlZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhZGRSZWxhdGlvbnNoaXAocmVzb3VyY2U6IEpzb25hcGkuSVJlc291cmNlLCB0eXBlX2FsaWFzPzogc3RyaW5nKSB7XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXJlc291cmNlLmlkKSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG51bGw7IC8vIHdpdGhvdXQgc2xhc2hlc1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgICAgICB0aGlzLnBhcmFtc19iYXNlID0ge1xuICAgICAgICAgICAgICAgIGlkOiAnJyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIFJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgQHJldHVybiB0cnVlIGlmIHRoZSByZXNvdXJjZSBkb24ndCBleGlzdCBhbmQgcmVnaXN0ZXJlZCBva1xuICAgICAgICAqKi9cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuQ29yZS5NZS5fcmVnaXN0ZXIodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aCA/IHRoaXMucGF0aCA6IHRoaXMudHlwZTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLm5ldyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLnJlc2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uc2hpcCwgcmVsYXRpb25fYWxpYXMpIHtcbiAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25zaGlwLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVhdGlvbmFsX29iamVjdCA9IHsgaWQ6IHJlc291cmNlLmlkLCB0cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgICAgICAgICBpZDogdGhpcy5pZCxcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogdGhpcy5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzOiByZWxhdGlvbnNoaXBzXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vcmV0dXJuIG9iamVjdDtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdzYXZlJyk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX19leGVjID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCBleGVjX3R5cGUpIHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtc19iYXNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtc19iYXNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIHRoaXMucGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHN3aXRjaCAoZXhlY190eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnZ2V0JzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmUocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICAvL2xldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5uZXcoKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgICAgICB2YXIgaW5jbHVkZWQgPSB7fTtcbiAgICAgICAgICAgICAgICBpZiAoJ2luY2x1ZGVkJyBpbiBzdWNjZXNzLmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlKHN1Y2Nlc3MuZGF0YS5pbmNsdWRlZCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godmFsdWUucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVsYXRpb24gaXMgaW4gc2NoZW1hPyBoYXZlIGRhdGEgb3IganVzdCBsaW5rcz9cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocmVsYXRpb25fa2V5IGluIHJlc291cmNlLnJlbGF0aW9uc2hpcHMpICYmICgnZGF0YScgaW4gcmVsYXRpb25fdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4ocmVzb3VyY2UudHlwZSArICcucmVsYXRpb25zaGlwcy4nICsgcmVsYXRpb25fa2V5ICsgJyByZWNlaXZlZCwgYnV0IGlzIG5vdCBkZWZpbmVkIG9uIHNjaGVtYS4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBzb21ldGltZSBkYXRhPW51bGwgb3Igc2ltcGxlIHsgfVxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25fdmFsdWUuZGF0YSAmJiByZWxhdGlvbl92YWx1ZS5kYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlIHVzZSByZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUsIGJlY291c2UgbWF5YmUgaXMgcG9seW1vcGhpY1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2VfMSA9IEpzb25hcGkuQ29udmVydGVyLmdldFNlcnZpY2UocmVsYXRpb25fdmFsdWUuZGF0YVswXS50eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlXzEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZXNvdXJjZXMgZGVsIHJlbGF0aW9uIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwX3Jlc291cmNlcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbl92YWx1ZS5kYXRhLCBmdW5jdGlvbiAocmVzb3VyY2VfdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXN0w6EgZW4gZWwgaW5jbHVkZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bXBfcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV92YWx1ZS50eXBlIGluIGluY2x1ZGVkICYmIHJlc291cmNlX3ZhbHVlLmlkIGluIGluY2x1ZGVkW3Jlc291cmNlX3ZhbHVlLnR5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXBfcmVzb3VyY2UgPSBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXVtyZXNvdXJjZV92YWx1ZS5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXBfcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZV8xLCByZXNvdXJjZV92YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmRhdGFbdG1wX3Jlc291cmNlLmlkXSA9IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICAvLyBtYWtlIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciByZXNwb25zZSA9IHt9OyAvLyBpZiB5b3UgdXNlIFtdLCBrZXkgbGlrZSBpZCBpcyBub3QgcG9zc2libGVcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KHN1Y2Nlc3MuZGF0YS5kYXRhLCByZXNwb25zZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX3NhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BVVCcgOiAnUE9TVCcsIG9iamVjdCk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICAgICAgLy8gbGV0IGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoc3VjY2Vzcy5kYXRhLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3Ioc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcignZGF0YScgaW4gZXJyb3IgPyBlcnJvci5kYXRhIDogZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hZGRSZWxhdGlvbnNoaXAgPSBmdW5jdGlvbiAocmVzb3VyY2UsIHR5cGVfYWxpYXMpIHtcbiAgICAgICAgICAgIHR5cGVfYWxpYXMgPSAodHlwZV9hbGlhcyA/IHR5cGVfYWxpYXMgOiByZXNvdXJjZS50eXBlKTtcbiAgICAgICAgICAgIGlmICghKHR5cGVfYWxpYXMgaW4gdGhpcy5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXSA9IHsgZGF0YToge30gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghcmVzb3VyY2UuaWQpIHtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9ICduZXdfJyArIChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUmVzb3VyY2U7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlJlc291cmNlID0gUmVzb3VyY2U7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG5cbi8vIEpzb25hcGkgaW50ZXJmYWNlcyBwYXJ0IG9mIHRvcCBsZXZlbFxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kb2N1bWVudC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLWNvbGxlY3Rpb24uZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1vYmplY3QuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1yZXNvdXJjZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9wYXJhbXMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9yZXNvdXJjZS5kLnRzXCIvPlxuXG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtY29udmVydGVyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuLy8gUGFyYW1ldGVycyBmb3IgVFMtSnNvbmFwaSBDbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3NjaGVtYS5kLnRzXCIvPlxuLy8gVFMtSnNvbmFwaSBDbGFzc2VzIEludGVyZmFjZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvY29yZS5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9yZXNvdXJjZS5kLnRzXCIvPlxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
