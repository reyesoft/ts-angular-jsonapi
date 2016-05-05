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
        Http.$inject = ["$http", "JsonapiConfig", "$q"];
        function Http($http, JsonapiConfig, $q) {
            this.$http = $http;
            this.JsonapiConfig = JsonapiConfig;
            this.$q = $q;
        }
        Http.prototype.get = function (path) {
            var promise = this.$http({
                method: 'GET',
                url: this.JsonapiConfig.url + path
            });
            var deferred = this.$q.defer();
            var xthis = this;
            promise.then(function (success) {
                deferred.resolve(success);
            }, function (error) {
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
    var ResourceMaker = (function () {
        function ResourceMaker() {
        }
        ResourceMaker.getService = function (type) {
            var resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('Jsonapi Resource type `' + type + '` is not definded.');
            }
            return resource_service;
        };
        ResourceMaker.make = function (data) {
            var resource_service = Jsonapi.ResourceMaker.getService(data.type);
            if (resource_service) {
                return Jsonapi.ResourceMaker.procreate(resource_service, data);
            }
        };
        ResourceMaker.procreate = function (resource_service, data) {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            var resource = new resource_service.constructor();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes;
            return resource;
        };
        return ResourceMaker;
    }());
    Jsonapi.ResourceMaker = ResourceMaker;
})(Jsonapi || (Jsonapi = {}));

