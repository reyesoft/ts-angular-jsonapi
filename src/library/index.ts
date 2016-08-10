/// <reference path="./index.d.ts" />

import * as angular from 'angular';

angular.module('Jsonapi.config', [])
    .constant('rsJsonapiConfig', {
        url: 'http://yourdomain/api/v1/',
        delay: 0,
        unify_concurrency: true,
        cache_prerequests: true
    });

angular.module('Jsonapi.services', []);

angular.module('rsJsonapi', [
    'Jsonapi.config',
    'Jsonapi.services'
]);

import { Core } from './core';
import { Resource } from './resource';

export var Jsonapi = {
    Core: Core,
    Resource: Resource
};
