module demoApp {
    'use strict';

    export class AuthorController {
        public author: any = null;

        /** @ngInject */
        constructor(
            protected AuthorsService,
            protected $routeParams
        ) {
            this.author = AuthorsService.get(
                $routeParams.authorId,
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
