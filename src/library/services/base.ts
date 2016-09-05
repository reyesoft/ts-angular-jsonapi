import {ISchema} from '../interfaces/schema.d';

export class Base {
    static Params: IParams = {
        id: '',
        include: []
    };

    static Schema: ISchema = {
        attributes: {},
        relationships: {},
        ttl: 0
    };
}
