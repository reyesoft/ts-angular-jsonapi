module demoApp {
    'use strict';

    export class GlobalController {
        /** @ngInject */
        public constructor(
            protected JsonapiCore,
            protected AuthorsService,
            protected BooksService,
            protected PhotosService,
            protected $scope
        ) {
            let self = this;
            $scope.loading  = false;

            AuthorsService.register();
            BooksService.register();
            PhotosService.register();

            JsonapiCore.loadingsStart = () => {
                self.$scope.loading = 'LOADING...';
            };
            JsonapiCore.loadingsDone = () => {
                self.$scope.loading = '';
            };
            JsonapiCore.loadingsOffline = (error) => {
                self.$scope.loading = 'No connection!!!';
            };
            JsonapiCore.loadingsError = (error) => {
                // self.$scope.loading = 'No connection!!!';
            };
        }
    }

    angular.module('demoApp').controller('GlobalController', GlobalController);
}
