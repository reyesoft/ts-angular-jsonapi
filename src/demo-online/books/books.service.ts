import * as Jsonapi from '../../library/index';

export class BooksService extends Jsonapi.Service {
    type = 'books';
    public schema: Jsonapi.ISchema = {
        attributes: {
            title: { },
            pages: { }
        },
        relationships: {
            authors: {
                hasMany: true
            },
            publisher: {
                hasMany: false
            }
        },
        ttl: 10
    };
}
