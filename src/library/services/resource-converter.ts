import { Core } from '../core';
import { Resource } from '../resource';
import * as Jsonapi from '../interfaces';
import { ResourceRelationshipsConverter } from './resource-relationships-converter';

export class Converter {

    /**
    Convert json arrays (like included) to an Resources arrays without [keys]
    **/
    private static json_array2resources_array(
        json_array: Array<IDataResource>,
        destination_array: Jsonapi.IResourcesById = {}
    ): void {
        for (let data of json_array) {
            let resource = Converter.json2resource(data, false);
            destination_array[resource.type + '_' + resource.id] = resource;
        }
    }

    /**
    Convert json arrays (like included) to an indexed Resources array by [type][id]
    **/
    static json_array2resources_array_by_type (
        json_array: Array<IDataResource>
    ): Jsonapi.IResourcesByType {
        let all_resources: Jsonapi.IResourcesById = {};
        let resources_by_type: Jsonapi.IResourcesByType = {};

        Converter.json_array2resources_array(json_array, all_resources);
        angular.forEach(all_resources, (resource: Jsonapi.IResource) => {
            if (!(resource.type in resources_by_type)) {
                resources_by_type[resource.type] = {};
            }
            resources_by_type[resource.type][resource.id] = resource;
        });
        return resources_by_type;
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

    static newResource(type: string, id: string): Jsonapi.IResource {
        if (Converter.getService(type).memorycache && id in Converter.getService(type).memorycache.resources) {
            return Converter.getService(type).memorycache.resources[id];
        } else {
            return Converter.getService(type).new(id);
        }
    }

    /* return a resource type(resoruce_service) with data(data) */
    private static procreate(resource_service: Jsonapi.IResource, data: IDataResource): Jsonapi.IResource {
        if (!('type' in data && 'id' in data)) {
            console.error('Jsonapi Resource is not correct', data);
        }

        let resource: Jsonapi.IResource;
        if (data.id in Converter.getService(data.type).memorycache.resources) {
            resource = Converter.getService(data.type).memorycache.resources[data.id];
        } else {
            resource = Converter.newResource(data.type, data.id);
        }

        resource.attributes = data.attributes ? data.attributes : {};
        resource.is_new = false;
        return resource;
    }

    public static build(
        document_from: Jsonapi.ICollection & IDataObject,
        resource_dest: Jsonapi.IResource | Jsonapi.ICollection,
        schema: Jsonapi.ISchema
    ) {
        // instancio los include y los guardo en included arrary
        let included_resources: Jsonapi.IResourcesByType = {};
        if ('included' in document_from) {
            included_resources = Converter.json_array2resources_array_by_type(document_from.included);
        }

        if (angular.isArray(document_from.data)) {
            Converter._buildCollection(document_from, <Jsonapi.ICollection>resource_dest, schema, included_resources);
        } else {
            Converter._buildResource(document_from.data, <Jsonapi.IResource>resource_dest, schema, included_resources);
        }
    }

    private static _buildCollection(
        collection_data_from: IDataCollection,
        collection_dest: Jsonapi.ICollection,
        schema: Jsonapi.ISchema,
        included_resources: Jsonapi.IResourcesByType
    ) {
        // sometime get Cannot set property 'number' of undefined (page)
        if (collection_dest.page && collection_data_from['meta']) {
            collection_dest.page.number = collection_data_from['meta']['page'] || 1;
            collection_dest.page.resources_per_page = collection_data_from['meta']['resources_per_page'] || null;
            collection_dest.page.total_resources = collection_data_from['meta']['total_resources'] || null;
        }

        // convert and add new dataresoures to final collection
        let new_ids = {};
        for (let dataresource of collection_data_from.data) {
            if (!(dataresource.id in collection_dest)) {
                collection_dest[dataresource.id] = Converter.newResource(dataresource.type, dataresource.id);
            }
            Converter._buildResource(dataresource, collection_dest[dataresource.id], schema, included_resources);
            new_ids[dataresource.id] = dataresource.id;
        }

        // remove old members of collection (bug, for example, when request something like orders/10/details and has new ids)
        angular.forEach(collection_dest, resource => {
            if (!(resource.id in new_ids)) {
                delete collection_dest[resource.id];
            }
        });
    }

    private static _buildResource(
        resource_data_from: IDataResource,
        resource_dest: Jsonapi.IResource,
        schema: Jsonapi.ISchema,
        included_resources: Jsonapi.IResourcesByType
    ) {
        resource_dest.attributes = resource_data_from.attributes;
        resource_dest.id = resource_data_from.id;
        resource_dest.is_new = false;

        let relationships_converter = new ResourceRelationshipsConverter(
            Converter.getService,
            resource_data_from.relationships,
            resource_dest.relationships,
            included_resources,
            schema
        );
        relationships_converter.buildRelationships();
    }
}
