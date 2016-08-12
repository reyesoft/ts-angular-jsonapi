import * as Jsonapi from '../interfaces';

export class Filter {
    public passFilter(resource: Jsonapi.IResource, filter): boolean {
        for (let attribute in  filter) {
            if (attribute in resource.attributes && resource.attributes[attribute] === filter[attribute]) {
                return true;
            }
        }
        return false;
    }
}
