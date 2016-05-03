/// <reference path="./_all.ts" />

(function (angular) {
    // Config
    angular.module('Jsonapi.config', [])
        .value('JsonapiConfig', {
            debug: true,
            url: 'http://localhost:8080/v1/'
        });

    angular.module('Jsonapi.services', []);

    angular.module('Jsonapi',
    [
        'angular-storage',
        'Jsonapi.config',
        'Jsonapi.services'
    ]);
})(angular);
