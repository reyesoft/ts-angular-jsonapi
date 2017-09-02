import * as angular from 'angular';
import 'angular-ui-router';
import 'bootstrap/dist/css/bootstrap.css';
import './index.scss';
import routesConfig from './routes';

// Jsonapi
import '../library/index';
let rsJsonapiConfig = ['rsJsonapiConfig', (rsJsonapiConfigParam): void => {
    angular.extend(rsJsonapiConfigParam, {
        // url: 'http://laravel-jsonapi.dev/v2/',
        url: 'http://jsonapiplayground.reyesoft.com/v2/',
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
import { Photos } from './photos/photos.component';
import { PhotosService } from './photos/photos.service';
import { NoDuplicatedHttpCalls } from './tests/noduplicatedhttpcalls.component';

angular
    .module('app', ['ui.router', 'rsJsonapi'])
    .config(routesConfig)
    .config(rsJsonapiConfig)
    .service('AuthorsService', AuthorsService)
    .service('BooksService', BooksService)
    .service('PhotosService', PhotosService)
    .component('app', new App())
    .component('author', new Author())
    .component('authors', new Authors())
    .component('book', new Book())
    .component('books', new Books())
    .component('photos', new Photos())
    .component('noduplicatedcalltests', new NoDuplicatedHttpCalls())
    ;
