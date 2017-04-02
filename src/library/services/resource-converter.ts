import { Core } from '../core';
import { Resource } from '../resource';
import * as Jsonapi from '../interfaces';
import { ResourceRelationshipsConverter } from './resource-relationships-converter';

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
        // sometime get Cannot set property 'number' of undefined (page)
        if (resource_dest.page && document_from['meta']) {
            resource_dest.page.number = document_from['meta']['page'] ? document_from['meta']['page'] : 1;
            resource_dest.page.
                resources_per_page = document_from['meta']['resources_per_page'] ? document_from['meta']['resources_per_page'] : null;
            resource_dest.page.total_resources = document_from['meta']['total_resources'] ? document_from['meta']['total_resources'] : null;
        }

        // convert and add new dataresoures to final collection
        let dataresource: IDataResource;
        let new_ids = {};
        for (dataresource of document_from.data) {
            let service = Converter.getService(dataresource.type);
            if (!(dataresource.id in resource_dest)) {
                resource_dest[dataresource.id] = new (<any>service.constructor)();
                resource_dest[dataresource.id].reset();
            }
            Converter._buildResource(dataresource, resource_dest[dataresource.id], schema, included_resources);
            new_ids[dataresource.id] = dataresource.id;
        }

        /*
        remove old members of collection (bug, for example, when request something like orders/10/details and has new ids)
        */
        angular.forEach(resource_dest, resource => {
            if (!(resource.id in new_ids)) {
                delete resource_dest[resource.id];
            }
        });
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

        let relationships_converter = new ResourceRelationshipsConverter(
            Converter.getService,
            document_from.relationships,
            resource_dest.relationships,
            included_resources,
            schema
        );
        relationships_converter.buildRelationships();
    }
}
