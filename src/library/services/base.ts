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
                get: function() {
                    return Object.keys(this).length * 1;
                },
                enumerable: false
            },
            '$toArray': {
                get: function() {
                    let self = this;
                    return Object.keys(this).map(function (key) {
                        return self[key];
                        // var value = self[key];
                        // return Object.defineProperty(value, '$key', { enumerable: false, value: key + 5});
                    });
                },
                enumerable: false
            },
            '$is_loading': { value: false, enumerable: false, writable: true },
            '$source': { value: '', enumerable: false, writable: true  },
            '$cache_last_update': { value: 0, enumerable: false, writable: true  },
            'page': { value: new Page(), enumerable: false, writable: true  }
        });
    }

    static isObjectLive(ttl: number, last_update: number) {
        return (ttl >= 0 && Date.now() <= (last_update + ttl * 1000));
    }
}
