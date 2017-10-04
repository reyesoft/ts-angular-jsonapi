import * as angular from 'angular';
import 'angular-ui-router';
import * as Jsonapi from '../../library/index';

export class AuthorController implements ng.IController {
    public author: Jsonapi.IResource;
    public relatedbooks: Array<Jsonapi.IResource>;

    /** @ngInject */
    constructor(
        protected AuthorsService: Jsonapi.IService,
        protected BooksService: Jsonapi.IService,
        protected $stateParams
    ) {
        this.author = AuthorsService.get(
            $stateParams.authorId,
            { include: ['books', 'photos'] },
            success => {
                this.author.attributes.name = this.author.attributes.name + 'x';
                this.author.save();
                console.info('success authors controller', success);
            },
            error => {
                console.error('error authors controller', error);
            }
        );

        this.relatedbooks = BooksService.all(
            { beforepath: 'authors/' + $stateParams.authorId },
            () => {
                console.info('Books from authors relationship', this.relatedbooks);
            }
        );
    }

    public $onInit() {

    }

    /*
    Add a new author
    */
    public new() {
        let author = this.AuthorsService.new();
        author.attributes.name = 'Pablo Reyes';
        author.attributes.date_of_birth = '2030-12-10';
        angular.forEach(this.relatedbooks, (book: Jsonapi.IResource) => {
            author.addRelationship(book /* , 'handbook' */);
        });
        console.log('new save', author.toObject());
        // author.save( /* { include: ['book'] } */ );
    }

    /*
    Update name for actual author
    */
    public update() {
        this.author.attributes.name += 'o';
        this.author.save(
            // { include: ['books'] }
        );
        console.log('update save with book include', this.author.toObject({ include: ['books'] }));
        console.log('update save without any include', this.author.toObject());
    }

    public removeRelationship() {
        this.author.removeRelationship('photos', '1');
        this.author.save();
        console.log('removeRelationship save with photos include', this.author.toObject());
    }
}

export class Author {
    templateUrl = 'authors/author.html';
    controller = AuthorController;
}
