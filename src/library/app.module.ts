/// <reference path="./_all.ts" />

(function (angular) {
    // Config
    angular.module('Jsonapi.config', [])
        .value('Jsonapi.config', {
            debug: true
        });
    angular.module('Jsonapi.services', []);

    console.log('app.ts from library initiated');
    angular.module('Jsonapi',
    [
        'Jsonapi.config',
        'Jsonapi.services'
    ]);
})(angular);
