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
                localfilter: filter,
                remotefilter: {
                    date: {
                        since:'1983-01-01',
                        until: '2010-01-01'
                    }
                },
                page: { number: 2 },
                // storage_ttl: 15,
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

    public delete(book: Jsonapi.IResource) {
        this.BooksService.delete(book.id);
    }
}

export const Books = {
    templateUrl: 'demo/books/books.html',
    controller: BooksController
};
