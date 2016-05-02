module demoApp {

    class BooksController {

        customerId: number;
        // orders: IOrder[];

    }

    angular.module('demoApp')
        .controller('demoApp.BooksController', BooksController);

}
