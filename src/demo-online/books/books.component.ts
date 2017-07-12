import * as Jsonapi from '../../library/index';

class BooksController implements ng.IController {
    public books: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
        protected JsonapiCore: Jsonapi.ICore,
        protected BooksService: Jsonapi.IService,
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
                // localfilter: filter,
                // remotefilter: {
                //     date: {
                //         since: '1983-01-01',
                //         until: '2010-01-01'
                //     }
                // },
                // page: { number: 2 },
                // storage_ttl: 15,
                include: ['authors']
            },
            success => {
                console.log('success books controller', success, this.books);
            },
            error => {
                console.log('error books controller', error);
            }
        );
    }

    public $onInit() {

    }

    public delete(book: Jsonapi.IResource) {
        this.BooksService.delete(book.id);
    }
}

export class Books {
    public templateUrl = 'books/books.html';
    public controller = BooksController;
};
