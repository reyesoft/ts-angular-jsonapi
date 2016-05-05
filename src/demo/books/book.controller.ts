module demoApp {
    'use strict';

    export class BookController {
        public book: any = null;

        /** @ngInject */
        constructor(
            protected BooksService,
            protected $routeParams
        ) {
            this.book = BooksService.get(
                $routeParams.bookId,
                { include: ['authors'] },
                success => {
                    console.log('successxxxxxxxxxxxxx books controll', success);
                },
                error => {
                    console.log('error books controll', error);
                }
            );
        }
    }

    angular.module('demoApp').controller('BookController', BookController);
}
