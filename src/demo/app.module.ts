/// <reference path="./_all.ts" />

((): void => {
    var app = angular.module('demoApp', ['ngRoute', 'Jsonapi']);

    app.config(['$routeProvider', ($routeProvider) => {
        $routeProvider.when('/', {
            controller: 'AuthorsController',
            templateUrl: 'authors/authors.html',
            controllerAs: 'vm'
        })
        .when('/authors/author/:authorId', {
            controller: 'AuthorController',
            templateUrl: 'authors/author.html',
            controllerAs: 'vm'
        })
        .when('/books/', {
            controller: 'BooksController',
            templateUrl: 'books/books.html',
            controllerAs: 'vm'
        })
        .when('/books/book/:bookId', {
            controller: 'BookController',
            templateUrl: 'books/book.html',
            controllerAs: 'vm'
        });
    }]);

})();
