module Jsonapi {
    export class Converter {

        /**
        Convert json arrays (like included) to an Resources arrays without [keys]
        **/
        static json_array2resources_array(
            json_array: Array<Jsonapi.IDataResource>,
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
            // destination_array['$count'] = count; // problem with toArray or angular.forEach need a !isObject
            return destination_array;
        }

        /**
        Convert json arrays (like included) to an indexed Resources array by [type][id]
        **/
        static json_array2resources_array_by_type (
            json_array: Array<Jsonapi.IDataResource>,
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
            } else {
                // service not registered
                console.warn('`' + json_resource.type + '`', 'service not found on json2resource()');
                let temp = new Jsonapi.Resource();
                temp.id = json_resource.id;
                temp.type = json_resource.type;
                return temp;
            }
        }

        static getService(type: string): Jsonapi.IResource {
            let resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('`' + type + '`', 'service not found on getService()');
            }
            return resource_service;
        }

        /* return a resource type(resoruce_service) with data(data) */
        static procreate(resource_service: Jsonapi.IResource, data: Jsonapi.IDataResource): Jsonapi.IResource {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            let resource = new (<any>resource_service.constructor)();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes ? data.attributes : {};
            resource.is_new = false;
            return resource;
        }

        static build(document_from: any, resource_dest: any, schema: ISchema) {
            // instancio los include y los guardo en included arrary
            let included = {};
            if ('included' in document_from) {
                included = Converter.json_array2resources_array_by_type(document_from.included, false);
            }

            if (angular.isArray(document_from.data)) {
                Converter._buildResources(document_from, resource_dest, schema, included);
            } else {
                Converter._buildResource(document_from.data, resource_dest, schema, included);
            }
        }

        static _buildResources(document_from: IDataCollection, resource_dest: Array<IDataCollection>, schema: ISchema, included) {
            for (let data of document_from.data) {
                let resource = Jsonapi.Converter.getService(data.type);
                if (!(data.id in resource_dest)) {
                    resource_dest[data.id] = new (<any>resource.constructor)();
                    resource_dest[data.id].reset();
                }
                Converter._buildResource(data, resource_dest[data.id], schema, included);
            }
        }

        static _buildResource(document_from: IDataResource, resource_dest: IResource, schema: ISchema, included) {
            resource_dest.attributes = document_from.attributes;
            resource_dest.id = document_from.id;
            resource_dest.is_new = false;
            Converter.__buildRelationships(document_from.relationships, resource_dest.relationships, included, schema);
        }

        static __buildRelationships(relationships_from: Array<any>, relationships_dest: Array<any>, included_array, schema: ISchema) {
            // recorro los relationships levanto el service correspondiente
            angular.forEach(relationships_from, (relation_value, relation_key) => {

                // relation is in schema? have data or just links?
                if (!(relation_key in relationships_dest) && ('data' in relation_value)) {
                    relationships_dest[relation_key] = { data: [] };
                }

                // sometime data=null or simple { }
                if (!relation_value.data)
                    return ;

                if (schema.relationships[relation_key] && schema.relationships[relation_key].hasMany) {
                    if (relation_value.data.length < 1)
                        return ;
                    let resource_service = Jsonapi.Converter.getService(relation_value.data[0].type);
                    if (resource_service) {
                        relationships_dest[relation_key].data = {}; // force to object (not array)
                        angular.forEach(relation_value.data, (relation_value: Jsonapi.IDataResource) => {
                            let tmp = Converter.__buildRelationship(relation_value, included_array);
                            relationships_dest[relation_key].data[tmp.id] = tmp;
                        });
                    }
                } else {
                    relationships_dest[relation_key].data = Converter.__buildRelationship(relation_value.data, included_array);
                }
            });
        }

        static __buildRelationship(relation: Jsonapi.IDataResource, included_array): Jsonapi.IResource | Jsonapi.IDataResource {
            if (relation.type in included_array &&
                relation.id in included_array[relation.type]
            ) {
                // it's in included
                return included_array[relation.type][relation.id];
            } else {
                // resource not included, return directly the object
                return relation;
            }
        }





    }
}
