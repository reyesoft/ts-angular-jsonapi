import * as Jsonapi from '../../library/index';

class NoDuplicatedHttpCallsComponent {
    public authors: Array<Jsonapi.ICollection> = [];

    /** @ngInject */
    constructor(
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
}

export const NoDuplicatedHttpCalls = {
    templateUrl: 'demo/tests/noduplicatedhttpcalls.html',
    controller: NoDuplicatedHttpCallsComponent
};
