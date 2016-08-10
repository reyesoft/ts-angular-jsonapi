/// <reference path="../_all.ts" />

import { Jsonapi } from '../../library/index';

export class PhotosService extends Jsonapi.Resource {
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
