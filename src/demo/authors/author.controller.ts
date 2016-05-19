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

        /**
        Add a new author
        **/
        public new() {
            let author = this.AuthorsService.new();
            author.attributes.name = 'Pablo Reyes';
            author.attributes.date_of_birth = '2030-12-10';
            angular.forEach(this.books, (book: Jsonapi.IResource) => {
                author.addRelationship(book /* , 'handbook' */);
            });
            console.log('new save', author.toObject());
            // author.save( /* { include: ['book'] } */ );
        }

        /**
        Update name for actual author
        **/
        public update() {
            this.author.attributes.name += 'o';
            this.author.save(
                // { include: ['books'] }
            );
            console.log('update save with book include', this.author.toObject({ include: ['books'] }));
            console.log('update save without any include', this.author.toObject());
        }
    }

    angular.module('demoApp').controller('AuthorController', AuthorController);
}
