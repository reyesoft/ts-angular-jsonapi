import * as Jsonapi from '../interfaces';

export class Filter {
    public passFilter(resource: Jsonapi.IResource, filter): boolean {
        for (let attribute in filter) {
            if (typeof filter[attribute] === 'object') {
                // its a regular expression
                return filter[attribute].test(resource.attributes[attribute]);
            } else if (typeof resource.attributes[attribute] === 'string') {
                // just a string
                return (resource.attributes[attribute] === filter[attribute]);
            }
        }
        return false;
    }
}
