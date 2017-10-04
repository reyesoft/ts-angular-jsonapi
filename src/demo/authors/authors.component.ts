import * as Jsonapi from '../../library/index';

export class AuthorsController implements ng.IController {
    public authors: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
        protected JsonapiCore: Jsonapi.ICore,
        protected AuthorsService: Jsonapi.IService
    ) {
        this.authors = AuthorsService.all(
            // { include: ['books', 'photos'] },
            success => {
                console.log('success authors controll', this.authors);
            },
            error => {
                console.log('error authors controll', error);
            }
        );
    }

    public $onInit() {

    }

    public delete(author: Jsonapi.IResource) {
        console.log('eliminaremos (no soportado en este ejemplo)', author.toObject());
        this.AuthorsService.delete(
            author.id,
            success => {
                console.log('deleted', success);
            }
        );
    }
}

export class Authors {
    public templateUrl = 'authors/authors.html';
    public controller = AuthorsController;
}
