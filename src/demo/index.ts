/// <reference path="../../typings/index.d.ts" />

import * as angular from 'angular';
import 'angular-ui-router';
import 'bootstrap/dist/css/bootstrap.css';
import './index.scss';
import routesConfig from './routes';

// import '../library/index2';

// Jsonapi
import '../library/index';
let rsJsonapiConfig = ['rsJsonapiConfig', (rsJsonapiConfig) => {
    angular.extend(rsJsonapiConfig, {
        url: 'http://localhost:8080/v1/',
        delay: 800
    });
}];

import { App } from './containers/app';
import { Author } from './authors/author.component';
import { Authors } from './authors/authors.component';
import { AuthorsService } from './authors/authors.service';
import { Book } from './books/book.component';
import { Books } from './books/books.component';
import { BooksService } from './books/books.service';
import { PhotosService } from './photos/photos.service';

console.log('initiating app');
angular
    .module('app', ['ui.router', 'rsJsonapi'])
    .config(routesConfig)
    .config(rsJsonapiConfig)
    .service('AuthorsService', AuthorsService)
    .service('BooksService', BooksService)
    .service('PhotosService', PhotosService)
    .component('app', App)
    .component('author', Author)
    .component('authors', Authors)
    .component('book', Book)
    .component('books', Books)
    ;
