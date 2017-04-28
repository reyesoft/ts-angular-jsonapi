/// <reference path="../_all.ts" />

import * as Jsonapi from '../../library/index';

export class AuthorsService extends Jsonapi.Service {
    type = 'authors';
    public schema: Jsonapi.ISchema = {
        attributes: {
            name: { presence: true, length: { maximum: 96 } },
            date_of_birth: { default: '1993-12-10'},
            date_of_death: {},
            created_at: {},
            updated_at: {}
        },
        relationships: {
            books: {
                hasMany: true
            },
            photos: {
                hasMany: true
            }
        },
        ttl: 10
    };
}
