/// <reference path="../_all.ts" />

module demoApp {
    export class AuthorsService extends Jsonapi.Resource {
    // export class AuthorsService {
        // export class AuthorsService extends Jsonapi.Resource {
        public schema = {
            type: 'authors',
            attributes: {
                name: { presence: true, length: {maximum: 96} },
                date_of_birth: { },
                date_of_death: { },
                created_at: { },
                updated_at: { }
            },
            relationships: {
                books: { },
                photos: { }
            }
        };

        /** @ngInject */
        public constructor(
            JsonapiCore
        ) {
            super();
            // console.log('AuthorsService');
            // console.log('AuthorsService constructed >', this.ServiceXXX);
            // console.log('AuthorsService constructed >', Jsonapi.Services.nato);
        }

        public getType() {
            return this.schema.type;
        }
    }
    angular.module('demoApp').service('AuthorsService', AuthorsService);
}
