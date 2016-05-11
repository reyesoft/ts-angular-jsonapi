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
                    var reational_object = { id: resource.id, type: resource.type };
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLmpzIiwic2VydmljZXMvcGF0aC1tYWtlci50cyIsInNlcnZpY2VzL3BhdGgtbWFrZXIuanMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIuanMiLCJjb3JlLnRzIiwiY29yZS5qcyIsInJlc291cmNlLnRzIiwicmVzb3VyY2UuanMiLCJfYWxsLnRzIiwiX2FsbC5qcyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50cyIsInNlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS5qcyIsInNlcnZpY2VzL2pzb25hcGktcGFyc2VyLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXBhcnNlci5zZXJ2aWNlLmpzIiwic2VydmljZXMvanNvbmFwaS1zdG9yYWdlLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9qc29uYXBpLXN0b3JhZ2Uuc2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUVBLENBQUMsVUFBVSxTQUFPOztJQUVkLFFBQVEsT0FBTyxrQkFBa0I7U0FDaEMsU0FBUyxtQkFBbUI7UUFDekIsS0FBSzs7SUFHVCxRQUFRLE9BQU8sb0JBQW9CO0lBRW5DLFFBQVEsT0FBTyxhQUNmO1FBQ0k7UUFDQTtRQUNBOztHQUdMO0FDSkg7QUNkQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLFFBQUEsWUFBQTs7O1FBR0ksU0FBQSxLQUNjLE9BQ0EsaUJBQ0EsSUFBRTtZQUZGLEtBQUEsUUFBQTtZQUNBLEtBQUEsa0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLFNBQVAsVUFBYyxNQUFZOztRQUluQixLQUFBLFVBQUEsTUFBUCxVQUFXLE1BQVk7WUFDbkIsT0FBTyxLQUFLLEtBQUssTUFBTTs7UUFHakIsS0FBQSxVQUFBLE9BQVYsVUFBZSxNQUFjLFFBQWdCLE1BQTBCO1lBQ25FLElBQUksTUFBTTtnQkFDTixRQUFRO2dCQUNSLEtBQUssS0FBSyxnQkFBZ0IsTUFBTTtnQkFDaEMsU0FBUztvQkFDTCxnQkFBZ0I7OztZQUd4QixTQUFTLElBQUksVUFBVTtZQUN2QixJQUFJLFVBQVUsS0FBSyxNQUFNO1lBRXpCLElBQUksV0FBVyxLQUFLLEdBQUc7WUFDdkIsSUFBSSxRQUFRO1lBQ1osUUFBUSxLQUFLLEdBQUcsZ0JBQWdCO1lBQ2hDLFFBQVEsS0FDSixVQUFBLFNBQU87Z0JBQ0gsUUFBUSxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7Z0JBQ2pDLFNBQVMsUUFBUTtlQUVyQixVQUFBLE9BQUs7Z0JBQ0QsUUFBUSxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7Z0JBQ2pDLFNBQVMsT0FBTzs7WUFHeEIsT0FBTyxTQUFTOztRQUV4QixPQUFBOztJQTdDYSxRQUFBLE9BQUk7SUE4Q2pCLFFBQVEsT0FBTyxvQkFBb0IsUUFBUSxlQUFlO0dBL0N2RCxZQUFBLFVBQU87QUN5Q2Q7QUN6Q0EsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxhQUFBLFlBQUE7UUFBQSxTQUFBLFlBQUE7WUFDVyxLQUFBLFFBQXVCO1lBQ3ZCLEtBQUEsV0FBMEI7O1FBRTFCLFVBQUEsVUFBQSxVQUFQLFVBQWUsT0FBYTtZQUN4QixLQUFLLE1BQU0sS0FBSzs7UUFHYixVQUFBLFVBQUEsYUFBUCxVQUFrQixlQUE0QjtZQUMxQyxLQUFLLFdBQVc7O1FBR2IsVUFBQSxVQUFBLE1BQVAsWUFBQTtZQUNJLElBQUksYUFBNEI7WUFFaEMsSUFBSSxLQUFLLFNBQVMsU0FBUyxHQUFHO2dCQUMxQixXQUFXLEtBQUssYUFBYSxLQUFLLFNBQVMsS0FBSzs7WUFHcEQsT0FBTyxLQUFLLE1BQU0sS0FBSztpQkFDbEIsV0FBVyxTQUFTLElBQUksT0FBTyxXQUFXLEtBQUssT0FBTzs7UUFFbkUsT0FBQTs7SUF0QmEsUUFBQSxZQUFTO0dBRG5CLFlBQUEsVUFBTztBQ3lCZDtBQ3pCQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLGFBQUEsWUFBQTtRQUFBLFNBQUEsWUFBQTs7Ozs7UUFLVyxVQUFBLDZCQUFQLFVBQ0ksWUFDQTtZQUNBLGdCQUFzQjtZQUF0QixJQUFBLG1CQUFBLEtBQUEsR0FBc0IsRUFBdEIsaUJBQUE7WUFFQSxJQUFJLENBQUMsbUJBQW1CO2dCQUNwQixvQkFBb0I7O1lBRXhCLEtBQWlCLElBQUEsS0FBQSxHQUFBLGVBQUEsWUFBQSxLQUFBLGFBQUEsUUFBQSxNQUFXO2dCQUF2QixJQUFJLE9BQUksYUFBQTtnQkFDVCxJQUFJLFdBQVcsUUFBUSxVQUFVLGNBQWMsTUFBTTtnQkFDckQsSUFBSSxnQkFBZ0I7b0JBQ2hCLGtCQUFrQixTQUFTLE1BQU07O3FCQUM5Qjs7b0JBRUgsa0JBQWtCLFNBQVMsT0FBTyxNQUFNLFNBQVMsTUFBTTs7O1lBSS9ELE9BQU87Ozs7O1FBTUosVUFBQSxxQ0FBUCxVQUNJLFlBQ0Esd0JBQStCO1lBRS9CLElBQUksZ0JBQW9CO1lBQ3hCLFVBQVUsMkJBQTJCLFlBQVksZUFBZTtZQUNoRSxJQUFJLFlBQVk7WUFDaEIsUUFBUSxRQUFRLGVBQWUsVUFBQyxVQUFRO2dCQUNwQyxJQUFJLEVBQUUsU0FBUyxRQUFRLFlBQVk7b0JBQy9CLFVBQVUsU0FBUyxRQUFROztnQkFFL0IsVUFBVSxTQUFTLE1BQU0sU0FBUyxNQUFNOztZQUU1QyxPQUFPOztRQUdKLFVBQUEsZ0JBQVAsVUFBcUIsZUFBc0Msd0JBQXNCO1lBQzdFLElBQUksbUJBQW1CLFFBQVEsVUFBVSxXQUFXLGNBQWM7WUFDbEUsSUFBSSxrQkFBa0I7Z0JBQ2xCLE9BQU8sUUFBUSxVQUFVLFVBQVUsa0JBQWtCOzs7UUFJdEQsVUFBQSxhQUFQLFVBQWtCLE1BQVk7WUFDMUIsSUFBSSxtQkFBbUIsUUFBUSxLQUFLLEdBQUcsWUFBWTtZQUNuRCxJQUFJLFFBQVEsWUFBWSxtQkFBbUI7Z0JBQ3ZDLFFBQVEsS0FBSyw0QkFBNEIsT0FBTzs7WUFFcEQsT0FBTzs7UUFHSixVQUFBLFlBQVAsVUFBaUIsa0JBQXFDLE1BQTJCO1lBQzdFLElBQUksRUFBRSxVQUFVLFFBQVEsUUFBUSxPQUFPO2dCQUNuQyxRQUFRLE1BQU0sbUNBQW1DOztZQUVyRCxJQUFJLFdBQVcsSUFBVSxpQkFBaUI7WUFDMUMsU0FBUztZQUNULFNBQVMsS0FBSyxLQUFLO1lBQ25CLFNBQVMsYUFBYSxLQUFLO1lBQzNCLE9BQU87O1FBR2YsT0FBQTs7SUF2RWEsUUFBQSxZQUFTO0dBRG5CLFlBQUEsVUFBTztBQ3FFZDtBQ3JFQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLFFBQUEsWUFBQTs7O1FBWUksU0FBQSxLQUNjLGlCQUNBLHFCQUFtQjtZQURuQixLQUFBLGtCQUFBO1lBQ0EsS0FBQSxzQkFBQTtZQWJQLEtBQUEsV0FBbUI7WUFDbkIsS0FBQSxZQUFzQztZQUV0QyxLQUFBLGtCQUEwQjtZQUMxQixLQUFBLGdCQUFnQixZQUFBO1lBQ2hCLEtBQUEsZUFBZSxZQUFBO1lBVWxCLFFBQVEsS0FBSyxLQUFLO1lBQ2xCLFFBQVEsS0FBSyxXQUFXOztRQUdyQixLQUFBLFVBQUEsWUFBUCxVQUFpQixPQUFLO1lBQ2xCLElBQUksTUFBTSxRQUFRLEtBQUssV0FBVztnQkFDOUIsT0FBTzs7WUFFWCxLQUFLLFVBQVUsTUFBTSxRQUFRO1lBQzdCLE9BQU87O1FBR0osS0FBQSxVQUFBLGNBQVAsVUFBbUIsTUFBWTtZQUMzQixPQUFPLEtBQUssVUFBVTs7UUFHbkIsS0FBQSxVQUFBLGtCQUFQLFVBQXVCLFFBQWM7WUFDakMsS0FBSyxtQkFBbUI7WUFDeEIsSUFBSSxLQUFLLG9CQUFvQixHQUFHO2dCQUM1QixLQUFLOztpQkFDRixJQUFJLEtBQUssb0JBQW9CLEdBQUc7Z0JBQ25DLEtBQUs7OztRQTdCQyxLQUFBLEtBQW9CO1FBQ3BCLEtBQUEsV0FBZ0I7UUErQmxDLE9BQUE7O0lBeENhLFFBQUEsT0FBSTtJQXlDakIsUUFBUSxPQUFPLG9CQUFvQixRQUFRLGVBQWU7R0ExQ3ZELFlBQUEsVUFBTztBQ3lDZDtBQ3pDQSxJQUFPO0FBQVAsQ0FBQSxVQUFPLFNBQVE7SUFDWCxJQUFBLFlBQUEsWUFBQTtRQUFBLFNBQUEsV0FBQTtZQUVjLEtBQUEsT0FBZTtZQUtsQixLQUFBLGdCQUFxQjtZQUVwQixLQUFBLGNBQStCO2dCQUNuQyxJQUFJO2dCQUNKLFNBQVM7OztRQUdOLFNBQUEsVUFBQSxRQUFQLFlBQUE7WUFDSSxJQUFJLFdBQVcsSUFBVSxLQUFLO1lBQzlCLEtBQUssSUFBSSxZQUFZLE1BQU07Z0JBQ3ZCLElBQUksT0FBTyxLQUFLLGNBQWMsVUFBVTtvQkFDcEMsU0FBUyxZQUFZLEtBQUs7OztZQUdsQyxPQUFPOzs7Ozs7UUFPSixTQUFBLFVBQUEsV0FBUCxZQUFBO1lBQ0ksT0FBTyxRQUFRLEtBQUssR0FBRyxVQUFVOztRQUc5QixTQUFBLFVBQUEsVUFBUCxZQUFBO1lBQ0ksT0FBTyxLQUFLLE9BQU8sS0FBSyxPQUFPLEtBQUs7OztRQUlqQyxTQUFBLFVBQUEsTUFBUCxZQUFBO1lBQ0ksSUFBSSxXQUFXLEtBQUs7WUFDcEIsU0FBUztZQUNULE9BQU87O1FBR0osU0FBQSxVQUFBLFFBQVAsWUFBQTtZQUNJLElBQUksUUFBUTtZQUNaLEtBQUssS0FBSztZQUNWLEtBQUssYUFBYTtZQUNsQixLQUFLLGdCQUFnQjtZQUNyQixRQUFRLFFBQVEsS0FBSyxPQUFPLGVBQWUsVUFBQyxPQUFPLEtBQUc7Z0JBQ2xELE1BQU0sY0FBYyxPQUFPO2dCQUMzQixNQUFNLGNBQWMsS0FBSyxVQUFVOzs7UUFJcEMsU0FBQSxVQUFBLFdBQVAsVUFBZ0IsUUFBdUI7WUFDbkMsSUFBSSxnQkFBZ0I7WUFDcEIsUUFBUSxRQUFRLEtBQUssZUFBZSxVQUFDLGNBQWMsZ0JBQWM7Z0JBQzdELGNBQWMsa0JBQWtCLEVBQUUsTUFBTTtnQkFDeEMsUUFBUSxRQUFRLGFBQWEsTUFBTSxVQUFDLFVBQTJCO29CQUMzRCxJQUFJLG1CQUFtQixFQUFFLElBQUksU0FBUyxJQUFJLE1BQU0sU0FBUztvQkFDekQsY0FBYyxnQkFBZ0IsUUFBUSxLQUFLOzs7WUFJbkQsT0FBTztnQkFDSCxNQUFNO29CQUNGLE1BQU0sS0FBSztvQkFDWCxJQUFJLEtBQUs7b0JBQ1QsWUFBWSxLQUFLO29CQUNqQixlQUFlOztnQkFFbkIsU0FBUzs7OztRQU9WLFNBQUEsVUFBQSxNQUFQLFVBQVcsSUFBWSxRQUFTLFlBQWEsVUFBUztZQUNsRCxPQUFPLEtBQUssT0FBTyxJQUFJLFFBQVEsWUFBWSxVQUFVOztRQUdsRCxTQUFBLFVBQUEsTUFBUCxVQUFXLFFBQVMsWUFBYSxVQUFTO1lBQ3RDLE9BQU8sS0FBSyxPQUFPLE1BQU0sUUFBUSxZQUFZLFVBQVU7O1FBR3BELFNBQUEsVUFBQSxPQUFQLFVBQVksUUFBUyxZQUFhLFVBQVM7WUFDdkMsT0FBTyxLQUFLLE9BQU8sTUFBTSxRQUFRLFlBQVksVUFBVTs7Ozs7UUFNbkQsU0FBQSxVQUFBLFNBQVIsVUFBZSxJQUFZLFFBQXlCLFlBQVksVUFBVSxXQUFpQjs7WUFFdkYsSUFBSSxRQUFRLFdBQVcsU0FBUztnQkFDNUIsV0FBVztnQkFDWCxhQUFhO2dCQUNiLFNBQVMsS0FBSzs7aUJBQ1g7Z0JBQ0gsSUFBSSxRQUFRLFlBQVksU0FBUztvQkFDN0IsU0FBUyxLQUFLOztxQkFDWDtvQkFDSCxTQUFTLFFBQVEsT0FBTyxJQUFJLEtBQUssYUFBYTs7O1lBSXRELGFBQWEsUUFBUSxXQUFXLGNBQWMsYUFBYSxZQUFBO1lBQzNELFdBQVcsUUFBUSxXQUFXLFlBQVksV0FBVyxZQUFBO1lBRXJELFFBQVE7Z0JBQ0osS0FBSztvQkFDTCxPQUFPLEtBQUssS0FBSyxJQUFJLFFBQVEsWUFBWTtnQkFDekMsS0FBSztvQkFDTCxPQUFPLEtBQUssS0FBSyxRQUFRLFlBQVk7Z0JBQ3JDLEtBQUs7b0JBQ0wsT0FBTyxLQUFLLE1BQU0sUUFBUSxZQUFZOzs7UUFJdkMsU0FBQSxVQUFBLE9BQVAsVUFBWSxJQUFZLFFBQVEsWUFBWSxVQUFROztZQUVoRCxJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLEtBQUssUUFBUTtZQUNiLE9BQU8sVUFBVSxLQUFLLFdBQVcsT0FBTyxXQUFXOztZQUduRCxJQUFJLFdBQVcsS0FBSztZQUVwQixJQUFJLFVBQVUsUUFBUSxLQUFLLFNBQVMsWUFBWSxJQUFJLEtBQUs7WUFDekQsUUFBUSxLQUNKLFVBQUEsU0FBTztnQkFDSCxJQUFJLFFBQVEsUUFBUSxLQUFLO2dCQUN6QixTQUFTLGFBQWEsTUFBTTtnQkFDNUIsU0FBUyxLQUFLLE1BQU07O2dCQUdwQixJQUFJLFdBQVc7Z0JBQ2YsSUFBSSxjQUFjLFFBQVEsTUFBTTtvQkFDNUIsV0FBVyxRQUFBLFVBQVUsbUNBQW1DLFFBQVEsS0FBSyxVQUFVOzs7Z0JBSW5GLFFBQVEsUUFBUSxNQUFNLGVBQWUsVUFBQyxnQkFBZ0IsY0FBWTs7b0JBRzlELElBQUksRUFBRSxnQkFBZ0IsU0FBUyxtQkFBbUIsVUFBVSxpQkFBaUI7d0JBQ3pFLFFBQVEsS0FBSyxTQUFTLE9BQU8sb0JBQW9CLGVBQWU7d0JBQ2hFLFNBQVMsY0FBYyxnQkFBZ0IsRUFBRSxNQUFNOzs7b0JBSW5ELElBQUksZUFBZSxRQUFRLGVBQWUsS0FBSyxTQUFTLEdBQUc7O3dCQUV2RCxJQUFJLHFCQUFtQixRQUFRLFVBQVUsV0FBVyxlQUFlLEtBQUssR0FBRzt3QkFDM0UsSUFBSSxvQkFBa0I7OzRCQUVsQixJQUFJLHlCQUF5Qjs0QkFDN0IsUUFBUSxRQUFRLGVBQWUsTUFBTSxVQUFDLGdCQUFxQzs7Z0NBRXZFLElBQUk7Z0NBQ0osSUFBSSxlQUFlLFFBQVEsWUFBWSxlQUFlLE1BQU0sU0FBUyxlQUFlLE9BQU87b0NBQ3ZGLGVBQWUsU0FBUyxlQUFlLE1BQU0sZUFBZTs7cUNBQ3pEO29DQUNILGVBQWUsUUFBUSxVQUFVLFVBQVUsb0JBQWtCOztnQ0FFakUsU0FBUyxjQUFjLGNBQWMsS0FBSyxhQUFhLE1BQU07Ozs7O2dCQU03RSxXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVM7O1lBSWpCLE9BQU87O1FBR0osU0FBQSxVQUFBLE9BQVAsVUFBWSxRQUFRLFlBQVksVUFBUTs7WUFHcEMsSUFBSSxPQUFPLElBQUksUUFBUTtZQUN2QixLQUFLLFFBQVEsS0FBSztZQUNsQixPQUFPLFVBQVUsS0FBSyxXQUFXLE9BQU8sV0FBVzs7WUFHbkQsSUFBSSxXQUFXO1lBQ2YsSUFBSSxVQUFVLFFBQVEsS0FBSyxTQUFTLFlBQVksSUFBSSxLQUFLO1lBQ3pELFFBQVEsS0FDSixVQUFBLFNBQU87Z0JBQ0gsUUFBQSxVQUFVLDJCQUEyQixRQUFRLEtBQUssTUFBTSxVQUFVO2dCQUNsRSxXQUFXO2VBRWYsVUFBQSxPQUFLO2dCQUNELFNBQVM7O1lBR2pCLE9BQU87O1FBR0osU0FBQSxVQUFBLFFBQVAsVUFBYSxRQUFTLFlBQWEsVUFBUztZQUN4QyxJQUFJLFNBQVMsS0FBSyxTQUFTOztZQUczQixJQUFJLE9BQU8sSUFBSSxRQUFRO1lBQ3ZCLEtBQUssUUFBUSxLQUFLO1lBQ2xCLEtBQUssTUFBTSxLQUFLLFFBQVEsS0FBSztZQUM3QixPQUFPLFVBQVUsS0FBSyxXQUFXLE9BQU8sV0FBVztZQUVuRCxJQUFJLFdBQVcsS0FBSztZQUVwQixJQUFJLFVBQVUsUUFBUSxLQUFLLFNBQVMsWUFBWSxLQUFLLEtBQUssT0FBTyxLQUFLLEtBQUssUUFBUSxRQUFRO1lBRTNGLFFBQVEsS0FDSixVQUFBLFNBQU87Z0JBQ0gsSUFBSSxRQUFRLFFBQVEsS0FBSztnQkFDekIsU0FBUyxhQUFhLE1BQU07Z0JBQzVCLFNBQVMsS0FBSyxNQUFNOzs7Z0JBS3BCLFdBQVc7ZUFFZixVQUFBLE9BQUs7Z0JBQ0QsU0FBUyxVQUFVLFFBQVEsTUFBTSxPQUFPOztZQUloRCxPQUFPOztRQUdKLFNBQUEsVUFBQSxrQkFBUCxVQUF1QixVQUE2QixZQUFtQjtZQUNuRSxjQUFjLGFBQWEsYUFBYSxTQUFTO1lBQ2pELElBQUksRUFBRSxjQUFjLEtBQUssZ0JBQWdCO2dCQUNyQyxLQUFLLGNBQWMsY0FBYyxFQUFFLE1BQU07O1lBRzdDLElBQUksQ0FBQyxTQUFTLElBQUk7Z0JBQ2QsU0FBUyxLQUFLLFVBQVUsS0FBSyxNQUFNLEtBQUssV0FBVzs7WUFHdkQsS0FBSyxjQUFjLFlBQVksUUFBUSxTQUFTLE1BQU07O1FBRTlELE9BQUE7O0lBelBhLFFBQUEsV0FBUTtHQURsQixZQUFBLFVBQU87QUMrTWQ7QUMvTUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNzQkE7QUN0QkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxnQkFBQSxZQUFBOzs7UUFHSSxTQUFBLGFBQ2MsYUFBVztZQUFYLEtBQUEsY0FBQTs7UUFJbEIsT0FBQTs7SUFSYSxRQUFBLGVBQVk7SUFVekIsUUFBUSxPQUFPLG9CQUFvQixRQUFRLHVCQUF1QjtHQVgvRCxZQUFBLFVBQU87QUNZZDtBQ1pBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsaUJBQUEsWUFBQTs7UUFHSSxTQUFBLGdCQUFBOztRQUlPLGNBQUEsVUFBQSxXQUFQLFVBQWdCLGFBQW1CO1lBQy9CLE9BQU87O1FBRWYsT0FBQTs7SUFWYSxRQUFBLGdCQUFhO0dBRHZCLFlBQUEsVUFBTztBQ2FkO0FDYkEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxrQkFBQSxZQUFBOztRQUdJLFNBQUEsaUJBQUE7O1FBT08sZUFBQSxVQUFBLE1BQVAsVUFBVyxLQUFHOzs7O1FBS1AsZUFBQSxVQUFBLFFBQVAsVUFBYSxLQUFLLE1BQUk7Ozs7UUFNMUIsT0FBQTs7SUFyQmEsUUFBQSxpQkFBYztHQUR4QixZQUFBLFVBQU87QUNrQmQiLCJmaWxlIjoidHMtYW5ndWxhci1qc29uYXBpLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJ1xuICAgIH0pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJyxcbiAgICBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcblxufSkoYW5ndWxhcik7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cbihmdW5jdGlvbiAoYW5ndWxhcikge1xuICAgIC8vIENvbmZpZ1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLmNvbmZpZycsIFtdKVxuICAgICAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLydcbiAgICB9KTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcbiAgICBhbmd1bGFyLm1vZHVsZSgncnNKc29uYXBpJywgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG59KShhbmd1bGFyKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSHR0cCB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgJGh0dHAsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkICRxXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZGVsZXRlKHBhdGg6IHN0cmluZykge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm90ZWN0ZWQgZXhlYyhwYXRoOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBkYXRhPzogSnNvbmFwaS5JRGF0YU9iamVjdCkge1xuICAgICAgICAgICAgbGV0IHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuXG4gICAgICAgICAgICBsZXQgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICBsZXQgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCByc0pzb25hcGlDb25maWcsICRxKSB7XG4gICAgICAgICAgICB0aGlzLiRodHRwID0gJGh0dHA7XG4gICAgICAgICAgICB0aGlzLnJzSnNvbmFwaUNvbmZpZyA9IHJzSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJHEgPSAkcTtcbiAgICAgICAgfVxuICAgICAgICBIdHRwLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhwYXRoLCAnR0VUJyk7XG4gICAgICAgIH07XG4gICAgICAgIEh0dHAucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAocGF0aCwgbWV0aG9kLCBkYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVxID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5yc0pzb25hcGlDb25maWcudXJsICsgcGF0aCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vdm5kLmFwaStqc29uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBkYXRhICYmIChyZXFbJ2RhdGEnXSA9IGRhdGEpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLiRodHRwKHJlcSk7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICB2YXIgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygxKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBQYXRoTWFrZXIge1xuICAgICAgICBwdWJsaWMgcGF0aHM6IEFycmF5PFN0cmluZz4gPSBbXTtcbiAgICAgICAgcHVibGljIGluY2x1ZGVzOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgcHVibGljIGFkZFBhdGgodmFsdWU6IFN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzZXRJbmNsdWRlKHN0cmluZ3NfYXJyYXk6IEFycmF5PFN0cmluZz4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldCgpOiBTdHJpbmcge1xuICAgICAgICAgICAgbGV0IGdldF9wYXJhbXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnLz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBQYXRoTWFrZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBQYXRoTWFrZXIoKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzID0gW107XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5hZGRQYXRoID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLnNldEluY2x1ZGUgPSBmdW5jdGlvbiAoc3RyaW5nc19hcnJheSkge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGdldF9wYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICcvPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFBhdGhNYWtlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUGF0aE1ha2VyID0gUGF0aE1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvbnZlcnRlciB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIFJlc291cmNlcyBhcnJheXMgd2l0aG91dCBba2V5c11cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheShcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IFtKc29uYXBpLklEYXRhUmVzb3VyY2VdLFxuICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXk/OiBPYmplY3QsIC8vIEFycmF5PEpzb25hcGkuSVJlc291cmNlPixcbiAgICAgICAgICAgIHVzZV9pZF9mb3Jfa2V5ID0gZmFsc2VcbiAgICAgICAgKTogT2JqZWN0IHsgLy8gQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIGlmICghZGVzdGluYXRpb25fYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbl9hcnJheSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgZGF0YSBvZiBqc29uX2FycmF5KSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuanNvbjJyZXNvdXJjZShkYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGluY2x1ZGVkIGZvciBleGFtcGxlIG5lZWQgYSBleHRyYSBwYXJhbWV0ZXJcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UudHlwZSArICdfJyArIHJlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAvLyBkZXN0aW5hdGlvbl9hcnJheS5wdXNoKHJlc291cmNlLmlkICsgcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRlc3RpbmF0aW9uX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgIENvbnZlcnQganNvbiBhcnJheXMgKGxpa2UgaW5jbHVkZWQpIHRvIGFuIGluZGV4ZWQgUmVzb3VyY2VzIGFycmF5IGJ5IFt0eXBlXVtpZF1cbiAgICAgICAgKiovXG4gICAgICAgIHN0YXRpYyBqc29uX2FycmF5MnJlc291cmNlc19hcnJheV9ieV90eXBlIChcbiAgICAgICAgICAgIGpzb25fYXJyYXk6IFtKc29uYXBpLklEYXRhUmVzb3VyY2VdLFxuICAgICAgICAgICAgaW5zdGFuY2VfcmVsYXRpb25zaGlwczogYm9vbGVhblxuICAgICAgICApOiBPYmplY3QgeyAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4ge1xuICAgICAgICAgICAgbGV0IGFsbF9yZXNvdXJjZXM6YW55ID0geyB9IDtcbiAgICAgICAgICAgIENvbnZlcnRlci5qc29uX2FycmF5MnJlc291cmNlc19hcnJheShqc29uX2FycmF5LCBhbGxfcmVzb3VyY2VzLCBmYWxzZSk7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2VzID0geyB9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKGFsbF9yZXNvdXJjZXMsIChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghKHJlc291cmNlLnR5cGUgaW4gcmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXNbcmVzb3VyY2UudHlwZV0gPSB7IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBqc29uMnJlc291cmNlKGpzb25fcmVzb3VyY2U6IEpzb25hcGkuSURhdGFSZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShqc29uX3Jlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5Db252ZXJ0ZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGpzb25fcmVzb3VyY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIGdldFNlcnZpY2UodHlwZTogc3RyaW5nKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaSBSZXNvdXJjZSB0eXBlIGAnICsgdHlwZSArICdgIGlzIG5vdCByZWdpc3RlcmVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgcHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2U6IEpzb25hcGkuSVJlc291cmNlLCBkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gbmV3ICg8YW55PnJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIENvbnZlcnRlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIENvbnZlcnRlcigpIHtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgQ29udmVydCBqc29uIGFycmF5cyAobGlrZSBpbmNsdWRlZCkgdG8gYW4gUmVzb3VyY2VzIGFycmF5cyB3aXRob3V0IFtrZXlzXVxuICAgICAgICAqKi9cbiAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5ID0gZnVuY3Rpb24gKGpzb25fYXJyYXksIGRlc3RpbmF0aW9uX2FycmF5LCAvLyBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4sXG4gICAgICAgICAgICB1c2VfaWRfZm9yX2tleSkge1xuICAgICAgICAgICAgaWYgKHVzZV9pZF9mb3Jfa2V5ID09PSB2b2lkIDApIHsgdXNlX2lkX2Zvcl9rZXkgPSBmYWxzZTsgfVxuICAgICAgICAgICAgaWYgKCFkZXN0aW5hdGlvbl9hcnJheSkge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5ID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKHZhciBfaSA9IDAsIGpzb25fYXJyYXlfMSA9IGpzb25fYXJyYXk7IF9pIDwganNvbl9hcnJheV8xLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgICAgIHZhciBkYXRhID0ganNvbl9hcnJheV8xW19pXTtcbiAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5qc29uMnJlc291cmNlKGRhdGEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAodXNlX2lkX2Zvcl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb25fYXJyYXlbcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbmNsdWRlZCBmb3IgZXhhbXBsZSBuZWVkIGEgZXh0cmEgcGFyYW1ldGVyXG4gICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uX2FycmF5W3Jlc291cmNlLnR5cGUgKyAnXycgKyByZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGVzdGluYXRpb25fYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBDb252ZXJ0IGpzb24gYXJyYXlzIChsaWtlIGluY2x1ZGVkKSB0byBhbiBpbmRleGVkIFJlc291cmNlcyBhcnJheSBieSBbdHlwZV1baWRdXG4gICAgICAgICoqL1xuICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZSA9IGZ1bmN0aW9uIChqc29uX2FycmF5LCBpbnN0YW5jZV9yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgICAgICB2YXIgYWxsX3Jlc291cmNlcyA9IHt9O1xuICAgICAgICAgICAgQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5KGpzb25fYXJyYXksIGFsbF9yZXNvdXJjZXMsIGZhbHNlKTtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZXMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChhbGxfcmVzb3VyY2VzLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIShyZXNvdXJjZS50eXBlIGluIHJlc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW3Jlc291cmNlLnR5cGVdID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc291cmNlc1tyZXNvdXJjZS50eXBlXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlcztcbiAgICAgICAgfTtcbiAgICAgICAgQ29udmVydGVyLmpzb24ycmVzb3VyY2UgPSBmdW5jdGlvbiAoanNvbl9yZXNvdXJjZSwgaW5zdGFuY2VfcmVsYXRpb25zaGlwcykge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvbnZlcnRlci5nZXRTZXJ2aWNlKGpzb25fcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwganNvbl9yZXNvdXJjZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIENvbnZlcnRlci5nZXRTZXJ2aWNlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkgUmVzb3VyY2UgdHlwZSBgJyArIHR5cGUgKyAnYCBpcyBub3QgcmVnaXN0ZXJlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9O1xuICAgICAgICBDb252ZXJ0ZXIucHJvY3JlYXRlID0gZnVuY3Rpb24gKHJlc291cmNlX3NlcnZpY2UsIGRhdGEpIHtcbiAgICAgICAgICAgIGlmICghKCd0eXBlJyBpbiBkYXRhICYmICdpZCcgaW4gZGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdKc29uYXBpIFJlc291cmNlIGlzIG5vdCBjb3JyZWN0JywgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBuZXcgcmVzb3VyY2Vfc2VydmljZS5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gQ29udmVydGVyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db252ZXJ0ZXIgPSBDb252ZXJ0ZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgQ29yZSBpbXBsZW1lbnRzIEpzb25hcGkuSUNvcmUge1xuICAgICAgICBwdWJsaWMgcm9vdFBhdGg6IHN0cmluZyA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICBwdWJsaWMgcmVzb3VyY2VzOiBBcnJheTxKc29uYXBpLklSZXNvdXJjZT4gPSBbXTtcblxuICAgICAgICBwdWJsaWMgbG9hZGluZ3NDb3VudGVyOiBudW1iZXIgPSAwO1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NTdGFydCA9ICgpID0+IHt9O1xuICAgICAgICBwdWJsaWMgbG9hZGluZ3NEb25lID0gKCkgPT4ge307XG5cbiAgICAgICAgcHVibGljIHN0YXRpYyBNZTogSnNvbmFwaS5JQ29yZSA9IG51bGw7XG4gICAgICAgIHB1YmxpYyBzdGF0aWMgU2VydmljZXM6IGFueSA9IG51bGw7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgcnNKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlDb3JlU2VydmljZXNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUgPSB0aGlzO1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLlNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfcmVnaXN0ZXIoY2xhc2UpOiBib29sZWFuIHtcbiAgICAgICAgICAgIGlmIChjbGFzZS50eXBlIGluIHRoaXMucmVzb3VyY2VzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFJlc291cmNlKHR5cGU6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlZnJlc2hMb2FkaW5ncyhmYWN0b3I6IG51bWJlcik6IHZvaWQge1xuICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0NvdW50ZXIgKz0gZmFjdG9yO1xuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc0RvbmUoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBDb3JlKHJzSnNvbmFwaUNvbmZpZywgSnNvbmFwaUNvcmVTZXJ2aWNlcykge1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlDb3JlU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICAgICAgdGhpcy5yb290UGF0aCA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyID0gMDtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NTdGFydCA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lID0gZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5TZXJ2aWNlcyA9IEpzb25hcGlDb3JlU2VydmljZXM7XG4gICAgICAgIH1cbiAgICAgICAgQ29yZS5wcm90b3R5cGUuX3JlZ2lzdGVyID0gZnVuY3Rpb24gKGNsYXNlKSB7XG4gICAgICAgICAgICBpZiAoY2xhc2UudHlwZSBpbiB0aGlzLnJlc291cmNlcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzW2NsYXNlLnR5cGVdID0gY2xhc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUuZ2V0UmVzb3VyY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5yZWZyZXNoTG9hZGluZ3MgPSBmdW5jdGlvbiAoZmFjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5NZSA9IG51bGw7XG4gICAgICAgIENvcmUuU2VydmljZXMgPSBudWxsO1xuICAgICAgICByZXR1cm4gQ29yZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZSA9IENvcmU7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFJlc291cmNlIGltcGxlbWVudHMgSVJlc291cmNlIHtcbiAgICAgICAgcHVibGljIHNjaGVtYTogSVNjaGVtYTtcbiAgICAgICAgcHJvdGVjdGVkIHBhdGg6IHN0cmluZyA9IG51bGw7ICAgLy8gd2l0aG91dCBzbGFzaGVzXG5cbiAgICAgICAgcHVibGljIHR5cGU6IHN0cmluZztcbiAgICAgICAgcHVibGljIGlkOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBhbnkgO1xuICAgICAgICBwdWJsaWMgcmVsYXRpb25zaGlwczogYW55ID0gW107XG5cbiAgICAgICAgcHJpdmF0ZSBwYXJhbXNfYmFzZTogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIHB1YmxpYyByZWdpc3RlcigpOiBib29sZWFuIHtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldFBhdGgoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldygpOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UucmVzZXQoKTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICAgICAgICAgIGxldCB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLmlkID0gJyc7XG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IHt9O1xuICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldID0ge307XG4gICAgICAgICAgICAgICAgeHRoaXMucmVsYXRpb25zaGlwc1trZXldWydkYXRhJ10gPSB7fTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KHBhcmFtczogSnNvbmFwaS5JUGFyYW1zKTogSnNvbmFwaS5JRGF0YU9iamVjdCB7XG4gICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwcyA9IHsgfTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCAocmVzb3VyY2U6IEpzb25hcGkuSVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZWF0aW9uYWxfb2JqZWN0ID0geyBpZDogcmVzb3VyY2UuaWQsIHR5cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvL3JldHVybiBvYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGlkOiBTdHJpbmcsIHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX19leGVjKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnZ2V0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWxsKHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBBcnJheTxJUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9fZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnYWxsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2F2ZShwYXJhbXM/LCBmY19zdWNjZXNzPywgZmNfZXJyb3I/KTogQXJyYXk8SVJlc291cmNlPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICBUaGlzIG1ldGhvZCBzb3J0IHBhcmFtcyBmb3IgbmV3KCksIGdldCgpIGFuZCB1cGRhdGUoKVxuICAgICAgICAqL1xuICAgICAgICBwcml2YXRlIF9fZXhlYyhpZDogU3RyaW5nLCBwYXJhbXM6IEpzb25hcGkuSVBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZTogc3RyaW5nKTogYW55IHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvciA9IGZjX3N1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyA9IHBhcmFtcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtc19iYXNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYW5ndWxhci5leHRlbmQoe30sIHRoaXMucGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7fTtcblxuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZShwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfZ2V0KGlkOiBTdHJpbmcsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvL2xldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0ge307XG4gICAgICAgICAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIHN1Y2Nlc3MuZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShzdWNjZXNzLmRhdGEuaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godmFsdWUucmVsYXRpb25zaGlwcywgKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVsYXRpb24gaXMgaW4gc2NoZW1hPyBoYXZlIGRhdGEgb3IganVzdCBsaW5rcz9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZXNvdXJjZS5yZWxhdGlvbnNoaXBzKSAmJiAoJ2RhdGEnIGluIHJlbGF0aW9uX3ZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZXNvdXJjZS50eXBlICsgJy5yZWxhdGlvbnNoaXBzLicgKyByZWxhdGlvbl9rZXkgKyAnIHJlY2VpdmVkLCBidXQgaXMgbm90IGRlZmluZWQgb24gc2NoZW1hLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc29tZXRpbWUgZGF0YT1udWxsIG9yIHNpbXBsZSB7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhICYmIHJlbGF0aW9uX3ZhbHVlLmRhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlIHVzZSByZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUsIGJlY291c2UgbWF5YmUgaXMgcG9seW1vcGhpY1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShyZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlc291cmNlcyBkZWwgcmVsYXRpb24gdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVsYXRpb25zaGlwX3Jlc291cmNlcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgKHJlc291cmNlX3ZhbHVlOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzdMOhIGVuIGVsIGluY2x1ZGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV92YWx1ZS50eXBlIGluIGluY2x1ZGVkICYmIHJlc291cmNlX3ZhbHVlLmlkIGluIGluY2x1ZGVkW3Jlc291cmNlX3ZhbHVlLnR5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV1bcmVzb3VyY2VfdmFsdWUuaWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXBfcmVzb3VyY2UgPSBKc29uYXBpLkNvbnZlcnRlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwgcmVzb3VyY2VfdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmRhdGFbdG1wX3Jlc291cmNlLmlkXSA9IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IE9iamVjdCB7IC8vIEFycmF5PElSZXNvdXJjZT4ge1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgLy8gbWFrZSByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSB7fTsgIC8vIGlmIHlvdSB1c2UgW10sIGtleSBsaWtlIGlkIGlzIG5vdCBwb3NzaWJsZVxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoc3VjY2Vzcy5kYXRhLmRhdGEsIHJlc3BvbnNlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3NhdmUocGFyYW1zPywgZmNfc3VjY2Vzcz8sIGZjX2Vycm9yPyk6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgdGhpcy5pZCAmJiBwYXRoLmFkZFBhdGgodGhpcy5pZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuXG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5leGVjKHBhdGguZ2V0KCksIHRoaXMuaWQgPyAnUFVUJyA6ICdQT1NUJywgb2JqZWN0KTtcblxuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgICAgICAgICAgLy8gbGV0IGluY2x1ZGVkID0gQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoc3VjY2Vzcy5kYXRhLmluY2x1ZGVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoJ2RhdGEnIGluIGVycm9yID8gZXJyb3IuZGF0YSA6IGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWRkUmVsYXRpb25zaGlwKHJlc291cmNlOiBKc29uYXBpLklSZXNvdXJjZSwgdHlwZV9hbGlhcz86IHN0cmluZykge1xuICAgICAgICAgICAgdHlwZV9hbGlhcyA9ICh0eXBlX2FsaWFzID8gdHlwZV9hbGlhcyA6IHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7IH0gfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZS5pZCkge1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFJlc291cmNlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUmVzb3VyY2UoKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGggPSBudWxsOyAvLyB3aXRob3V0IHNsYXNoZXNcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5wYXJhbXNfYmFzZSA9IHtcbiAgICAgICAgICAgICAgICBpZDogJycsXG4gICAgICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH07XG4gICAgICAgIC8qKlxuICAgICAgICBSZWdpc3RlciBzY2hlbWEgb24gSnNvbmFwaS5Db3JlXG4gICAgICAgIEByZXR1cm4gdHJ1ZSBpZiB0aGUgcmVzb3VyY2UgZG9uJ3QgZXhpc3QgYW5kIHJlZ2lzdGVyZWQgb2tcbiAgICAgICAgKiovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5uZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSB7XG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHlwZTogcmVzb3VyY2UudHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2FsaWFzXVsnZGF0YSddLnB1c2gocmVhdGlvbmFsX29iamVjdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy9yZXR1cm4gb2JqZWN0O1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2FsbCcpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX2V4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfTtcbiAgICAgICAgLyoqXG4gICAgICAgIFRoaXMgbWV0aG9kIHNvcnQgcGFyYW1zIGZvciBuZXcoKSwgZ2V0KCkgYW5kIHVwZGF0ZSgpXG4gICAgICAgICovXG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fX2V4ZWMgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsIGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgLy8gbWFrZXMgYHBhcmFtc2Agb3B0aW9uYWxcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgdGhpcy5wYXJhbXNfYmFzZSwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIGZjX2Vycm9yID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX2Vycm9yKSA/IGZjX2Vycm9yIDogZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgc3dpdGNoIChleGVjX3R5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdnZXQnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0KGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc2F2ZShwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vbGV0IHJlc291cmNlID0gbmV3IFJlc291cmNlKCk7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IHt9O1xuICAgICAgICAgICAgICAgIGlmICgnaW5jbHVkZWQnIGluIHN1Y2Nlc3MuZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZCA9IEpzb25hcGkuQ29udmVydGVyLmpzb25fYXJyYXkycmVzb3VyY2VzX2FycmF5X2J5X3R5cGUoc3VjY2Vzcy5kYXRhLmluY2x1ZGVkLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh2YWx1ZS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAocmVsYXRpb25fdmFsdWUsIHJlbGF0aW9uX2tleSkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/IGhhdmUgZGF0YSBvciBqdXN0IGxpbmtzP1xuICAgICAgICAgICAgICAgICAgICBpZiAoIShyZWxhdGlvbl9rZXkgaW4gcmVzb3VyY2UucmVsYXRpb25zaGlwcykgJiYgKCdkYXRhJyBpbiByZWxhdGlvbl92YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZXNvdXJjZS50eXBlICsgJy5yZWxhdGlvbnNoaXBzLicgKyByZWxhdGlvbl9rZXkgKyAnIHJlY2VpdmVkLCBidXQgaXMgbm90IGRlZmluZWQgb24gc2NoZW1hLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIHNvbWV0aW1lIGRhdGE9bnVsbCBvciBzaW1wbGUgeyB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbl92YWx1ZS5kYXRhICYmIHJlbGF0aW9uX3ZhbHVlLmRhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2UgdXNlIHJlbGF0aW9uX3ZhbHVlLmRhdGFbMF0udHlwZSwgYmVjb3VzZSBtYXliZSBpcyBwb2x5bW9waGljXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZV8xID0gSnNvbmFwaS5Db252ZXJ0ZXIuZ2V0U2VydmljZShyZWxhdGlvbl92YWx1ZS5kYXRhWzBdLnR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2VfMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlc291cmNlcyBkZWwgcmVsYXRpb24gdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBfcmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZV92YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlc3TDoSBlbiBlbCBpbmNsdWRlZD9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3ZhbHVlLnR5cGUgaW4gaW5jbHVkZWQgJiYgcmVzb3VyY2VfdmFsdWUuaWQgaW4gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRtcF9yZXNvdXJjZSA9IGluY2x1ZGVkW3Jlc291cmNlX3ZhbHVlLnR5cGVdW3Jlc291cmNlX3ZhbHVlLmlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRtcF9yZXNvdXJjZSA9IEpzb25hcGkuQ29udmVydGVyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlXzEsIHJlc291cmNlX3ZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5yZWxhdGlvbnNoaXBzW3JlbGF0aW9uX2tleV0uZGF0YVt0bXBfcmVzb3VyY2UuaWRdID0gdG1wX3Jlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2FsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0ge307IC8vIGlmIHlvdSB1c2UgW10sIGtleSBsaWtlIGlkIGlzIG5vdCBwb3NzaWJsZVxuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXkoc3VjY2Vzcy5kYXRhLmRhdGEsIHJlc3BvbnNlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fc2F2ZSA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICB2YXIgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICB2YXIgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHRoaXMuaWQgJiYgcGF0aC5hZGRQYXRoKHRoaXMuaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMubmV3KCk7XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5leGVjKHBhdGguZ2V0KCksIHRoaXMuaWQgPyAnUFVUJyA6ICdQT1NUJywgb2JqZWN0KTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgICAgICAvLyBsZXQgaW5jbHVkZWQgPSBDb252ZXJ0ZXIuanNvbl9hcnJheTJyZXNvdXJjZXNfYXJyYXlfYnlfdHlwZShzdWNjZXNzLmRhdGEuaW5jbHVkZWQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoJ2RhdGEnIGluIGVycm9yID8gZXJyb3IuZGF0YSA6IGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuYWRkUmVsYXRpb25zaGlwID0gZnVuY3Rpb24gKHJlc291cmNlLCB0eXBlX2FsaWFzKSB7XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHt9IH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc291cmNlLmlkKSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc11bJ2RhdGEnXVtyZXNvdXJjZS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFJlc291cmNlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5SZXNvdXJjZSA9IFJlc291cmNlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuXG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcGFyYW1zLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuXG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLWNvbnZlcnRlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3BhcmFtcy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9lcnJvcnMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvbGlua3MuZC50c1wiLz5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1jb252ZXJ0ZXIudHNcIi8+XG4vLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY29yZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3Jlc291cmNlLnRzXCIvPlxuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb3JlU2VydmljZXMge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlIdHRwXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29yZVNlcnZpY2VzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBDb3JlU2VydmljZXMoSnNvbmFwaUh0dHApIHtcbiAgICAgICAgICAgIHRoaXMuSnNvbmFwaUh0dHAgPSBKc29uYXBpSHR0cDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gQ29yZVNlcnZpY2VzO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db3JlU2VydmljZXMgPSBDb3JlU2VydmljZXM7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZVNlcnZpY2VzJywgQ29yZVNlcnZpY2VzKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBKc29uYXBpUGFyc2VyIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KGpzb25fc3RyaW5nOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBqc29uX3N0cmluZztcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEpzb25hcGlQYXJzZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIEpzb25hcGlQYXJzZXIoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVBhcnNlci5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAoanNvbl9zdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBqc29uX3N0cmluZztcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlQYXJzZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkpzb25hcGlQYXJzZXIgPSBKc29uYXBpUGFyc2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlTdG9yYWdlIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIC8vIHByb3RlY3RlZCBzdG9yZSxcbiAgICAgICAgICAgIC8vIHByb3RlY3RlZCBSZWFsSnNvbmFwaVxuICAgICAgICApIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgbWVyZ2Uoa2V5LCBkYXRhKSB7XG4gICAgICAgICAgICAvKiBsZXQgYWN0dWFsX2RhdGEgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgbGV0IGFjdHVhbF9pbmZvID0gYW5ndWxhci5mcm9tSnNvbihhY3R1YWxfZGF0YSk7ICovXG5cblxuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVN0b3JhZ2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIEpzb25hcGlTdG9yYWdlKCkge1xuICAgICAgICB9XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAvKiBsZXQgZGF0YSA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5mcm9tSnNvbihkYXRhKTsqL1xuICAgICAgICB9O1xuICAgICAgICBKc29uYXBpU3RvcmFnZS5wcm90b3R5cGUubWVyZ2UgPSBmdW5jdGlvbiAoa2V5LCBkYXRhKSB7XG4gICAgICAgICAgICAvKiBsZXQgYWN0dWFsX2RhdGEgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgbGV0IGFjdHVhbF9pbmZvID0gYW5ndWxhci5mcm9tSnNvbihhY3R1YWxfZGF0YSk7ICovXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBKc29uYXBpU3RvcmFnZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVN0b3JhZ2UgPSBKc29uYXBpU3RvcmFnZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
