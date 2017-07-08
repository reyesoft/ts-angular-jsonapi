class AppController implements ng.IController {
    /** @ngInject */
    constructor(
        protected JsonapiCore,
        protected AuthorsService,
        protected BooksService,
        protected PhotosService,
        protected $scope
    ) {
        let self = this;
        $scope.loading  = false;

        console.log('injected JsonapiCore?', JsonapiCore);

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

    public $onInit() {

    }
}

export class App implements ng.IComponentOptions {
    public templateUrl: string;
    public controller: ng.Injectable<ng.IControllerConstructor> = AppController;
    public transclude: boolean;

    constructor() {
        this.templateUrl = 'demo/containers/app.html';
        this.transclude = true;
    }
};
