import * as Jsonapi from '../../library/index';

class BooksController {
    public books: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
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

                // TEST 1
                // this test merge data with cache (this not include author or photos)
                console.log('book#1', (<IDataResource>this.books[1].relationships.author.data).attributes);
                // this.books = this.BooksService.all();

                // TEST 2
                // let book1 = this.BooksService.get(1,
                //     success => {
                //         book1.attributes.title += ' :)'; // update view
                //         console.log('book1', (<IDataResource>book1.relationships.author.data).attributes);
                //     });
            },
            error => {
                console.log('error books controller', error);
            }
        );
    }

    public do() {
        this.BooksService.all();
    }

    public delete(book: Jsonapi.IResource) {
        this.BooksService.delete(book.id);
    }
}

export const Books = {
    templateUrl: 'demo/books/books.html',
    controller: BooksController
};
