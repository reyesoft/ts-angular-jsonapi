import * as Jsonapi from '../../library/index';

export class PublishersService extends Jsonapi.Service {
    type = 'publishers';
    public schema: Jsonapi.ISchema = {
        attributes: {
            name: { }
        },
        relationships: {
        },
        ttl: 10
    };
}
