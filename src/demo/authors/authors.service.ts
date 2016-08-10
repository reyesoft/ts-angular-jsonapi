/// <reference path="../_all.ts" />

import { Jsonapi } from '../../library/index';

export class AuthorsService extends Jsonapi.Resource {
    type = 'authors';
    public schema: Jsonapi.ISchema = {
        attributes: {
            name: { presence: true, length: { maximum: 96 } },
            date_of_birth: {},
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
        }
    };
}
