module demoApp {
    'use strict';

    export class AuthorsController {
        // customers: ICustomer[] = null;
        customers: any = null;

        // static $inject = ['demoApp.AuthorsService'];
        /** @ngInject */
        constructor(
            // protected AuthorsService
        ) {
            //let authors = AuthorsService.all();
            // this.customers = authors.data;

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

    // angular.module('demoApp')
    //        .controller('demoApp.AuthorsController', ['demoApp.AuthorsService', AuthorsController]);
    angular.module('demoApp')
           .controller('demoApp.AuthorsController', AuthorsController);
}
