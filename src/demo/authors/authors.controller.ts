module demoApp {
    'use strict';

    export class AuthorsController {
        public authors: any = null;

        /** @ngInject */
        constructor(
            protected AuthorsService
        ) {
            this.authors = AuthorsService.all(
                // { include: ['books', 'photos'] },
                success => {
                    console.log('success authors controll', success);
                },
                error => {
                    console.log('error authors controll', error);
                }
            );
        }
    }

    angular.module('demoApp').controller('AuthorsController', AuthorsController);
}
