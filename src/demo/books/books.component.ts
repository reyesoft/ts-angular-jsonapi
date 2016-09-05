import * as Jsonapi from '../../library/index';

class BooksController {
    public books: any = null;

    /** @ngInject */
    constructor(
        protected BooksService: Jsonapi.IResource
    ) {
        this.books = BooksService.all(
            {
                // filter: { title : 'The Hobbit' },
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
