import * as angular from 'angular';
import * as Jsonapi from '../interfaces';

export class LocalFilter {

    private passFilter(resource: Jsonapi.IResource, localfilter): boolean {
        for (let attribute in localfilter) {
            if (typeof resource !== 'object' || !('attributes' in resource)) {
                // is not a resource. Is an internal property, for example $source
                return true;
            } else if (typeof localfilter[attribute] === 'object') {
                // its a regular expression
                return localfilter[attribute].test(resource.attributes[attribute]);
            } else if (typeof resource.attributes[attribute] === 'string') {
                // just a string
                return (resource.attributes[attribute] === localfilter[attribute]);
            }
        }
        return false;
    }

    public filterCollection(collection: Jsonapi.ICollection, filter_object: object): Jsonapi.ICollection {
        if (filter_object && Object.keys(filter_object).length) {
            let localfilter = new LocalFilter();
            angular.forEach(collection, (resource, key) => {
                if (!localfilter.passFilter(resource, filter_object)) {
                    delete collection[key];
                }
            });
        }
        return collection;
    }
}
