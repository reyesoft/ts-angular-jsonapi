/// <reference path="../_all.ts" />

module demoApp {
    export class AuthorsService extends Jsonapi.Resource {
        type = 'authors';
        public schema: Jsonapi.ISchema = {
            attributes: {
                name: { presence: true, length: { maximum: 96 } },
                date_of_birth: {},
                date_of_death: {},
                created_at: {},
                updated_at: {}
            },
            relationships: {
                books: {},
                photos: {}
            }
        };
    }

    angular.module('demoApp').service('AuthorsService', AuthorsService);
}
