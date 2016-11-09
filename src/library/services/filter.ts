import * as Jsonapi from '../interfaces';

export class Filter {

    private passFilter(resource: Jsonapi.IResource, filter): boolean {
        for (let attribute in filter) {
            if (typeof resource !== 'object' || !('attributes' in resource)) {
                // is not a resource. Is an internal property, for example $source
                return true;
            } else if (typeof filter[attribute] === 'object') {
                // its a regular expression
                return filter[attribute].test(resource.attributes[attribute]);
            } else if (typeof resource.attributes[attribute] === 'string') {
                // just a string
                return (resource.attributes[attribute] === filter[attribute]);
            }
        }
        return false;
    }

    public filterCollection(collection: Jsonapi.ICollection, filter_object: any): Jsonapi.ICollection {
        if (filter_object && Object.keys(filter_object).length) {
            let filter = new Filter();
            angular.forEach(collection, (resource, key) => {
                if (!filter.passFilter(resource, filter_object)) {
                    delete collection[key];
                }
            });
        }
        return collection;
    }
}
