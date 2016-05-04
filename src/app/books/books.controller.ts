module demoApp {
    'use strict';

    export class BooksController {
        public books: any = null;

        /** @ngInject */
        constructor(
            protected BooksService
        ) {
            this.books = BooksService.all(
                { include: ['authors'] },
                success => {
                    console.log('success books controller', success);
                },
                error => {
                    console.log('error books controller', error);
                }
            );
        }
    }

    angular.module('demoApp').controller('BooksController', BooksController);
}
