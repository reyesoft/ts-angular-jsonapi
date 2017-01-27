import { ISchema, ICollection, IParamsCollection, IParamsResource } from '../interfaces';
import { Page } from './page';

export class Base {
    static Params: IParamsCollection | IParamsResource = {
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
            '$cache_last_update': { value: 0, enumerable: false, writable: true  },
            'page': { value: new Page(), enumerable: false, writable: true  }
        });
    }

    static newResource(): ICollection {
        return Object.defineProperties({}, {
            '$isloading': { value: false, enumerable: false, writable: true }
        });
    }
}
