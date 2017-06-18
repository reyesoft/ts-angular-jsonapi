import * as Jsonapi from '../../library/index';

class PhotosController implements ng.IController {
    public photos: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
        protected PhotosService: Jsonapi.IService
    ) {
        // if you check your console, library make only one request
        this.makeRequest(1);
        this.makeRequest(2);
        this.makeRequest(3);
        this.makeRequest(4);
        this.makeRequest(5);
    }

    public $onInit() {

    }

    public makeRequest(id) {
        this.photos = this.PhotosService.all(
            succes => {
                console.log('photos success', id, this.photos);
            }
        );
    }
}

export class Photos {
    public templateUrl = 'demo/photos/photos.html';
    public controller = PhotosController;
};
