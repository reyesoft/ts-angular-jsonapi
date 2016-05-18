module Jsonapi {
    export class Converter {

        /**
        Convert json arrays (like included) to an Resources arrays without [keys]
        **/
        static json_array2resources_array(
            json_array: [Jsonapi.IDataResource],
            destination_array?: Object, // Array<Jsonapi.IResource>,
            use_id_for_key = false
        ): Object { // Array<Jsonapi.IResource> {
            if (!destination_array) {
                destination_array = [];
            }
            let count = 0;
            for (let data of json_array) {
                let resource = Jsonapi.Converter.json2resource(data, false);
                if (use_id_for_key) {
                    destination_array[resource.id] = resource;
                } else {
                    // included for example need a extra parameter
                    destination_array[resource.type + '_' + resource.id] = resource;
                    // destination_array.push(resource.id + resource.type);
                }
                count++;
            }
            destination_array['$count'] = count;
            return destination_array;
        }

        /**
        Convert json arrays (like included) to an indexed Resources array by [type][id]
        **/
        static json_array2resources_array_by_type (
            json_array: [Jsonapi.IDataResource],
            instance_relationships: boolean
        ): Object { // Array<Jsonapi.IResource> {
            let all_resources:any = { } ;
            Converter.json_array2resources_array(json_array, all_resources, false);
            let resources = { };
            angular.forEach(all_resources, (resource) => {
                if (!(resource.type in resources)) {
                    resources[resource.type] = { };
                }
                resources[resource.type][resource.id] = resource;
            });
            return resources;
        }

        static json2resource(json_resource: Jsonapi.IDataResource, instance_relationships): Jsonapi.IResource {
            let resource_service = Jsonapi.Converter.getService(json_resource.type);
            if (resource_service) {
                return Jsonapi.Converter.procreate(resource_service, json_resource);
            }
        }

        static getService(type: string): Jsonapi.IResource {
            let resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('Jsonapi Resource type `' + type + '` is not registered.');
            }
            return resource_service;
        }

        static procreate(resource_service: Jsonapi.IResource, data: Jsonapi.IDataResource): Jsonapi.IResource {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            let resource = new (<any>resource_service.constructor)();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes;
            resource.is_new = false;
            return resource;
        }

    }
}
