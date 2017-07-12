import * as Jsonapi from '../../library/index';

export class UsersService extends Jsonapi.Service {
    type = 'users';
    public schema: Jsonapi.ISchema = {
        attributes: {
            firstname: { },
            surname: { }
        },
        relationships: {
            contacts: {
                hasMany: true
            }
        },
        ttl: 10
    };
}
