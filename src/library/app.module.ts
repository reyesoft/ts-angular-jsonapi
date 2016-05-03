/// <reference path="./_all.ts" />

(function (angular) {
    // Config
    angular.module('Jsonapi.config', [])
        .value('Jsonapi.config', {
            debug: true
        });

    angular.module('Jsonapi.services', []);

    angular.module('Jsonapi',
    [
        'angular-storage',
        'Jsonapi.config',
        'Jsonapi.services'
    ]);
})(angular);
