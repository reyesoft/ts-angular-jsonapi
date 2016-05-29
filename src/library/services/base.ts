module Jsonapi {
    export class Base {
        static Params: Jsonapi.IParams = {
            id: '',
            include: []
        };

        static Schema = {
            attributes: {},
            relationships: {}
        };
    }
}
