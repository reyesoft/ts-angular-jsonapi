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

        public delete (author: Jsonapi.IResource) {
            console.log('eliminaremos (no soportado en este ejemplo)', author.toObject());
            this.AuthorsService.delete(
                author.id,
                success => {
                    console.log('deleted', success);
                }
            );
        }
    }

    angular.module('demoApp').controller('AuthorsController', AuthorsController);
}
