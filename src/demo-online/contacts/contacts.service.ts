import * as Jsonapi from '../../library/index';

export class ContactsService extends Jsonapi.Service {
    type = 'contacts';
    public schema: Jsonapi.ISchema = {
        attributes: {
            date_published: { },
            title: { presence: true, length: { maximum: 96 } },
            created_at: { },
            updated_at: { }
        },
        relationships: {
            // user: {
            //     hasMany: false
            // },
            // photos: {
            //     hasMany: true
            // }
        },
        ttl: 10
    };
}
