module demoApp {
    'use strict';

    export class BooksController {
        public books: any = null;

        /** @ngInject */
        constructor(
            protected BooksService
        ) {
            this.books = BooksService.all(
                { include: ['author'] },
                success => {
                    console.log('success books controller', success, this.books);
                },
                error => {
                    console.log('error books controller', error);
                }
            );
        }
    }

    angular.module('demoApp').controller('BooksController', BooksController);
}
