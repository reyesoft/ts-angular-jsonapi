/// <reference path="../_all.ts" />

module demoApp {
    export class AuthorsService {
    // export class AuthorsService extends Jsonapi.Resource {
        public schema = {
            type: 'authors',
            attributes: {
                name: { presence: true, length: {maximum: 96} },
                stock_desired: { numericality: { onlyInteger: true } }
            },
            relationships: {
                pricelist_products: { }
            }
        };

        public constructor() {
            console.log('AuthorsService constructed');
        }

        public getType() {
            return this.schema.type;
        }
    }
    angular.module('demoApp').service('AuthorsService', AuthorsService);
}
