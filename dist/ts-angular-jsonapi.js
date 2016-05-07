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
            this.resources[clase.type] = clase;
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
        // register schema on Jsonapi.Core
        Resource.prototype.register = function () {
            Jsonapi.Core.Me._register(this);
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
            return this.exec(id, params, fc_success, fc_error, 'get');
        };
        Resource.prototype.all = function (params, fc_success, fc_error) {
            return this.exec(null, params, fc_success, fc_error, 'all');
        };
        Resource.prototype.save = function (params, fc_success, fc_error) {
            return this.exec(null, params, fc_success, fc_error, 'save');
        };
        Resource.prototype.exec = function (id, params, fc_success, fc_error, exec_type) {
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
            return false;
        };
        Resource.prototype._save = function (params, fc_success, fc_error) {
            var object = this.toObject(params);
            // http request
            var path = new Jsonapi.PathMaker();
            path.addPath(this.getPath());
            this.id && path.addPath(this.id);
            params.include ? path.setInclude(params.include) : null;
            //let resource = new Resource();
            var resource = this.new();
            var promise = Jsonapi.Core.Services.JsonapiHttp.exec(path.get(), this.id ? 'PATCH' : 'POST', object);
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
                fc_error(success);
            }, function (error) {
                fc_error(error);
            });
            return resource;
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
                // recorro los relationships levanto el service correspondiente
                angular.forEach(value.relationships, function (relation_value, relation_key) {
                    // relation is in schema?
                    if (!(relation_key in resource.relationships)) {
                        console.warn(resource.type + '.relationships.' + relation_key + ' received, but is not defined on schema');
                        resource.relationships[relation_key] = { data: [] };
                    }
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
            var response = [];
            var promise = Jsonapi.Core.Services.JsonapiHttp.get(path.get());
            promise.then(function (success) {
                angular.forEach(success.data.data, function (value) {
                    var resource = new Resource();
                    resource.id = value.id;
                    resource.attributes = value.attributes;
                    response.push(resource);
                });
                fc_success(success);
            }, function (error) {
                fc_error(error);
            });
            return response;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5tb2R1bGUudHMiLCJhcHAubW9kdWxlLmpzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLnRzIiwic2VydmljZXMvaHR0cC5zZXJ2aWNlLmpzIiwic2VydmljZXMvcGF0aC1tYWtlci50cyIsInNlcnZpY2VzL3BhdGgtbWFrZXIuanMiLCJzZXJ2aWNlcy9yZXNvdXJjZS1tYWtlci50cyIsInNlcnZpY2VzL3Jlc291cmNlLW1ha2VyLmpzIiwiY29yZS50cyIsImNvcmUuanMiLCJyZXNvdXJjZS50cyIsInJlc291cmNlLmpzIiwiX2FsbC50cyIsIl9hbGwuanMiLCJzZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHMiLCJzZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UuanMiLCJzZXJ2aWNlcy9qc29uYXBpLXBhcnNlci5zZXJ2aWNlLnRzIiwic2VydmljZXMvanNvbmFwaS1wYXJzZXIuc2VydmljZS5qcyIsInNlcnZpY2VzL2pzb25hcGktc3RvcmFnZS5zZXJ2aWNlLnRzIiwic2VydmljZXMvanNvbmFwaS1zdG9yYWdlLnNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFFQSxDQUFDLFVBQVUsU0FBTzs7SUFFZCxRQUFRLE9BQU8sa0JBQWtCO1NBQ2hDLFNBQVMsbUJBQW1CO1FBQ3pCLEtBQUs7O0lBR1QsUUFBUSxPQUFPLG9CQUFvQjtJQUVuQyxRQUFRLE9BQU8sYUFDZjtRQUNJO1FBQ0E7UUFDQTs7R0FHTDtBQ0pIO0FDZEEsSUFBTztBQUFQLENBQUEsVUFBTyxTQUFRO0lBQ1gsSUFBQSxRQUFBLFlBQUE7OztRQUdJLFNBQUEsS0FDYyxPQUNBLGlCQUNBLElBQUU7WUFGRixLQUFBLFFBQUE7WUFDQSxLQUFBLGtCQUFBO1lBQ0EsS0FBQSxLQUFBOztRQUtQLEtBQUEsVUFBQSxTQUFQLFVBQWMsTUFBWTs7UUFJbkIsS0FBQSxVQUFBLE1BQVAsVUFBVyxNQUFZO1lBQ25CLE9BQU8sS0FBSyxLQUFLLE1BQU07O1FB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QSxVQUFPLFNBQVE7SUFDWCxJQUFBLGlCQUFBLFlBQUE7O1FBR0ksU0FBQSxnQkFBQTs7UUFJTyxjQUFBLFVBQUEsV0FBUCxVQUFnQixhQUFtQjtZQUMvQixPQUFPOztRQUVmLE9BQUE7O0lBVmEsUUFBQSxnQkFBYTtHQUR2QixZQUFBLFVBQU87QUNhZDtBQ2JBLElBQU87QUFBUCxDQUFBLFVBQU8sU0FBUTtJQUNYLElBQUEsa0JBQUEsWUFBQTs7UUFHSSxTQUFBLGlCQUFBOztRQU9PLGVBQUEsVUFBQSxNQUFQLFVBQVcsS0FBRzs7OztRQUtQLGVBQUEsVUFBQSxRQUFQLFVBQWEsS0FBSyxNQUFJOzs7O1FBTTFCLE9BQUE7O0lBckJhLFFBQUEsaUJBQWM7R0FEeEIsWUFBQSxVQUFPO0FDa0JkIiwiZmlsZSI6InRzLWFuZ3VsYXItanNvbmFwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL19hbGwudHNcIiAvPlxuXG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAuY29uc3RhbnQoJ3JzSnNvbmFwaUNvbmZpZycsIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3lvdXJkb21haW4vYXBpL3YxLydcbiAgICB9KTtcblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJywgW10pO1xuXG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsXG4gICAgW1xuICAgICAgICAnYW5ndWxhci1zdG9yYWdlJyxcbiAgICAgICAgJ0pzb25hcGkuY29uZmlnJyxcbiAgICAgICAgJ0pzb25hcGkuc2VydmljZXMnXG4gICAgXSk7XG5cbn0pKGFuZ3VsYXIpO1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vX2FsbC50c1wiIC8+XG4oZnVuY3Rpb24gKGFuZ3VsYXIpIHtcbiAgICAvLyBDb25maWdcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5jb25maWcnLCBbXSlcbiAgICAgICAgLmNvbnN0YW50KCdyc0pzb25hcGlDb25maWcnLCB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly95b3VyZG9tYWluL2FwaS92MS8nXG4gICAgfSk7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnLCBbXSk7XG4gICAgYW5ndWxhci5tb2R1bGUoJ3JzSnNvbmFwaScsIFtcbiAgICAgICAgJ2FuZ3VsYXItc3RvcmFnZScsXG4gICAgICAgICdKc29uYXBpLmNvbmZpZycsXG4gICAgICAgICdKc29uYXBpLnNlcnZpY2VzJ1xuICAgIF0pO1xufSkoYW5ndWxhcik7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEh0dHAge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgcHJvdGVjdGVkICRodHRwLFxuICAgICAgICAgICAgcHJvdGVjdGVkIHJzSnNvbmFwaUNvbmZpZyxcbiAgICAgICAgICAgIHByb3RlY3RlZCAkcVxuICAgICAgICApIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGRlbGV0ZShwYXRoOiBzdHJpbmcpIHtcblxuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGdldChwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0dFVCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvdGVjdGVkIGV4ZWMocGF0aDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZywgZGF0YT86IEpzb25hcGkuSURhdGFPYmplY3QpIHtcbiAgICAgICAgICAgIGxldCByZXEgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB0aGlzLnJzSnNvbmFwaUNvbmZpZy51cmwgKyBwYXRoLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi92bmQuYXBpK2pzb24nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGRhdGEgJiYgKHJlcVsnZGF0YSddID0gZGF0YSk7XG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IHRoaXMuJGh0dHAocmVxKTtcblxuICAgICAgICAgICAgbGV0IGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgbGV0IHh0aGlzID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoLTEpO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpSHR0cCcsIEh0dHApO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSHR0cCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSHR0cCgkaHR0cCwgcnNKc29uYXBpQ29uZmlnLCAkcSkge1xuICAgICAgICAgICAgdGhpcy4kaHR0cCA9ICRodHRwO1xuICAgICAgICAgICAgdGhpcy5yc0pzb25hcGlDb25maWcgPSByc0pzb25hcGlDb25maWc7XG4gICAgICAgICAgICB0aGlzLiRxID0gJHE7XG4gICAgICAgIH1cbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgfTtcbiAgICAgICAgSHR0cC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMocGF0aCwgJ0dFVCcpO1xuICAgICAgICB9O1xuICAgICAgICBIdHRwLnByb3RvdHlwZS5leGVjID0gZnVuY3Rpb24gKHBhdGgsIG1ldGhvZCwgZGF0YSkge1xuICAgICAgICAgICAgdmFyIHJlcSA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICB1cmw6IHRoaXMucnNKc29uYXBpQ29uZmlnLnVybCArIHBhdGgsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5hcGkranNvbidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZGF0YSAmJiAocmVxWydkYXRhJ10gPSBkYXRhKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gdGhpcy4kaHR0cChyZXEpO1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gdGhpcy4kcS5kZWZlcigpO1xuICAgICAgICAgICAgdmFyIHh0aGlzID0gdGhpcztcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZS5yZWZyZXNoTG9hZGluZ3MoMSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUucmVmcmVzaExvYWRpbmdzKC0xKTtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLnJlZnJlc2hMb2FkaW5ncygtMSk7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBIdHRwO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5IdHRwID0gSHR0cDtcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlIdHRwJywgSHR0cCk7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgUGF0aE1ha2VyIHtcbiAgICAgICAgcHVibGljIHBhdGhzOiBBcnJheTxTdHJpbmc+ID0gW107XG4gICAgICAgIHB1YmxpYyBpbmNsdWRlczogQXJyYXk8U3RyaW5nPiA9IFtdO1xuXG4gICAgICAgIHB1YmxpYyBhZGRQYXRoKHZhbHVlOiBTdHJpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aHMucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgc2V0SW5jbHVkZShzdHJpbmdzX2FycmF5OiBBcnJheTxTdHJpbmc+KSB7XG4gICAgICAgICAgICB0aGlzLmluY2x1ZGVzID0gc3RyaW5nc19hcnJheTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXQoKTogU3RyaW5nIHtcbiAgICAgICAgICAgIGxldCBnZXRfcGFyYW1zOiBBcnJheTxTdHJpbmc+ID0gW107XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBnZXRfcGFyYW1zLnB1c2goJ2luY2x1ZGU9JyArIHRoaXMuaW5jbHVkZXMuam9pbignLCcpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aHMuam9pbignLycpICtcbiAgICAgICAgICAgICAgICAoZ2V0X3BhcmFtcy5sZW5ndGggPiAwID8gJy8/JyArIGdldF9wYXJhbXMuam9pbignJicpIDogJycpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUGF0aE1ha2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUGF0aE1ha2VyKCkge1xuICAgICAgICAgICAgdGhpcy5wYXRocyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5pbmNsdWRlcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIFBhdGhNYWtlci5wcm90b3R5cGUuYWRkUGF0aCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5wYXRocy5wdXNoKHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgUGF0aE1ha2VyLnByb3RvdHlwZS5zZXRJbmNsdWRlID0gZnVuY3Rpb24gKHN0cmluZ3NfYXJyYXkpIHtcbiAgICAgICAgICAgIHRoaXMuaW5jbHVkZXMgPSBzdHJpbmdzX2FycmF5O1xuICAgICAgICB9O1xuICAgICAgICBQYXRoTWFrZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBnZXRfcGFyYW1zID0gW107XG4gICAgICAgICAgICBpZiAodGhpcy5pbmNsdWRlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2V0X3BhcmFtcy5wdXNoKCdpbmNsdWRlPScgKyB0aGlzLmluY2x1ZGVzLmpvaW4oJywnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRocy5qb2luKCcvJykgK1xuICAgICAgICAgICAgICAgIChnZXRfcGFyYW1zLmxlbmd0aCA+IDAgPyAnLz8nICsgZ2V0X3BhcmFtcy5qb2luKCcmJykgOiAnJyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBQYXRoTWFrZXI7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLlBhdGhNYWtlciA9IFBhdGhNYWtlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBSZXNvdXJjZU1ha2VyIHtcblxuICAgICAgICBzdGF0aWMgZ2V0U2VydmljZSh0eXBlOiBzdHJpbmcpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuQ29yZS5NZS5nZXRSZXNvdXJjZSh0eXBlKTtcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHJlc291cmNlX3NlcnZpY2UpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdKc29uYXBpIFJlc291cmNlIHR5cGUgYCcgKyB0eXBlICsgJ2AgaXMgbm90IGRlZmluZGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlX3NlcnZpY2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0aWMgbWFrZShkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpOiBKc29uYXBpLklSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5nZXRTZXJ2aWNlKGRhdGEudHlwZSk7XG4gICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKc29uYXBpLlJlc291cmNlTWFrZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGljIHByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlOiBKc29uYXBpLklSZXNvdXJjZSwgZGF0YTogSnNvbmFwaS5JRGF0YVJlc291cmNlKTogSnNvbmFwaS5JUmVzb3VyY2Uge1xuICAgICAgICAgICAgaWYgKCEoJ3R5cGUnIGluIGRhdGEgJiYgJ2lkJyBpbiBkYXRhKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0pzb25hcGkgUmVzb3VyY2UgaXMgbm90IGNvcnJlY3QnLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IG5ldyAoPGFueT5yZXNvdXJjZV9zZXJ2aWNlLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgcmVzb3VyY2UubmV3KCk7XG4gICAgICAgICAgICByZXNvdXJjZS5pZCA9IGRhdGEuaWQ7XG4gICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gZGF0YS5hdHRyaWJ1dGVzO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBSZXNvdXJjZU1ha2VyID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gUmVzb3VyY2VNYWtlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBSZXNvdXJjZU1ha2VyLmdldFNlcnZpY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLkNvcmUuTWUuZ2V0UmVzb3VyY2UodHlwZSk7XG4gICAgICAgICAgICBpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChyZXNvdXJjZV9zZXJ2aWNlKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignSnNvbmFwaSBSZXNvdXJjZSB0eXBlIGAnICsgdHlwZSArICdgIGlzIG5vdCBkZWZpbmRlZC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZV9zZXJ2aWNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZU1ha2VyLm1ha2UgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgdmFyIHJlc291cmNlX3NlcnZpY2UgPSBKc29uYXBpLlJlc291cmNlTWFrZXIuZ2V0U2VydmljZShkYXRhLnR5cGUpO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlX3NlcnZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2VNYWtlci5wcm9jcmVhdGUgPSBmdW5jdGlvbiAocmVzb3VyY2Vfc2VydmljZSwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKCEoJ3R5cGUnIGluIGRhdGEgJiYgJ2lkJyBpbiBkYXRhKSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0pzb25hcGkgUmVzb3VyY2UgaXMgbm90IGNvcnJlY3QnLCBkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IG5ldyByZXNvdXJjZV9zZXJ2aWNlLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5uZXcoKTtcbiAgICAgICAgICAgIHJlc291cmNlLmlkID0gZGF0YS5pZDtcbiAgICAgICAgICAgIHJlc291cmNlLmF0dHJpYnV0ZXMgPSBkYXRhLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBSZXNvdXJjZU1ha2VyO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5SZXNvdXJjZU1ha2VyID0gUmVzb3VyY2VNYWtlcjtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwibW9kdWxlIEpzb25hcGkge1xuICAgIGV4cG9ydCBjbGFzcyBDb3JlIGltcGxlbWVudHMgSnNvbmFwaS5JQ29yZSB7XG4gICAgICAgIHB1YmxpYyByb290UGF0aDogc3RyaW5nID0gJ2h0dHA6Ly9yZXllc29mdC5kZG5zLm5ldDo5OTk5L2FwaS92MS9jb21wYW5pZXMvMic7XG4gICAgICAgIHB1YmxpYyByZXNvdXJjZXM6IEFycmF5PEpzb25hcGkuSVJlc291cmNlPiA9IFtdO1xuXG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0NvdW50ZXI6IG51bWJlciA9IDA7XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc1N0YXJ0ID0gKCkgPT4ge307XG4gICAgICAgIHB1YmxpYyBsb2FkaW5nc0RvbmUgPSAoKSA9PiB7fTtcblxuICAgICAgICBwdWJsaWMgc3RhdGljIE1lOiBKc29uYXBpLklDb3JlID0gbnVsbDtcbiAgICAgICAgcHVibGljIHN0YXRpYyBTZXJ2aWNlczogYW55ID0gbnVsbDtcblxuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgICAgIHByb3RlY3RlZCByc0pzb25hcGlDb25maWcsXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUNvcmVTZXJ2aWNlc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9yZWdpc3RlcihjbGFzZSkge1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRSZXNvdXJjZSh0eXBlOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlc291cmNlc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyByZWZyZXNoTG9hZGluZ3MoZmFjdG9yOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ3NDb3VudGVyICs9IGZhY3RvcjtcbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRpbmdzQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZGluZ3NEb25lKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubG9hZGluZ3NDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkaW5nc1N0YXJ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgQ29yZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gQ29yZShyc0pzb25hcGlDb25maWcsIEpzb25hcGlDb3JlU2VydmljZXMpIHtcbiAgICAgICAgICAgIHRoaXMucnNKc29uYXBpQ29uZmlnID0gcnNKc29uYXBpQ29uZmlnO1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpQ29yZVNlcnZpY2VzID0gSnNvbmFwaUNvcmVTZXJ2aWNlcztcbiAgICAgICAgICAgIHRoaXMucm9vdFBhdGggPSAnaHR0cDovL3JleWVzb2Z0LmRkbnMubmV0Ojk5OTkvYXBpL3YxL2NvbXBhbmllcy8yJztcbiAgICAgICAgICAgIHRoaXMucmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciA9IDA7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQgPSBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSA9IGZ1bmN0aW9uICgpIHsgfTtcbiAgICAgICAgICAgIEpzb25hcGkuQ29yZS5NZSA9IHRoaXM7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuU2VydmljZXMgPSBKc29uYXBpQ29yZVNlcnZpY2VzO1xuICAgICAgICB9XG4gICAgICAgIENvcmUucHJvdG90eXBlLl9yZWdpc3RlciA9IGZ1bmN0aW9uIChjbGFzZSkge1xuICAgICAgICAgICAgdGhpcy5yZXNvdXJjZXNbY2xhc2UudHlwZV0gPSBjbGFzZTtcbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5wcm90b3R5cGUuZ2V0UmVzb3VyY2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb3VyY2VzW3R5cGVdO1xuICAgICAgICB9O1xuICAgICAgICBDb3JlLnByb3RvdHlwZS5yZWZyZXNoTG9hZGluZ3MgPSBmdW5jdGlvbiAoZmFjdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdzQ291bnRlciArPSBmYWN0b3I7XG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzRG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5sb2FkaW5nc0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRpbmdzU3RhcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgQ29yZS5NZSA9IG51bGw7XG4gICAgICAgIENvcmUuU2VydmljZXMgPSBudWxsO1xuICAgICAgICByZXR1cm4gQ29yZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuQ29yZSA9IENvcmU7XG4gICAgYW5ndWxhci5tb2R1bGUoJ0pzb25hcGkuc2VydmljZXMnKS5zZXJ2aWNlKCdKc29uYXBpQ29yZScsIENvcmUpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIFJlc291cmNlIGltcGxlbWVudHMgSVJlc291cmNlIHtcbiAgICAgICAgcHVibGljIHNjaGVtYTogSVNjaGVtYTtcbiAgICAgICAgcHJvdGVjdGVkIHBhdGg6IHN0cmluZyA9IG51bGw7ICAgLy8gd2l0aG91dCBzbGFzaGVzXG5cbiAgICAgICAgcHVibGljIHR5cGU6IHN0cmluZztcbiAgICAgICAgcHVibGljIGlkOiBzdHJpbmc7XG4gICAgICAgIHB1YmxpYyBhdHRyaWJ1dGVzOiBhbnkgO1xuICAgICAgICBwdWJsaWMgcmVsYXRpb25zaGlwczogYW55ID0gW107XG5cbiAgICAgICAgcHJpdmF0ZSBwYXJhbXNfYmFzZTogSnNvbmFwaS5JUGFyYW1zID0ge1xuICAgICAgICAgICAgaWQ6ICcnLFxuICAgICAgICAgICAgaW5jbHVkZTogW11cbiAgICAgICAgfTtcblxuICAgICAgICBwdWJsaWMgY2xvbmUoKTogYW55IHtcbiAgICAgICAgICAgIHZhciBjbG9uZU9iaiA9IG5ldyAoPGFueT50aGlzLmNvbnN0cnVjdG9yKSgpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlZ2lzdGVyIHNjaGVtYSBvbiBKc29uYXBpLkNvcmVcbiAgICAgICAgcHVibGljIHJlZ2lzdGVyKCkge1xuICAgICAgICAgICAgSnNvbmFwaS5Db3JlLk1lLl9yZWdpc3Rlcih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBnZXRQYXRoKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aCA/IHRoaXMucGF0aCA6IHRoaXMudHlwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIHB1YmxpYyBuZXcoKTogSVJlc291cmNlIHtcbiAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IHRoaXMuY2xvbmUoKTtcbiAgICAgICAgICAgIHJlc291cmNlLnJlc2V0KCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgICAgICAgICBsZXQgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyB0b09iamVjdChwYXJhbXM6IEpzb25hcGkuSVBhcmFtcyk6IEpzb25hcGkuSURhdGFPYmplY3Qge1xuICAgICAgICAgICAgbGV0IHJlbGF0aW9uc2hpcHMgPSB7IH07XG4gICAgICAgICAgICBhbmd1bGFyLmZvckVhY2godGhpcy5yZWxhdGlvbnNoaXBzLCAocmVsYXRpb25zaGlwLCByZWxhdGlvbl9hbGlhcykgPT4ge1xuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChyZWxhdGlvbnNoaXAuZGF0YSwgKHJlc291cmNlOiBKc29uYXBpLklSZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVhdGlvbmFsX29iamVjdCA9IHsgaWQ6IHJlc291cmNlLmlkLCB0cGU6IHJlc291cmNlLnR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc11bJ2RhdGEnXS5wdXNoKHJlYXRpb25hbF9vYmplY3QpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiB0aGlzLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHM6IHJlbGF0aW9uc2hpcHNcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGluY2x1ZGU6IHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvL3JldHVybiBvYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGlkOiBTdHJpbmcsIHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBJUmVzb3VyY2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ2dldCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIGFsbChwYXJhbXM/LCBmY19zdWNjZXNzPywgZmNfZXJyb3I/KTogQXJyYXk8SVJlc291cmNlPiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBzYXZlKHBhcmFtcz8sIGZjX3N1Y2Nlc3M/LCBmY19lcnJvcj8pOiBBcnJheTxJUmVzb3VyY2U+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMobnVsbCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgJ3NhdmUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBleGVjKGlkOiBTdHJpbmcsIHBhcmFtczogSnNvbmFwaS5JUGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgZXhlY190eXBlOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICAgICAgLy8gbWFrZXMgYHBhcmFtc2Agb3B0aW9uYWxcbiAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzRnVuY3Rpb24ocGFyYW1zKSkge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yID0gZmNfc3VjY2VzcztcbiAgICAgICAgICAgICAgICBmY19zdWNjZXNzID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zX2Jhc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhbmd1bGFyLmV4dGVuZCh7fSwgdGhpcy5wYXJhbXNfYmFzZSwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfc3VjY2VzcykgPyBmY19zdWNjZXNzIDogZnVuY3Rpb24gKCkge307XG4gICAgICAgICAgICBmY19lcnJvciA9IGFuZ3VsYXIuaXNGdW5jdGlvbihmY19lcnJvcikgPyBmY19lcnJvciA6IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgICAgICAgICBzd2l0Y2ggKGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgX3NhdmUocGFyYW1zPywgZmNfc3VjY2Vzcz8sIGZjX2Vycm9yPyk6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICBsZXQgb2JqZWN0ID0gdGhpcy50b09iamVjdChwYXJhbXMpO1xuXG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgdGhpcy5pZCAmJiBwYXRoLmFkZFBhdGgodGhpcy5pZCk7XG4gICAgICAgICAgICBwYXJhbXMuaW5jbHVkZSA/IHBhdGguc2V0SW5jbHVkZShwYXJhbXMuaW5jbHVkZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAvL2xldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgbGV0IHJlc291cmNlID0gdGhpcy5uZXcoKTtcblxuICAgICAgICAgICAgbGV0IHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZXhlYyhwYXRoLmdldCgpLCB0aGlzLmlkID8gJ1BBVENIJyA6ICdQT1NUJywgb2JqZWN0KTtcblxuICAgICAgICAgICAgcHJvbWlzZS50aGVuKFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFuY2lvIGxvcyBpbmNsdWRlIHkgbG9zIGd1YXJkbyBlbiBpbmNsdWRlZCBhcnJhcnlcbiAgICAgICAgICAgICAgICAgICAgbGV0IGluY2x1ZGVkID0gW107XG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChzdWNjZXNzLmRhdGEuaW5jbHVkZWQsIChkYXRhOiBKc29uYXBpLklEYXRhUmVzb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXNvdXJjZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5tYWtlKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ3VhcmRhbW9zIGVuIGVsIGFycmF5IGRlIGluY2x1ZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoZGF0YS50eXBlIGluIGluY2x1ZGVkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlZFtkYXRhLnR5cGVdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV1bZGF0YS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGZjX2Vycm9yKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcHVibGljIF9nZXQoaWQ6IFN0cmluZywgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik6IElSZXNvdXJjZSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIGxldCBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKGlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vbGV0IHJlc291cmNlID0gbmV3IFJlc291cmNlKCk7XG4gICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuXG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5nZXQocGF0aC5nZXQoKSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHN1Y2Nlc3MuZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgICAgICAgICBsZXQgaW5jbHVkZWQgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHN1Y2Nlc3MuZGF0YS5pbmNsdWRlZCwgKGRhdGE6IEpzb25hcGkuSURhdGFSZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlc291cmNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLm1ha2UoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBndWFyZGFtb3MgZW4gZWwgYXJyYXkgZGUgaW5jbHVkZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShkYXRhLnR5cGUgaW4gaW5jbHVkZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRbZGF0YS50eXBlXVtkYXRhLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZWxhdGlvbnNoaXBzIGxldmFudG8gZWwgc2VydmljZSBjb3JyZXNwb25kaWVudGVcbiAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHZhbHVlLnJlbGF0aW9uc2hpcHMsIChyZWxhdGlvbl92YWx1ZSwgcmVsYXRpb25fa2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlbGF0aW9uIGlzIGluIHNjaGVtYT9cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZXNvdXJjZS5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihyZXNvdXJjZS50eXBlICsgJy5yZWxhdGlvbnNoaXBzLicgKyByZWxhdGlvbl9rZXkgKyAnIHJlY2VpdmVkLCBidXQgaXMgbm90IGRlZmluZWQgb24gc2NoZW1hJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldID0geyBkYXRhOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX2tleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2Vfc2VydmljZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlc291cmNlcyBkZWwgcmVsYXRpb24gdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWxhdGlvbnNoaXBfcmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uX3ZhbHVlLmRhdGEsIChyZXNvdXJjZV92YWx1ZTogSnNvbmFwaS5JRGF0YVJlc291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzdMOhIGVuIGVsIGluY2x1ZGVkP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG1wX3Jlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2VfdmFsdWUudHlwZSBpbiBpbmNsdWRlZCAmJiByZXNvdXJjZV92YWx1ZS5pZCBpbiBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gaW5jbHVkZWRbcmVzb3VyY2VfdmFsdWUudHlwZV1bcmVzb3VyY2VfdmFsdWUuaWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG1wX3Jlc291cmNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLnByb2NyZWF0ZShyZXNvdXJjZV9zZXJ2aWNlLCByZXNvdXJjZV92YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmRhdGFbdG1wX3Jlc291cmNlLmlkXSA9IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZmNfZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBfYWxsKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpOiBBcnJheTxJUmVzb3VyY2U+IHtcblxuICAgICAgICAgICAgLy8gaHR0cCByZXF1ZXN0XG4gICAgICAgICAgICBsZXQgcGF0aCA9IG5ldyBKc29uYXBpLlBhdGhNYWtlcigpO1xuICAgICAgICAgICAgcGF0aC5hZGRQYXRoKHRoaXMuZ2V0UGF0aCgpKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gW107XG4gICAgICAgICAgICBsZXQgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5nZXQocGF0aC5nZXQoKSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChzdWNjZXNzLmRhdGEuZGF0YSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVzb3VyY2UgPSBuZXcgUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gdmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UucHVzaChyZXNvdXJjZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBmY19zdWNjZXNzKHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBhZGRSZWxhdGlvbnNoaXAocmVzb3VyY2U6IEpzb25hcGkuSVJlc291cmNlLCB0eXBlX2FsaWFzPzogc3RyaW5nKSB7XG4gICAgICAgICAgICB0eXBlX2FsaWFzID0gKHR5cGVfYWxpYXMgPyB0eXBlX2FsaWFzIDogcmVzb3VyY2UudHlwZSk7XG4gICAgICAgICAgICBpZiAoISh0eXBlX2FsaWFzIGluIHRoaXMucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHNbdHlwZV9hbGlhc10gPSB7IGRhdGE6IHsgfSB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXJlc291cmNlLmlkKSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSAnbmV3XycgKyAoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwc1t0eXBlX2FsaWFzXVsnZGF0YSddW3Jlc291cmNlLmlkXSA9IHJlc291cmNlO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgUmVzb3VyY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBSZXNvdXJjZSgpIHtcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG51bGw7IC8vIHdpdGhvdXQgc2xhc2hlc1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzID0gW107XG4gICAgICAgICAgICB0aGlzLnBhcmFtc19iYXNlID0ge1xuICAgICAgICAgICAgICAgIGlkOiAnJyxcbiAgICAgICAgICAgICAgICBpbmNsdWRlOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgY2xvbmVPYmogPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgZm9yICh2YXIgYXR0cmlidXQgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1thdHRyaWJ1dF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb25lT2JqW2F0dHJpYnV0XSA9IHRoaXNbYXR0cmlidXRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjbG9uZU9iajtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgc2NoZW1hIG9uIEpzb25hcGkuQ29yZVxuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBKc29uYXBpLkNvcmUuTWUuX3JlZ2lzdGVyKHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGggPyB0aGlzLnBhdGggOiB0aGlzLnR5cGU7XG4gICAgICAgIH07XG4gICAgICAgIC8vIGVtcHR5IHNlbGYgb2JqZWN0XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5uZXcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLmNsb25lKCk7XG4gICAgICAgICAgICByZXNvdXJjZS5yZXNldCgpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgeHRoaXMgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5pZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XSA9IHt9O1xuICAgICAgICAgICAgICAgIHh0aGlzLnJlbGF0aW9uc2hpcHNba2V5XVsnZGF0YSddID0ge307XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnRvT2JqZWN0ID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcHMgPSB7fTtcbiAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh0aGlzLnJlbGF0aW9uc2hpcHMsIGZ1bmN0aW9uIChyZWxhdGlvbnNoaXAsIHJlbGF0aW9uX2FsaWFzKSB7XG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwc1tyZWxhdGlvbl9hbGlhc10gPSB7IGRhdGE6IFtdIH07XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHJlbGF0aW9uc2hpcC5kYXRhLCBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlYXRpb25hbF9vYmplY3QgPSB7IGlkOiByZXNvdXJjZS5pZCwgdHBlOiByZXNvdXJjZS50eXBlIH07XG4gICAgICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcHNbcmVsYXRpb25fYWxpYXNdWydkYXRhJ10ucHVzaChyZWF0aW9uYWxfb2JqZWN0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuYXR0cmlidXRlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwczogcmVsYXRpb25zaGlwc1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgaW5jbHVkZToge31cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvL3JldHVybiBvYmplY3Q7XG4gICAgICAgIH07XG4gICAgICAgIFJlc291cmNlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmV4ZWMoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdnZXQnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5leGVjKG51bGwsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IsICdhbGwnKTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZXhlYyhudWxsLCBwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yLCAnc2F2ZScpO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuZXhlYyA9IGZ1bmN0aW9uIChpZCwgcGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvciwgZXhlY190eXBlKSB7XG4gICAgICAgICAgICAvLyBtYWtlcyBgcGFyYW1zYCBvcHRpb25hbFxuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNGdW5jdGlvbihwYXJhbXMpKSB7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3IgPSBmY19zdWNjZXNzO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBwYXJhbXM7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKHBhcmFtcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXNfYmFzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFuZ3VsYXIuZXh0ZW5kKHt9LCB0aGlzLnBhcmFtc19iYXNlLCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZjX3N1Y2Nlc3MgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfc3VjY2VzcykgPyBmY19zdWNjZXNzIDogZnVuY3Rpb24gKCkgeyB9O1xuICAgICAgICAgICAgZmNfZXJyb3IgPSBhbmd1bGFyLmlzRnVuY3Rpb24oZmNfZXJyb3IpID8gZmNfZXJyb3IgOiBmdW5jdGlvbiAoKSB7IH07XG4gICAgICAgICAgICBzd2l0Y2ggKGV4ZWNfdHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2dldCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9nZXQoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hbGwocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcik7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2F2ZSc6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYXZlKHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX3NhdmUgPSBmdW5jdGlvbiAocGFyYW1zLCBmY19zdWNjZXNzLCBmY19lcnJvcikge1xuICAgICAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMudG9PYmplY3QocGFyYW1zKTtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICB0aGlzLmlkICYmIHBhdGguYWRkUGF0aCh0aGlzLmlkKTtcbiAgICAgICAgICAgIHBhcmFtcy5pbmNsdWRlID8gcGF0aC5zZXRJbmNsdWRlKHBhcmFtcy5pbmNsdWRlKSA6IG51bGw7XG4gICAgICAgICAgICAvL2xldCByZXNvdXJjZSA9IG5ldyBSZXNvdXJjZSgpO1xuICAgICAgICAgICAgdmFyIHJlc291cmNlID0gdGhpcy5uZXcoKTtcbiAgICAgICAgICAgIHZhciBwcm9taXNlID0gSnNvbmFwaS5Db3JlLlNlcnZpY2VzLkpzb25hcGlIdHRwLmV4ZWMocGF0aC5nZXQoKSwgdGhpcy5pZCA/ICdQQVRDSCcgOiAnUE9TVCcsIG9iamVjdCk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBzdWNjZXNzLmRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5hdHRyaWJ1dGVzID0gdmFsdWUuYXR0cmlidXRlcztcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5pZCA9IHZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIC8vIGluc3RhbmNpbyBsb3MgaW5jbHVkZSB5IGxvcyBndWFyZG8gZW4gaW5jbHVkZWQgYXJyYXJ5XG4gICAgICAgICAgICAgICAgdmFyIGluY2x1ZGVkID0gW107XG4gICAgICAgICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHN1Y2Nlc3MuZGF0YS5pbmNsdWRlZCwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc291cmNlID0gSnNvbmFwaS5SZXNvdXJjZU1ha2VyLm1ha2UoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ3VhcmRhbW9zIGVuIGVsIGFycmF5IGRlIGluY2x1ZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIShkYXRhLnR5cGUgaW4gaW5jbHVkZWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRbZGF0YS50eXBlXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZWRbZGF0YS50eXBlXVtkYXRhLmlkXSA9IHJlc291cmNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZmNfZXJyb3Ioc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLl9nZXQgPSBmdW5jdGlvbiAoaWQsIHBhcmFtcywgZmNfc3VjY2VzcywgZmNfZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGh0dHAgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHBhdGggPSBuZXcgSnNvbmFwaS5QYXRoTWFrZXIoKTtcbiAgICAgICAgICAgIHBhdGguYWRkUGF0aCh0aGlzLmdldFBhdGgoKSk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgoaWQpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vbGV0IHJlc291cmNlID0gbmV3IFJlc291cmNlKCk7XG4gICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSB0aGlzLm5ldygpO1xuICAgICAgICAgICAgdmFyIHByb21pc2UgPSBKc29uYXBpLkNvcmUuU2VydmljZXMuSnNvbmFwaUh0dHAuZ2V0KHBhdGguZ2V0KCkpO1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gc3VjY2Vzcy5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAvLyBpbnN0YW5jaW8gbG9zIGluY2x1ZGUgeSBsb3MgZ3VhcmRvIGVuIGluY2x1ZGVkIGFycmFyeVxuICAgICAgICAgICAgICAgIHZhciBpbmNsdWRlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChzdWNjZXNzLmRhdGEuaW5jbHVkZWQsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXNvdXJjZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5tYWtlKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGd1YXJkYW1vcyBlbiBlbCBhcnJheSBkZSBpbmNsdWRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoZGF0YS50eXBlIGluIGluY2x1ZGVkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVkW2RhdGEudHlwZV1bZGF0YS5pZF0gPSByZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIHJlY29ycm8gbG9zIHJlbGF0aW9uc2hpcHMgbGV2YW50byBlbCBzZXJ2aWNlIGNvcnJlc3BvbmRpZW50ZVxuICAgICAgICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaCh2YWx1ZS5yZWxhdGlvbnNoaXBzLCBmdW5jdGlvbiAocmVsYXRpb25fdmFsdWUsIHJlbGF0aW9uX2tleSkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZWxhdGlvbiBpcyBpbiBzY2hlbWE/XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHJlbGF0aW9uX2tleSBpbiByZXNvdXJjZS5yZWxhdGlvbnNoaXBzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKHJlc291cmNlLnR5cGUgKyAnLnJlbGF0aW9uc2hpcHMuJyArIHJlbGF0aW9uX2tleSArICcgcmVjZWl2ZWQsIGJ1dCBpcyBub3QgZGVmaW5lZCBvbiBzY2hlbWEnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlLnJlbGF0aW9uc2hpcHNbcmVsYXRpb25fa2V5XSA9IHsgZGF0YTogW10gfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2Vfc2VydmljZSA9IEpzb25hcGkuUmVzb3VyY2VNYWtlci5nZXRTZXJ2aWNlKHJlbGF0aW9uX2tleSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZV9zZXJ2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZWNvcnJvIGxvcyByZXNvdXJjZXMgZGVsIHJlbGF0aW9uIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBfcmVzb3VyY2VzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocmVsYXRpb25fdmFsdWUuZGF0YSwgZnVuY3Rpb24gKHJlc291cmNlX3ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXN0w6EgZW4gZWwgaW5jbHVkZWQ/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzb3VyY2VfdmFsdWUudHlwZSBpbiBpbmNsdWRlZCAmJiByZXNvdXJjZV92YWx1ZS5pZCBpbiBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXBfcmVzb3VyY2UgPSBpbmNsdWRlZFtyZXNvdXJjZV92YWx1ZS50eXBlXVtyZXNvdXJjZV92YWx1ZS5pZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bXBfcmVzb3VyY2UgPSBKc29uYXBpLlJlc291cmNlTWFrZXIucHJvY3JlYXRlKHJlc291cmNlX3NlcnZpY2UsIHJlc291cmNlX3ZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UucmVsYXRpb25zaGlwc1tyZWxhdGlvbl9rZXldLmRhdGFbdG1wX3Jlc291cmNlLmlkXSA9IHRtcF9yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZmNfc3VjY2VzcyhzdWNjZXNzKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGZjX2Vycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgICB9O1xuICAgICAgICBSZXNvdXJjZS5wcm90b3R5cGUuX2FsbCA9IGZ1bmN0aW9uIChwYXJhbXMsIGZjX3N1Y2Nlc3MsIGZjX2Vycm9yKSB7XG4gICAgICAgICAgICAvLyBodHRwIHJlcXVlc3RcbiAgICAgICAgICAgIHZhciBwYXRoID0gbmV3IEpzb25hcGkuUGF0aE1ha2VyKCk7XG4gICAgICAgICAgICBwYXRoLmFkZFBhdGgodGhpcy5nZXRQYXRoKCkpO1xuICAgICAgICAgICAgcGFyYW1zLmluY2x1ZGUgPyBwYXRoLnNldEluY2x1ZGUocGFyYW1zLmluY2x1ZGUpIDogbnVsbDtcbiAgICAgICAgICAgIC8vIG1ha2UgcmVxdWVzdFxuICAgICAgICAgICAgdmFyIHJlc3BvbnNlID0gW107XG4gICAgICAgICAgICB2YXIgcHJvbWlzZSA9IEpzb25hcGkuQ29yZS5TZXJ2aWNlcy5Kc29uYXBpSHR0cC5nZXQocGF0aC5nZXQoKSk7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBhbmd1bGFyLmZvckVhY2goc3VjY2Vzcy5kYXRhLmRhdGEsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzb3VyY2UgPSBuZXcgUmVzb3VyY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2UuYXR0cmlidXRlcyA9IHZhbHVlLmF0dHJpYnV0ZXM7XG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLnB1c2gocmVzb3VyY2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGZjX3N1Y2Nlc3Moc3VjY2Vzcyk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBmY19lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICAgICAgfTtcbiAgICAgICAgUmVzb3VyY2UucHJvdG90eXBlLmFkZFJlbGF0aW9uc2hpcCA9IGZ1bmN0aW9uIChyZXNvdXJjZSwgdHlwZV9hbGlhcykge1xuICAgICAgICAgICAgdHlwZV9hbGlhcyA9ICh0eXBlX2FsaWFzID8gdHlwZV9hbGlhcyA6IHJlc291cmNlLnR5cGUpO1xuICAgICAgICAgICAgaWYgKCEodHlwZV9hbGlhcyBpbiB0aGlzLnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdID0geyBkYXRhOiB7fSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFyZXNvdXJjZS5pZCkge1xuICAgICAgICAgICAgICAgIHJlc291cmNlLmlkID0gJ25ld18nICsgKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXBzW3R5cGVfYWxpYXNdWydkYXRhJ11bcmVzb3VyY2UuaWRdID0gcmVzb3VyY2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBSZXNvdXJjZTtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuUmVzb3VyY2UgPSBSZXNvdXJjZTtcbn0pKEpzb25hcGkgfHwgKEpzb25hcGkgPSB7fSkpO1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uLy4uL3R5cGluZ3MvbWFpbi5kLnRzXCIgLz5cblxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3BhcmFtcy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9lcnJvcnMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvbGlua3MuZC50c1wiLz5cblxuLy8gUGFyYW1ldGVycyBmb3IgVFMtSnNvbmFwaSBDbGFzc2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3NjaGVtYS5kLnRzXCIvPlxuXG4vLyBUUy1Kc29uYXBpIENsYXNzZXMgSW50ZXJmYWNlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9jb3JlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3Jlc291cmNlLmQudHNcIi8+XG5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1tYWtlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9tYWluLmQudHNcIiAvPlxuLy8gSnNvbmFwaSBpbnRlcmZhY2VzIHBhcnQgb2YgdG9wIGxldmVsXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RvY3VtZW50LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2RhdGEtY29sbGVjdGlvbi5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLW9iamVjdC5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9kYXRhLXJlc291cmNlLmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL3BhcmFtcy5kLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9lcnJvcnMuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvbGlua3MuZC50c1wiLz5cbi8vIFBhcmFtZXRlcnMgZm9yIFRTLUpzb25hcGkgQ2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vaW50ZXJmYWNlcy9zY2hlbWEuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgQ2xhc3NlcyBJbnRlcmZhY2VzXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9pbnRlcmZhY2VzL2NvcmUuZC50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2ludGVyZmFjZXMvcmVzb3VyY2UuZC50c1wiLz5cbi8vIFRTLUpzb25hcGkgY2xhc3Nlc1xuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXBwLm1vZHVsZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL2h0dHAuc2VydmljZS50c1wiLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3NlcnZpY2VzL3BhdGgtbWFrZXIudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9yZXNvdXJjZS1tYWtlci50c1wiLz5cbi8vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9zZXJ2aWNlcy9jb3JlLXNlcnZpY2VzLnNlcnZpY2UudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9jb3JlLnRzXCIvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vcmVzb3VyY2UudHNcIi8+XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIENvcmVTZXJ2aWNlcyB7XG5cbiAgICAgICAgLyoqIEBuZ0luamVjdCAqL1xuICAgICAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgICAgICBwcm90ZWN0ZWQgSnNvbmFwaUh0dHBcbiAgICAgICAgKSB7XG5cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFuZ3VsYXIubW9kdWxlKCdKc29uYXBpLnNlcnZpY2VzJykuc2VydmljZSgnSnNvbmFwaUNvcmVTZXJ2aWNlcycsIENvcmVTZXJ2aWNlcyk7XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBDb3JlU2VydmljZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKiogQG5nSW5qZWN0ICovXG4gICAgICAgIGZ1bmN0aW9uIENvcmVTZXJ2aWNlcyhKc29uYXBpSHR0cCkge1xuICAgICAgICAgICAgdGhpcy5Kc29uYXBpSHR0cCA9IEpzb25hcGlIdHRwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb3JlU2VydmljZXM7XG4gICAgfSgpKTtcbiAgICBKc29uYXBpLkNvcmVTZXJ2aWNlcyA9IENvcmVTZXJ2aWNlcztcbiAgICBhbmd1bGFyLm1vZHVsZSgnSnNvbmFwaS5zZXJ2aWNlcycpLnNlcnZpY2UoJ0pzb25hcGlDb3JlU2VydmljZXMnLCBDb3JlU2VydmljZXMpO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iLCJtb2R1bGUgSnNvbmFwaSB7XG4gICAgZXhwb3J0IGNsYXNzIEpzb25hcGlQYXJzZXIge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgdG9PYmplY3QoanNvbl9zdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwidmFyIEpzb25hcGk7XG4oZnVuY3Rpb24gKEpzb25hcGkpIHtcbiAgICB2YXIgSnNvbmFwaVBhcnNlciA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVBhcnNlcigpIHtcbiAgICAgICAgfVxuICAgICAgICBKc29uYXBpUGFyc2VyLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uIChqc29uX3N0cmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGpzb25fc3RyaW5nO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gSnNvbmFwaVBhcnNlcjtcbiAgICB9KCkpO1xuICAgIEpzb25hcGkuSnNvbmFwaVBhcnNlciA9IEpzb25hcGlQYXJzZXI7XG59KShKc29uYXBpIHx8IChKc29uYXBpID0ge30pKTtcbiIsIm1vZHVsZSBKc29uYXBpIHtcbiAgICBleHBvcnQgY2xhc3MgSnNvbmFwaVN0b3JhZ2Uge1xuXG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIHN0b3JlLFxuICAgICAgICAgICAgLy8gcHJvdGVjdGVkIFJlYWxKc29uYXBpXG4gICAgICAgICkge1xuXG4gICAgICAgIH1cblxuICAgICAgICBwdWJsaWMgZ2V0KGtleSkge1xuICAgICAgICAgICAgLyogbGV0IGRhdGEgPSB0aGlzLnN0b3JlLmdldChrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIGFuZ3VsYXIuZnJvbUpzb24oZGF0YSk7Ki9cbiAgICAgICAgfVxuXG4gICAgICAgIHB1YmxpYyBtZXJnZShrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cblxuXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJ2YXIgSnNvbmFwaTtcbihmdW5jdGlvbiAoSnNvbmFwaSkge1xuICAgIHZhciBKc29uYXBpU3RvcmFnZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKiBAbmdJbmplY3QgKi9cbiAgICAgICAgZnVuY3Rpb24gSnNvbmFwaVN0b3JhZ2UoKSB7XG4gICAgICAgIH1cbiAgICAgICAgSnNvbmFwaVN0b3JhZ2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIC8qIGxldCBkYXRhID0gdGhpcy5zdG9yZS5nZXQoa2V5KTtcbiAgICAgICAgICAgIHJldHVybiBhbmd1bGFyLmZyb21Kc29uKGRhdGEpOyovXG4gICAgICAgIH07XG4gICAgICAgIEpzb25hcGlTdG9yYWdlLnByb3RvdHlwZS5tZXJnZSA9IGZ1bmN0aW9uIChrZXksIGRhdGEpIHtcbiAgICAgICAgICAgIC8qIGxldCBhY3R1YWxfZGF0YSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgICAgICAgICBsZXQgYWN0dWFsX2luZm8gPSBhbmd1bGFyLmZyb21Kc29uKGFjdHVhbF9kYXRhKTsgKi9cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEpzb25hcGlTdG9yYWdlO1xuICAgIH0oKSk7XG4gICAgSnNvbmFwaS5Kc29uYXBpU3RvcmFnZSA9IEpzb25hcGlTdG9yYWdlO1xufSkoSnNvbmFwaSB8fCAoSnNvbmFwaSA9IHt9KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
