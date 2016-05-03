module demoApp {
    'use strict';

    export class AuthorsController {
        // customers: ICustomer[] = null;
        customers: any = null;

        /** @ngInject */
        constructor(
            protected AuthorsService
        ) {
            //console.log('testing injection', AuthorsService.getType());
            let authors = AuthorsService.all();
            this.customers = authors.data;

            /* authors.promise.then(
                success => {
                    console.log('success', success);
                },
                errors => {
                    console.log('errors', errors);
                }
            ); */

              /*.then((custs: ICustomer[]) => {
                 this.customers = custs;
             })*/;
        }
    }

    angular.module('demoApp')
           .controller('AuthorsController', AuthorsController);
}
