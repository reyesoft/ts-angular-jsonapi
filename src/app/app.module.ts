/// <reference path="./_all.ts" />

((): void => {
    var app = angular.module('demoApp', ['ngRoute', 'Jsonapi']);

    app.config(['$routeProvider', ($routeProvider) => {
        $routeProvider.when('/', {
            controller: 'AuthorsController',
            templateUrl: 'app/authors/authors.html',
            controllerAs: 'vm'
        })
        .when('/authors/author/:authorId', {
            controller: 'AuthorController',
            templateUrl: 'app/authors/author.html',
            controllerAs: 'vm'
        })
        .when('/books/', {
            controller: 'BooksController',
            templateUrl: 'app/books/books.html',
            controllerAs: 'vm'
        })
        .when('/books/book/:bookId', {
            controller: 'BookController',
            templateUrl: 'app/books/book.html',
            controllerAs: 'vm'
        });
    }]);

})();
