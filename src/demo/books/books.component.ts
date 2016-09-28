import * as Jsonapi from '../../library/index';

class BooksController {
    public books: any = null;

    /** @ngInject */
    constructor(
        protected BooksService: Jsonapi.IResource,
        protected $stateParams
    ) {

        // make filter (this is optional)
        let filter = {};
        if (this.$stateParams.filter.length > 0) {
            filter = { title : this.$stateParams.filter };
            // maybe you need a regular expresion ;)
            // filter = { title : /R.*/ };
        }

        this.books = BooksService.all(
            {
                filter: filter,
                include: ['author', 'photos']
            },
            success => {
                console.log('success books controller', success, this.books);
            },
            error => {
                console.log('error books controller', error);
            }
        );
    }
}

export const Books = {
    templateUrl: 'demo/books/books.html',
    controller: BooksController
};
