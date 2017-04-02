import * as Jsonapi from '../../library/index';

class PhotosController {
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

    public makeRequest(id) {
        this.photos = this.PhotosService.all(
            succes => {
                console.log('photos success', id, this.photos);
            }
        );
    }
}

export const Photos = {
    templateUrl: 'demo/photos/photos.html',
    controller: PhotosController
};
