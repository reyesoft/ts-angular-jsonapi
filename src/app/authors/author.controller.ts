module demoApp {
    'use strict';

    export class AuthorController {
        public authors: any = null;

        /** @ngInject */
        constructor(
            protected AuthorsService
        ) {
            this.authors = AuthorsService.all(
                { include: ['books', 'photos'] },
                success => {
                    console.log('successxxxxxxxxxxxxx authors controll', success);
                },
                error => {
                    console.log('error authors controll', error);
                }
            );
        }
    }

    angular.module('demoApp').controller('AuthorController', AuthorController);
}
