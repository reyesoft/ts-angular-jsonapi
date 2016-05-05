/// <reference path="./../_all.ts" />

module Jsonapi {
    export class ResourceMaker {

        static getService(type: string): Jsonapi.IResource {
            let resource_service = Jsonapi.Core.Me.getResource(type);
            if (angular.isUndefined(resource_service)) {
                console.warn('Jsonapi Resource type `' + type + '` is not definded.');
            }
            return resource_service;
        }

        static make(data: Jsonapi.IDataResource): Jsonapi.IResource {
            let resource_service = Jsonapi.ResourceMaker.getService(data.type);
            if (resource_service) {
                return Jsonapi.ResourceMaker.procreate(resource_service, data);
            }
        }

        static procreate(resource_service: Jsonapi.IResource, data: Jsonapi.IDataResource): Jsonapi.IResource {
            if (!('type' in data && 'id' in data)) {
                console.error('Jsonapi Resource is not correct', data);
            }
            let resource = new (<any>resource_service.constructor)();
            resource.new();
            resource.id = data.id;
            resource.attributes = data.attributes;
            return resource;
        }

    }
}
