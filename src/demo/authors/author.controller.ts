module demoApp {
    'use strict';

    export class AuthorController {
        public author: any = null;
        public books: any = null;

        /** @ngInject */
        constructor(
            protected AuthorsService,
            protected BooksService,
            protected $routeParams
        ) {
            this.author = AuthorsService.get(
                $routeParams.authorId,
                { include: ['books', 'photos'] },
                success => {
                    console.log('success authors controller', success);
                },
                error => {
                    console.log('error authors controller', error);
                }
            );
            this.books = this.author.relationships.books.data;
        }
    }

    angular.module('demoApp').controller('AuthorController', AuthorController);
}
