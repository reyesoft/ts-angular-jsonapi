export class AppController {
    constructor(
        protected JsonapiCore,
        protected AuthorsService,
        protected BooksService,
        protected PhotosService,
        protected $scope
    ) {
        let self = this;
        $scope.loading  = false;

        // bootstrap all services
        AuthorsService.register();
        BooksService.register();
        PhotosService.register();

        JsonapiCore.loadingsStart = () => {
            self.$scope.loading = 'LOADING...';
        };
        JsonapiCore.loadingsDone = () => {
            self.$scope.loading = '';
        };
        JsonapiCore.loadingsOffline = (error) => {
            self.$scope.loading = 'No connection!!!';
        };
        JsonapiCore.loadingsError = (error) => {
            self.$scope.loading = 'No connection 2!!!';
        };
    }
}

export const App = {
    templateUrl: 'demo/containers/app.html',
    controller: AppController,
    transclude: true
};
