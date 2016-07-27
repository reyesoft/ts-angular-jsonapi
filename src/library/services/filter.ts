module Jsonapi {
    export class Filter {

        public passFilter(resource: IResource, filter): boolean {
            for (let attribute in  filter) {
                if (attribute in resource.attributes && resource.attributes[attribute] === filter[attribute]) {
                    return true;
                }
            }
            return false;
        }

    }
}
