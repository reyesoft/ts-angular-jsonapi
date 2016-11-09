import { Core } from '../core';
import { Resource } from '../resource';
import * as Jsonapi from '../interfaces';
import { Base } from '../services/base';

export class Converter {

    /**
    Convert json arrays (like included) to an Resources arrays without [keys]
    **/
    static json_array2resources_array(
        json_array: Array<IDataResource>,
        destination_array?: Object, // Array<Jsonapi.IResource>,
        use_id_for_key = false
    ): Object { // Array<Jsonapi.IResource> {
        if (!destination_array) {
            destination_array = [];
        }
        let count = 0;
        for (let data of json_array) {
            let resource = Converter.json2resource(data, false);
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
        json_array: Array<IDataResource>,
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

    static json2resource(json_resource: IDataResource, instance_relationships): Jsonapi.IResource {
        let resource_service = Converter.getService(json_resource.type);
        if (resource_service) {
            return Converter.procreate(resource_service, json_resource);
        } else {
            // service not registered
            console.warn('`' + json_resource.type + '`', 'service not found on json2resource()');
            let temp = new Resource();
            temp.id = json_resource.id;
            temp.type = json_resource.type;
            return temp;
        }
    }

    static getService(type: string): any {
        let resource_service = Core.Me.getResource(type);
        if (angular.isUndefined(resource_service)) {
            console.warn('`' + type + '`', 'service not found on getService()');
        }
        return resource_service;
    }

    /* return a resource type(resoruce_service) with data(data) */
    static procreate(resource_service: Jsonapi.IResource, data: IDataResource): Jsonapi.IResource {
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

    static build(
        document_from: Jsonapi.ICollection & IDataObject,
        resource_dest: Jsonapi.IResource | Jsonapi.ICollection,
        schema: Jsonapi.ISchema
    ) {
        // instancio los include y los guardo en included arrary
        let included_resources = {};
        if ('included' in document_from) {
            included_resources = Converter.json_array2resources_array_by_type(document_from.included, false);
        }

        if (angular.isArray(document_from.data)) {
            Converter._buildResources(document_from, <Jsonapi.ICollection>resource_dest, schema, included_resources);
        } else {
            Converter._buildResource(document_from.data, <Jsonapi.IResource>resource_dest, schema, included_resources);
        }
    }

    static _buildResources(
        document_from: Jsonapi.ICollection,
        resource_dest: Jsonapi.ICollection,
        schema: Jsonapi.ISchema,
        included_resources: Object
    ) {
        for (let data of document_from.data) {
            let resource = Converter.getService(data.type);
            if (!(data.id in resource_dest)) {
                resource_dest[data.id] = new (<any>resource.constructor)();
                resource_dest[data.id].reset();
            }
            Converter._buildResource(data, resource_dest[data.id], schema, included_resources);
        }
    }

    static _buildResource(
        document_from: IDataResource,
        resource_dest: Jsonapi.IResource,
        schema: Jsonapi.ISchema,
        included_resources: Object
    ) {
        resource_dest.attributes = document_from.attributes;
        resource_dest.id = document_from.id;
        resource_dest.is_new = false;
        Converter.__buildRelationships(document_from.relationships, resource_dest.relationships, included_resources, schema);
    }

    static __buildRelationships(
        relationships_from: Array<any>,
        relationships_dest: Array<any>,
        included_resources: Object,
        schema: Jsonapi.ISchema
    ) {
        // recorro los relationships levanto el service correspondiente
        angular.forEach(relationships_from, (relation_from_value: IDataCollection & IDataObject, relation_key) => {

            // relation is in schema? have data or just links?
            if (!(relation_key in relationships_dest) && ('data' in relation_from_value)) {
                relationships_dest[relation_key] = { data: Base.newCollection() };
            }

            // sometime data=null or simple { }
            if (!relation_from_value.data) {
                return ;
            }

            if (schema.relationships[relation_key] && schema.relationships[relation_key].hasMany) {
                // hasMany

                if (relation_from_value.data.length < 1) {
                    return ;
                }
                let resource_service = Converter.getService(relation_from_value.data[0].type);
                if (resource_service) {
                    let tmp_relationship_data = Base.newCollection();
                    angular.forEach(relation_from_value.data, (relation_value: IDataResource) => {
                        let tmp = Converter.__buildRelationship(relation_value, included_resources);

                        // sometimes we have a cache like a services
                        if (!('attributes' in tmp)
                            && tmp.id in relationships_dest[relation_key].data
                            && 'attributes' in relationships_dest[relation_key].data[tmp.id]
                        ) {
                            tmp_relationship_data[tmp.id] = relationships_dest[relation_key].data[tmp.id];
                        } else {
                            tmp_relationship_data[tmp.id] = tmp;
                        }
                    });
                    relationships_dest[relation_key].data = tmp_relationship_data;
                }
            } else {
                // hasOne

                // new related resource <> cached related resource <> ? delete!
                if (
                    relationships_dest[relation_key].data == null ||
                    relation_from_value.data.id !== relationships_dest[relation_key].data.id
                ) {
                    relationships_dest[relation_key].data = {};
                }

                // trae datos o cambió resource? actualizamos!
                if (
                    'attributes' in relation_from_value.data ||
                    relationships_dest[relation_key].data.id !== relation_from_value.data.id
                ) {
                    let tmp = Converter.__buildRelationship(relation_from_value.data, included_resources);
                    relationships_dest[relation_key].data = tmp;
                }
            }
        });
    }

    static __buildRelationship(relation: IDataResource, included_array): Jsonapi.IResource | IDataResource {
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
