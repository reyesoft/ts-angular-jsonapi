/// <reference path="../_all.ts" />

module demoApp {
    export class AuthorsService extends Jsonapi.Resource {
        public type: 'authors';
        public schema = {
            attributes: {
                name: { presence: true, length: {maximum: 96} },
                stock_desired: { numericality: { onlyInteger: true } }
            },
            relationships: {
                pricelist_products: { }
            }
        };
    }

    angular.module('demoApp')
        .service('demoApp.AuthorsService', AuthorsService);
}
