/// <reference path="./index.d.ts" />

import * as angular from 'angular';
import 'angular-localforage';

angular.module('Jsonapi.config', [])
    .constant('rsJsonapiConfig', {
        url: 'http://yourdomain/api/v1/',
        delay: 0,
        unify_concurrency: true,
        cache_prerequests: true,
        parameters: {
            page: {
                'number': 'page[number]',
                'limit': 'page[limit]'
            }
        }
    });

angular.module('Jsonapi.services', []);

angular.module('rsJsonapi', [
    'LocalForageModule',
    'Jsonapi.config',
    'Jsonapi.services'
]);

import { Core } from './core';
import { Service } from './service';
import { Resource } from './resource';

// just for bootstrap this library on demo.
// On dist version, all is exported inside a Jsonapi module
export { Core };
export { Resource };
export { Service };

export * from './interfaces';
import { IResource } from './interfaces';
import { IService } from './interfaces';
export { IResource };
export { IService };
