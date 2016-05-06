module demoApp {
    'use strict';

    export class GlobalController {
        /** @ngInject */
        public constructor(
            protected $scope,
            protected JsonapiCore
        ) {
            let self = this;
            $scope.loading  = false;

            JsonapiCore.loadingsStart = () => {
                self.$scope.loading = true;
            };
            JsonapiCore.loadingsDone = () => {
                self.$scope.loading = false;
            };
        }
    }

    angular.module('demoApp').controller('GlobalController', GlobalController);
}
