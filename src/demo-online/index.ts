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
        url: 'http://localhost/?path=/',
        params_separator: '&'
    });
}];

import { App } from './containers/app';
import { User } from './users/user.component';
import { Users } from './users/users.component';
import { Book } from './books/book.component';
import { Books } from './books/books.component';

import { AuthorsService } from './authors/authors.service';
import { BooksService } from './books/books.service';
import { ContactsService } from './contacts/contacts.service';
import { PublishersService } from './publishers/publishers.service';
import { UsersService } from './users/users.service';

angular
    .module('app', ['ui.router', 'rsJsonapi'])
    .config(routesConfig)
    .config(rsJsonapiConfig)
    .service('AuthorsService', AuthorsService)
    .service('BooksService', BooksService)
    .service('ContactsService', ContactsService)
    .service('PublishersService', PublishersService)
    .service('UsersService', UsersService)
    .component('app', new App())
    .component('user', new User())
    .component('users', new Users())
    .component('book', new Book())
    .component('books', new Books())
    ;