var Jsonapi;
(function (Jsonapi) {
    var Core = (function () {
        /** @ngInject */
        Core.$inject = ["JsonapiConfig", "JsonapiCoreServices"];
        function Core(JsonapiConfig, JsonapiCoreServices) {
            this.JsonapiConfig = JsonapiConfig;
            this.JsonapiCoreServices = JsonapiCoreServices;
            this.rootPath = 'http://reyesoft.ddns.net:9999/api/v1/companies/2';
            this.resources = [];
            Jsonapi.Core.Me = this;
            Jsonapi.Core.Services = JsonapiCoreServices;
        }
        Core.prototype.register = function (clase) {
            this.resources[clase.type] = clase;
        };
        Core.prototype.getResource = function (type) {
            return this.resources[type];
        };
        // public static Me: Jsonapi.ICore = null;
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
        // register schema on Jsonapi.Core
        Resource.prototype.register = function () {
            Jsonapi.Core.Me.register(this);
        };
        // empty self object
        Resource.prototype.new = function () {
            var xthis = this;
            angular.forEach(this.schema.relationships, function (value, key) {
                xthis.relationships[key] = {};
                xthis.relationships[key]['data'] = {};
            });
        };
        Resource.prototype.get = function (id, params, fc_success, fc_error) {
            return this.exec(id, params, fc_success, fc_error);
        };
        Resource.prototype.all = function (params, fc_success, fc_error) {
            return this.exec(null, params, fc_success, fc_error);
        };
        Resource.prototype.exec = function (id, params, fc_success, fc_error) {
            // makes `params` optional
            var params_base = { include: null };
            if (angular.isFunction(params)) {
                fc_error = fc_success;
                fc_success = fc_success;
                params = params_base;
            }
            else {
                if (angular.isUndefined(params)) {
                    params = params_base;
                }
                else {
                    params = angular.extend({}, params_base, params);
                }
            }
            fc_success = angular.isFunction(fc_success) ? fc_success : function () { };
            fc_error = angular.isFunction(fc_error) ? fc_error : function () { };
            return (id === null ?
                this._all(params, fc_success, fc_error) :
                this._get(id, params, fc_success, fc_error));
        };
        Resource.prototype._get = function (id, params, fc_success, fc_error) {
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.path ? this.path : this.type);
            path.addPath(id);
            params.include ? path.setInclude(params.include) : null;
            //let resource = new Resource();
            var resource = this.clone();
            resource.new();
            var promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(function (success) {
                var value = success.data.data;
                resource.attributes = value.attributes;
                resource.id = value.id;
                // instancio los include y los guardo en included arrary
                var included = [];
                angular.forEach(success.data.included, function (data) {
                    var resource = Jsonapi.ResourceMaker.make(data);
                    if (resource) {
                        // guardamos en el array de includes
                        if (!(data.type in included)) {
                            included[data.type] = [];
                        }
                        included[data.type][data.id] = resource;
                    }
                });
                // recorro los relationships types
                angular.forEach(value.relationships, function (relation_value, relation_key) {
                    var resource_service = Jsonapi.ResourceMaker.getService(relation_key);
                    if (resource_service) {
                        // recorro los resources del relation type
                        var relationship_resources = [];
                        angular.forEach(relation_value.data, function (resource_value) {
                            // está en el included?
                            var tmp_resource;
                            if (resource_value.type in included && resource_value.id in included[resource_value.type]) {
                                tmp_resource = included[resource_value.type][resource_value.id];
                            }
                            else {
                                tmp_resource = Jsonapi.ResourceMaker.procreate(resource_service, resource_value);
                            }
                            resource.relationships[relation_key].data[tmp_resource.id] = tmp_resource;
                        });
                    }
                });
                fc_success(resource);
            }, function (error) {
                fc_error(error);
            });
            return resource;
        };
        Resource.prototype._all = function (params, fc_success, fc_error) {
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.path ? this.path : this.type);
            params.include ? path.setInclude(params.include) : null;
            // make request
            var response = [];
            var promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(function (success) {
                angular.forEach(success.data.data, function (value) {
                    var resource = new Resource();
                    resource.id = value.id;
                    resource.attributes = value.attributes;
                    response.push(resource);
                });
                fc_success(response);
            }, function (error) {
                fc_error(error);
            });
            return response;
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
/// <reference path="./services/resource-maker.ts"/>
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
            // private static instance: Services;
            // public static nato = 'pablo';
            this.cadena = 'pablo';
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLmpzIiwic2VydmljZXMvcGF0aC1tYWtlci50cyIsInNlcnZpY2VzL3BhdGgtbWFrZXIuanMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1tYWtlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLW1ha2VyLmpzIiwiY29yZS50cyIsImNvcmUuanMiLCJyZXNvdXJjZS50cyIsInJlc291cmNlLmpzIiwiX2FsbC50cyIsIl9hbGwuanMiLCJzZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXBhcnNlci5zZXJ2aWNlLnRzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS5qcyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLnRzIiwic2VydmljZXMvanNvbmFwaS1zdG9yYWdlLnNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFFQSxDQUFDLFVBQVUsU0FBTzs7SUFFZCxRQUFRLE9BQU8sa0JBQWtCO1NBQ2hDLFNBQVMsbUJBQW1CO1FBQ3pCLEtBQUs7O0lBR1QsUUFBUSxPQUFPLG9CQUFvQjtJQUVuQyxRQUFRLE9BQU8sYUFDZjtRQUNJO1FBQ0E7UUFDQTs7R0FHTDtBQ0pIO0FDZEEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7OztRQUdJLFNBQUEsS0FDYyxPQUNBLGVBQ0EsSUFBRTtZQUZGLEtBQUEsUUFBQTtZQUNBLEtBQUEsZ0JBQUE7WUFDQSxLQUFBLEtBQUE7O1FBS1AsS0FBQSxVQUFBLE1BQVAsVUFBVyxNQUFZO1lBQ25CLElBQUksVUFBVSxLQUFLLE1BQU07Z0JBQ3JCLFFBQVE7Z0JBQ1IsS0FBSyxLQUFLLGNBQWMsTUFB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OztRQU0xQixPQUFBOztJQXJCYSxRQUFBLGlCQUFjO0dBRHhCLFlBQUEsVUFBTztBQ2tCZCIsImZpbGUiOiJ0cy1hbmd1bGFyLWpzb25hcGkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9fYWxsLnRzXCIgLz5cblxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgLmNvbnN0YW50KCdyc0pzb25hcGlDb25maWcnLCB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly95b3VyZG9tYWluL2FwaS92MS8nXG4gICAgfSk7XG5cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycsIFtdKTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLFxuICAgIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xuXG59KShhbmd1bGFyKTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuKGZ1bmN0aW9uIChhbmd1bGFyKSB7XG4gICAgLy8gQ29uZmlnXG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuY29uZmlnJywgW10pXG4gICAgICAgIC5jb25zdGFudCgncnNKc29uYXBpQ29uZmlnJywge1xuICAgICAgICB1cmw6ICdodHRwOi8veW91cmRvbWFpbi9hcGkvdjEvJ1xuICAgIH0pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdyc0pzb25hcGknLCBbXG4gICAgICAgICdhbmd1bGFyLXN0b3JhZ2UnLFxuICAgICAgICAnSnNvbmFwaS5jb25maWcnLFxuICAgICAgICAnSnNvbmFwaS5zZXJ2aWNlcydcbiAgICBdKTtcbn0pKGFuZ3VsYXIpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBIdHRwIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCAkaHR0cCxcbiAgICAgICAgICAgIHByb3RlY3RlZCBKc29uYXBpQ29uZmlnLFxuICAgICAgICAgICAgcHJvdGVjdGVkICRxXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KHBhdGg6IHN0cmluZykge1xuICAgICAgICAgICAgbGV0IHByb21pc2UgPSB0aGlzLiRodHRwKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5Kc29uYXBpQ29uZmlnLnVybCArIHBhdGhcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsZXQgZGVmZXJyZWQgPSB0aGlzLiRxLmRlZmVyKCk7XG4gICAgICAgICAgICBsZXQgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBIdHRwID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBIdHRwKCRodHRwLCBKc29uYXBpQ29uZmlnLCAkcSkge1xuICAgICAgICAgICAgdGhpcy4kaHR0cCA9ICRodHRwO1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpQ29uZmlnID0gSnNvbmFwaUNvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJHEgPSAkcTtcbiAgICAgICAgfVxuICAgICAgICBIdHRwLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSB0aGlzLiRodHRwKHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgIHVybDogdGhpcy5Kc29uYXBpQ29uZmlnLnVybCArIHBhdGhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgdmFyIHh0aGlzID0gdGhpcztcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEh0dHA7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkh0dHAgPSBIdHRwO1xuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUh0dHAnLCBIdHRwKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBQYXRoTWFrZXIge1xuICAgICAgICBwdWJsaWMgcGF0aHM6IEFycmF5PFN0cmluZz4gPSBbXTtcbiAgICAgICAgcHVibGljIGluY2x1ZGVzOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgcHVibGljIGFkZFBhdGgodmFsdWU6IFN0cmluZykge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzZXRJbmNsdWRlKHN0cmluZ3NfYXJyYXk6IEFycmF5PFN0cmluZz4pIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldCgpOiBTdHJpbmcge1xuICAgICAgICAgICAgbGV0IGdldF9wYXJhbXM6IEFycmF5PFN0cmluZz4gPSBbXTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jbHVkZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGdldF9wYXJhbXMucHVzaCgnaW5jbHVkZT0nICsgdGhpcy5pbmNsdWRlcy5qb2luKCcsJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnLz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBQYXRoTWFrZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBQYXRoTWFrZXIoKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzID0gW107XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5hZGRQYXRoID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnBhdGhzLnB1c2godmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLnNldEluY2x1ZGUgPSBmdW5jdGlvbiAoc3RyaW5nc19hcnJheSkge1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IHN0cmluZ3NfYXJyYXk7XG4gICAgICAgIH07XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGdldF9wYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGhzLmpvaW4oJy8nKSArXG4gICAgICAgICAgICAgICAgKGdldF9wYXJhbXMubGVuZ3RoID4gMCA/ICcvPycgKyBnZXRfcGFyYW1zLmpvaW4oJyYnKSA6ICcnKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFBhdGhNYWtlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUGF0aE1ha2VyID0gUGF0aE1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFJlc291cmNlTWFrZXIge1xuXG4gICAgICAgIHN0YXRpYyBnZXRTZXJ2aWNlKHR5cGU6IHN0cmluZyk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5Db3JlLk1lLmdldFJlc291cmNlKHR5cGUpO1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocmVzb3VyY2Vfc2VydmljZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0pzb25hcGkgUmVzb3VyY2UgdHlwZSBgJyArIHR5cGUgKyAnYCBpcyBub3QgZGVmaW5kZWQuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2Vfc2VydmljZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRpYyBtYWtlKGRhdGE6IEpzb25hcGkuSURhdGFSZXNvdXJjZSk6IEpzb25hcGkuSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZV9zZXJ2aWNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLmdldFNlcnZpY2UoZGF0YS50eXBlKTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpzb25hcGkuUmVzb3VyY2VNYWtlci5wcm9jcmVhdGUocmVzb3VyY2Vfc2VydmljZSwgZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgcHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2U6IEpzb25hcGkuSVJlc291cmNlLCBkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gbmV3ICg8YW55PnJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IpKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIFJlc291cmNlTWFrZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZU1ha2VyKCkge1xuICAgICAgICB9XG4gICAgICAgIFJlc291cmNlTWFrZXIuZ2V0U2VydmljZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29yZS5NZS5nZXRSZXNvdXJjZSh0eXBlKTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHJlc291cmNlX3NlcnZpY2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpIFJlc291cmNlIHR5cGUgYCcgKyB0eXBlICsgJ2AgaXMgbm90IGRlZmluZGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlTWFrZXIubWFrZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5nZXRTZXJ2aWNlKGRhdGEudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLlJlc291cmNlTWFrZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZU1ha2VyLnByb2NyZWF0ZSA9IGZ1bmN0aW9uIChyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoISgndHlwZScgaW4gZGF0YSAmJiAnaWQnIGluIGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSnNvbmFwaSBSZXNvdXJjZSBpcyBub3QgY29ycmVjdCcsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gbmV3IHJlc291cmNlX3NlcnZpY2UuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSBkYXRhLmlkO1xuICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IGRhdGEuYXR0cmlidXRlcztcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIFJlc291cmNlTWFrZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlJlc291cmNlTWFrZXIgPSBSZXNvdXJjZU1ha2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmUgaW1wbGVtZW50cyBKc29uYXBpLklDb3JlIHtcbiAgICAgICAgcHVibGljIHJvb3RQYXRoOiBzdHJpbmcgPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgcHVibGljIHJlc291cmNlczogQXJyYXk8SnNvbmFwaS5JUmVzb3VyY2U+ID0gW107XG5cbiAgICAgICAgLy8gcHVibGljIHN0YXRpYyBNZTogSnNvbmFwaS5JQ29yZSA9IG51bGw7XG4gICAgICAgIHB1YmxpYyBzdGF0aWMgTWU6IEpzb25hcGkuSUNvcmUgPSBudWxsO1xuICAgICAgICBwdWJsaWMgc3RhdGljIFNlcnZpY2VzOiBhbnkgPSBudWxsO1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUNvcmVTZXJ2aWNlc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHJlZ2lzdGVyKGNsYXNlOiBKc29uYXBpLklSZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZXNvdXJjZSh0eXBlOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBmdW5jdGlvbiBDb3JlKEpzb25hcGlDb25maWcsIEpzb25hcGlDb3JlU2VydmljZXMpIHtcbiAgICAgICAgICAgIHRoaXMuSnNvbmFwaUNvbmZpZyA9IEpzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLkpzb25hcGlDb3JlU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICAgICAgdGhpcy5yb290UGF0aCA9ICdodHRwOi8vcmV5ZXNvZnQuZGRucy5uZXQ6OTk5OS9hcGkvdjEvY29tcGFuaWVzLzInO1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXMgPSBbXTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG4gICAgICAgIENvcmUucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKGNsYXNlKSB7XG4gICAgICAgICAgICB0aGlzLnJlc291cmNlc1tjbGFzZS50eXBlXSA9IGNsYXNlO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5nZXRSZXNvdXJjZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvdXJjZXNbdHlwZV07XG4gICAgICAgIH07XG4gICAgICAgIC8vIHB1YmxpYyBzdGF0aWMgTWU6IEpzb25hcGkuSUNvcmUgPSBudWxsO1xuICAgICAgICBDb3JlLk1lID0gbnVsbDtcbiAgICAgICAgQ29yZS5TZXJ2aWNlcyA9IG51bGw7XG4gICAgICAgIHJldHVybiBDb3JlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db3JlID0gQ29yZTtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlJywgQ29yZSk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgUmVzb3VyY2UgaW1wbGVtZW50cyBJUmVzb3VyY2Uge1xuICAgICAgICBwdWJsaWMgc2NoZW1hOiBJU2NoZW1hO1xuICAgICAgICBwdWJsaWMgcGF0aDogc3RyaW5nID0gbnVsbDsgICAvLyB3aXRob3V0IHNsYXNoZXNcblxuICAgICAgICBwdWJsaWMgdHlwZTogc3RyaW5nO1xuICAgICAgICBwdWJsaWMgaWQ6IHN0cmluZztcbiAgICAgICAgcHVibGljIGF0dHJpYnV0ZXM6IGFueSA7XG4gICAgICAgIHB1YmxpYyByZWxhdGlvbnNoaXBzOiBhbnkgPSBbXTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgcHVibGljIHJlZ2lzdGVyKCkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgc2VsZiBvYmplY3RcbiAgICAgICAgcHVibGljIG5ldygpIHtcbiAgICAgICAgICAgIGxldCB4dGhpcyA9IHRoaXM7XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICB4dGhpcy5yZWxhdGlvbnNoaXBzW2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICB4dGhpcy5yZWxhdGlvbnNoaXBzW2tleV1bJ2RhdGEnXSA9IHt9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGlkOiBTdHJpbmcsIHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgYWxsKHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBBcnJheTxJUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZXhlYyhpZDogU3RyaW5nLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogYW55IHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICBsZXQgcGFyYW1zX2Jhc2UgPSB7IGluY2x1ZGU6IG51bGwgfTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBwYXJhbXNfYmFzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBwYXJhbXNfYmFzZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgcGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmY19zdWNjZXNzID0gYW5ndWxhci5pc0Z1bmN0aW9uKGZjX3N1Y2Nlc3MpID8gZmNfc3VjY2VzcyA6IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7fTtcblxuICAgICAgICAgICAgcmV0dXJuIChpZCA9PT0gbnVsbCA/XG4gICAgICAgICAgICAgICAgdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIDpcbiAgICAgICAgICAgICAgICB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9nZXQoaWQ6IFN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvL2xldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG5cbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICAgICAgICAgIGxldCBpbmNsdWRlZCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goc3VjY2Vzcy5kYXRhLmluY2x1ZGVkLCAoZGF0YTogSnNvbmFwaS5JRGF0YVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBKc29uYXBpLlJlc291cmNlTWFrZXIubWFrZShkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGd1YXJkYW1vcyBlbiBlbCBhcnJheSBkZSBpbmNsdWRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghKGRhdGEudHlwZSBpbiBpbmNsdWRlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRbZGF0YS50eXBlXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZFtkYXRhLnR5cGVdW2RhdGEuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgdHlwZXNcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHZhbHVlLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX2tleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlc291cmNlcyBkZWwgcmVsYXRpb24gdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWxhdGlvbnNoaXBfcmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIChyZXNvdXJjZV92YWx1ZTogSnNvbmFwaS5JRGF0YVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzdMOhIGVuIGVsIGluY2x1ZGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wX3Jlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2VfdmFsdWUudHlwZSBpbiBpbmNsdWRlZCAmJiByZXNvdXJjZV92YWx1ZS5pZCBpbiBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV1bcmVzb3VyY2VfdmFsdWUuaWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCByZXNvdXJjZV92YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmRhdGFbdG1wX3Jlc291cmNlLmlkXSA9IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTogQXJyYXk8SVJlc291cmNlPiB7XG5cbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGUpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcblxuICAgICAgICAgICAgLy8gbWFrZSByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcmVzcG9uc2UgPSBbXTtcbiAgICAgICAgICAgIGxldCBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmdldChwYXRoLmdldCgpKTtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHN1Y2Nlc3MuZGF0YS5kYXRhLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSB2YWx1ZS5hdHRyaWJ1dGVzO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLnB1c2gocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG51bGw7IC8vIHdpdGhvdXQgc2xhc2hlc1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNsb25lT2JqID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgICAgIGZvciAodmFyIGF0dHJpYnV0IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbYXR0cmlidXRdICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBjbG9uZU9ialthdHRyaWJ1dF0gPSB0aGlzW2F0dHJpYnV0XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY2xvbmVPYmo7XG4gICAgICAgIH07XG4gICAgICAgIC8vIHJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICAvLyBlbXB0eSBzZWxmIG9iamVjdFxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUubmV3ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHh0aGlzID0gdGhpcztcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmV4ZWMgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIG1ha2VzIGBwYXJhbXNgIG9wdGlvbmFsXG4gICAgICAgICAgICB2YXIgcGFyYW1zX2Jhc2UgPSB7IGluY2x1ZGU6IG51bGwgfTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBwYXJhbXNfYmFzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gcGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgcGFyYW1zX2Jhc2UsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmNfc3VjY2VzcyA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19zdWNjZXNzKSA/IGZjX3N1Y2Nlc3MgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIHJldHVybiAoaWQgPT09IG51bGwgP1xuICAgICAgICAgICAgICAgIHRoaXMuX2FsbChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSA6XG4gICAgICAgICAgICAgICAgdGhpcy5fZ2V0KGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSk7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fZ2V0ID0gZnVuY3Rpb24gKGlkLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5wYXRoID8gdGhpcy5wYXRoIDogdGhpcy50eXBlKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aChpZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuICAgICAgICAgICAgLy9sZXQgcmVzb3VyY2UgPSBuZXcgUmVzb3VyY2UoKTtcbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChzdWNjZXNzLmRhdGEuaW5jbHVkZWQsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5tYWtlKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGd1YXJkYW1vcyBlbiBlbCBhcnJheSBkZSBpbmNsdWRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoZGF0YS50eXBlIGluIGluY2x1ZGVkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV1bZGF0YS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgdHlwZXNcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godmFsdWUucmVsYXRpb25zaGlwcywgZnVuY3Rpb24gKHJlbGF0aW9uX3ZhbHVlLCByZWxhdGlvbl9rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLlJlc291cmNlTWFrZXIuZ2V0U2VydmljZShyZWxhdGlvbl9rZXkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVjb3JybyBsb3MgcmVzb3VyY2VzIGRlbCByZWxhdGlvbiB0eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwX3Jlc291cmNlcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIGZ1bmN0aW9uIChyZXNvdXJjZV92YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzdMOhIGVuIGVsIGluY2x1ZGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0bXBfcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlX3ZhbHVlLnR5cGUgaW4gaW5jbHVkZWQgJiYgcmVzb3VyY2VfdmFsdWUuaWQgaW4gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV1bcmVzb3VyY2VfdmFsdWUuaWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCByZXNvdXJjZV92YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XS5kYXRhW3RtcF9yZXNvdXJjZS5pZF0gPSB0bXBfcmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MocmVzb3VyY2UpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5fYWxsID0gZnVuY3Rpb24gKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGUpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gW107XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5nZXQocGF0aC5nZXQoKSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goc3VjY2Vzcy5kYXRhLmRhdGEsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBuZXcgUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLnB1c2gocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MocmVzcG9uc2UpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBSZXNvdXJjZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUmVzb3VyY2UgPSBSZXNvdXJjZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cblxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2Vycm9ycy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9saW5rcy5kLnRzXCIvPlxuXG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cblxuLy8gVFMtSnNvbmFwaSBjbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9hcHAubW9kdWxlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcGF0aC1tYWtlci50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3Jlc291cmNlLW1ha2VyLnRzXCIvPlxuLy8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2NvcmUtc2VydmljZXMuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NvcmUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9yZXNvdXJjZS50c1wiLz5cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL21haW4uZC50c1wiIC8+XG4vLyBKc29uYXBpIGludGVyZmFjZXMgcGFydCBvZiB0b3AgbGV2ZWxcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZG9jdW1lbnQuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZGF0YS1jb2xsZWN0aW9uLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtb2JqZWN0LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtcmVzb3VyY2UuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvZXJyb3JzLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2xpbmtzLmQudHNcIi8+XG4vLyBQYXJhbWV0ZXJzIGZvciBUUy1Kc29uYXBpIENsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvc2NoZW1hLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG4vLyBUUy1Kc29uYXBpIGNsYXNzZXNcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2FwcC5tb2R1bGUudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9odHRwLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9wYXRoLW1ha2VyLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvcmVzb3VyY2UtbWFrZXIudHNcIi8+XG4vLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vc2VydmljZXMvY29yZS1zZXJ2aWNlcy5zZXJ2aWNlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY29yZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3Jlc291cmNlLnRzXCIvPlxuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb3JlU2VydmljZXMge1xuICAgICAgICAvLyBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogU2VydmljZXM7XG4gICAgICAgIC8vIHB1YmxpYyBzdGF0aWMgbmF0byA9ICdwYWJsbyc7XG4gICAgICAgIHB1YmxpYyBjYWRlbmEgPSAncGFibG8nO1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkIEpzb25hcGlIdHRwXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKiBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHAsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaVBhcnNlcixcbiAgICAgICAgICAgIHByb3RlY3RlZCBzdG9yZVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NlcnZpY2VzIERPTkUhISEhISEhISEgWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYJyk7XG4gICAgICAgIH0gKi9cblxuICAgICAgICAvKiBwdWJsaWMgZ2V0SW5zdGFuY2UoKSB7XG4gICAgICAgICAgICBpZiAoIVNlcnZpY2VzLmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgU2VydmljZXMuaW5zdGFuY2UgPSBuZXcgU2VydmljZXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBTZXJ2aWNlcy5pbnN0YW5jZTtcbiAgICAgICAgfSAqL1xuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG4gICAgLy9hbmd1bGFyLm1vZHVsZSgnSnNvbmFwaScpXG4gICAgLy8gICAgLnNlcnZpY2UoJ0pzb25hcGkuU2VydmljZXMnLCBTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICAgICAgLy8gcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IFNlcnZpY2VzO1xuICAgICAgICAgICAgLy8gcHVibGljIHN0YXRpYyBuYXRvID0gJ3BhYmxvJztcbiAgICAgICAgICAgIHRoaXMuY2FkZW5hID0gJ3BhYmxvJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gQ29yZVNlcnZpY2VzO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Db3JlU2VydmljZXMgPSBDb3JlU2VydmljZXM7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZVNlcnZpY2VzJywgQ29yZVNlcnZpY2VzKTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBKc29uYXBpUGFyc2VyIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIHRvT2JqZWN0KGpzb25fc3RyaW5nOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBqc29uX3N0cmluZztcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsInZhciBKc29uYXBpO1xuKGZ1bmN0aW9uIChKc29uYXBpKSB7XG4gICAgdmFyIEpzb25hcGlQYXJzZXIgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIEpzb25hcGlQYXJzZXIoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVBhcnNlci5wcm90b3R5cGUudG9PYmplY3QgPSBmdW5jdGlvbiAoanNvbl9zdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBqc29uX3N0cmluZztcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlQYXJzZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkpzb25hcGlQYXJzZXIgPSBKc29uYXBpUGFyc2VyO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlTdG9yYWdlIHtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIC8vIHByb3RlY3RlZCBzdG9yZSxcbiAgICAgICAgICAgIC8vIHByb3RlY3RlZCBSZWFsSnNvbmFwaVxuICAgICAgICApIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgbWVyZ2Uoa2V5LCBkYXRhKSB7XG4gICAgICAgICAgICAvKiBsZXQgYWN0dWFsX2RhdGEgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgbGV0IGFjdHVhbF9pbmZvID0gYW5ndWxhci5mcm9tSnNvbihhY3R1YWxfZGF0YSk7ICovXG5cblxuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVN0b3JhZ2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIEpzb25hcGlTdG9yYWdlKCkge1xuICAgICAgICB9XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAvKiBsZXQgZGF0YSA9IHRoaXMuc3RvcmUuZ2V0KGtleSk7XG4gICAgICAgICAgICByZXR1cm4gYW5ndWxhci5mcm9tSnNvbihkYXRhKTsqL1xuICAgICAgICB9O1xuICAgICAgICBKc29uYXBpU3RvcmFnZS5wcm90b3R5cGUubWVyZ2UgPSBmdW5jdGlvbiAoa2V5LCBkYXRhKSB7XG4gICAgICAgICAgICAvKiBsZXQgYWN0dWFsX2RhdGEgPSB0aGlzLmdldChrZXkpO1xuICAgICAgICAgICAgbGV0IGFjdHVhbF9pbmZvID0gYW5ndWxhci5mcm9tSnNvbihhY3R1YWxfZGF0YSk7ICovXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBKc29uYXBpU3RvcmFnZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVN0b3JhZ2UgPSBKc29uYXBpU3RvcmFnZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
