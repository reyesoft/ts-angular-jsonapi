import * as Jsonapi from '../../library/index';

class AuthorsController {
    public authors: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
        protected JsonapiCore,
        protected AuthorsService: Jsonapi.IResource
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

    public delete (author: Jsonapi.IResource) {
        console.log('eliminaremos (no soportado en este ejemplo)', author.toObject());
        this.AuthorsService.delete(
            author.id,
            success => {
                console.log('deleted', success);
            }
        );
    }
}

export const Authors = {
    templateUrl: 'demo/authors/authors.html',
    controller: AuthorsController
    // bindings: {
    //   completedCount: '<',
    //   activeCount: '<',
    //   selectedFilter: '<filter',
    //   onClearCompleted: '&',
    //   onShow: '&'
    // }
};
