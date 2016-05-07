module demoApp {
    'use strict';

    export class GlobalController {
        /** @ngInject */
        public constructor(
            protected JsonapiCore,
            protected $scope
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
