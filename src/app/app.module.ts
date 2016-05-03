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
            controller: 'demoApp.BooksController',
            templateUrl: 'app/authors/books.html',
            controllerAs: 'vm'
        })
        .when('/books/book/:bookId', {
            controller: 'demoApp.BookController',
            templateUrl: 'app/authors/book.html',
            controllerAs: 'vm'
        });
    }]);

})();
