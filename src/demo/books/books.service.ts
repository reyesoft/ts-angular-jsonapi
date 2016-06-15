/// <reference path="../_all.ts" />

module demoApp {
    export class BooksService extends Jsonapi.Resource {
        type = 'books';
        public schema: Jsonapi.ISchema = {
            attributes: {
                date_published: { },
                title: { presence: true, length: { maximum: 96 } },
                created_at: { },
                updated_at: { }
            },
            relationships: {
                author: {
                    hasMany: false
                },
                photos: {
                    hasMany: true
                }
            }
        };
    }

    angular.module('demoApp').service('BooksService', BooksService);
}
