import * as Jsonapi from '../../library/index';

export class BookController {
    public book: any = null;

    /** @ngInject */
    constructor(
        protected BooksService: Jsonapi.IService,
        protected $stateParams
    ) {
        this.book = BooksService.get(
            $stateParams.bookId,
            { include: ['author', 'photos'] },
            success => {
                console.log('success book       ', this.book);
                // console.log('success book object', this.book.toObject({ include: ['authors', 'photos'] }));
                // console.log('success book relationships', this.book.toObject({ include: ['authors', 'photos'] }).data.relationships);
                // console.log('success book included', this.book.toObject({ include: ['authors', 'photos'] }).included);
            },
            error => {
                console.log('error books controll', error);
            }
        );
    }
}

export const Book = {
    templateUrl: 'demo/books/book.html',
    controller: BookController
};
