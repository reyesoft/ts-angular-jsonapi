/// <reference path="./_all.ts" />

var app = angular.module('demoApp', ['ngRoute']);

app.config(['$routeProvider', ($routeProvider) => {
    $routeProvider.when('/', {
        controller: 'demoApp.AuthorsController',
        templateUrl: 'app/authors/authors.html',
        controllerAs: 'vm'
    })
    .when('/authors/author/:authorId', {
        controller: 'demoApp.AuthorController',
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
