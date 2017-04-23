/// <reference path="../_all.ts" />

import * as Jsonapi from '../../library/index';

export class PhotosService extends Jsonapi.Service {
    type = 'photos';
    public schema: Jsonapi.ISchema = {
        attributes: {
            title: {},
            uri: {},
            imageable_id: {},
            created_at: {},
            updated_at: {}
        }
    };
}
