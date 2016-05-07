/// <reference path="../_all.ts" />

module demoApp {
    export class PhotosService extends Jsonapi.Resource {
        type = 'photos';
        public schema: Jsonapi.ISchema = {
            attributes: {
                title: {},
                uri: {},
                imageable_id: {},
                created_at: {},
                updated_at: {}
            }
        };
    }

    angular.module('demoApp').service('PhotosService', PhotosService);
}
