import {ISchema} from '../interfaces/schema.d';
import {ICollection} from '../interfaces/collection.d';

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

    static newCollection(): ICollection {
        return Object.defineProperties({}, {
            '$length': {
                get: function() { return Object.keys(this).length; },
                enumerable: false
            },
            '$isloading': { value: false, enumerable: false, writable: true },
            '$source': { value: '', enumerable: false, writable: true  },
            '$cache_last_update': { value: 0, enumerable: false, writable: true  }
        });
    }
}
