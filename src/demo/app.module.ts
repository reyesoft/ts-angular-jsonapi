/// <reference path="./_all.ts" />

((): void => {
    var app = angular.module('demoApp', ['ngRoute', 'rsJsonapi']);

    app.config(['rsJsonapiConfig', (rsJsonapiConfig) => {
        angular.extend(rsJsonapiConfig, {
            url: 'http://localhost:8080/v1/'
        });
    }]);

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
