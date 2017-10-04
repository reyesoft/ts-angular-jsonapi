import * as Jsonapi from '../../library/index';

export class NoDuplicatedHttpCallsComponent implements ng.IController {
    public authors: Array<Jsonapi.ICollection> = [];

    /** @ngInject */
    public constructor(
        protected JsonapiCore,
        protected AuthorsService: Jsonapi.IService
    ) {
        for (let i = 1; i <= 3; i++) {
            this.authors[i] = AuthorsService.all(
                success => {
                    console.log('success authors request', i, this.authors);
                },
                error => {
                    console.log('error authors request', i, error);
                }
            );
        }
    }

    public $onInit() {

    }
}

export class NoDuplicatedHttpCalls {
    public templateUrl = 'tests/noduplicatedhttpcalls.html';
    public controller = NoDuplicatedHttpCallsComponent;
}
