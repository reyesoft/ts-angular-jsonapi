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
        // 'angular-storage',
        'Jsonapi.config',
        'Jsonapi.services'
    ]);

})(angular);
