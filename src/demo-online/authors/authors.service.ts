import * as Jsonapi from '../../library/index';

export class AuthorsService extends Jsonapi.Service {
    type = 'authors';
    public schema: Jsonapi.ISchema = {
        attributes: {
            name: { }
        },
        relationships: {
        },
        ttl: 10
    };
}
