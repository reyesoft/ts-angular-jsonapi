/// <reference path="./index.d.ts" />

// import * as Jsonapi from './core';
import { Core } from './core';
import { Base } from './services/base';
import { ParentResourceService } from './parent-resource-service';
import { PathBuilder } from './services/path-builder';
// import { UrlParamsBuilder } from './services/url-params-builder';
import { Converter } from './services/resource-converter';

import { IAttributes, IResource, ICollection, IExecParams, IParamsResource } from './interfaces';
import { IRelationships, IRelationship } from './interfaces';

export class Resource extends ParentResourceService implements IResource {
    public is_new = true;
    public is_loading = false;
    public is_saving = false;

    public id: string = '';
    public type: string = '';
    public attributes: IAttributes = {};
    public relationships: IRelationships = {};

    public reset(): void {
        this.id = '';
        this.attributes = {};
        angular.forEach(this.getService().schema.attributes, (value, key) => {
            this.attributes[key] = ('default' in value) ? value.default : undefined;
        });
        this.relationships = {};
        angular.forEach(this.getService().schema.relationships, (value, key) => {
            this.relationships[key] = <IRelationship>{ data: {} };
            if (this.getService().schema.relationships[key].hasMany) {
                this.relationships[key].data = Base.newCollection();
            }
        });
        this.is_new = true;
    }

    public toObject(params?: IParamsResource): IDataObject {
        params = angular.extend({}, Base.Params, params);
        this.getService().schema = angular.extend({}, Base.Schema, this.getService().schema);

        let relationships = { };
        let included = [ ];
        let included_ids = [ ]; // just for control don't repeat any resource

        // REALTIONSHIPS
        angular.forEach(this.relationships, (relationship: IRelationship, relation_alias) => {

            if (this.getService().schema.relationships[relation_alias] && this.getService().schema.relationships[relation_alias].hasMany) {
                // has many (hasMany:true)
                relationships[relation_alias] = { data: [] };

                angular.forEach(relationship.data, (resource: IResource) => {
                    let reational_object = { id: resource.id, type: resource.type };
                    relationships[relation_alias]['data'].push(reational_object);

                    // no se agregó aún a included && se ha pedido incluir con el parms.include
                    let temporal_id = resource.type + '_' + resource.id;
                    if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relation_alias) !== -1) {
                        included_ids.push(temporal_id);
                        included.push(resource.toObject({ }).data);
                    }
                });
            } else {
                // has one (hasMany:false)

                let relationship_data = (<IResource>relationship.data);
                if (!('id' in relationship.data) && !angular.equals({}, relationship.data)) {
                    console.warn(relation_alias + ' defined with hasMany:false, but I have a collection');
                }

                if (relationship_data.id && relationship_data.type) {
                    relationships[relation_alias] = { data: { id: relationship_data.id, type: relationship_data.type } };
                } else {
                    relationships[relation_alias] = { data: { } };
                }

                // no se agregó aún a included && se ha pedido incluir con el parms.include
                let temporal_id = relationship_data.type + '_' + relationship_data.id;
                if (included_ids.indexOf(temporal_id) === -1 && params.include.indexOf(relationship_data.type) !== -1) {
                    included_ids.push(temporal_id);
                    included.push(relationship_data.toObject({ }).data);
                }
            }
        });

        let ret: IDataObject = {
            data: {
                type: this.type,
                id: this.id,
                attributes: this.attributes,
                relationships: relationships
            }
        };

        if (included.length > 0) {
            ret.included = included;
        }

        return ret;
    }

    public save<T extends IResource>(params?: Object | Function, fc_success?: Function, fc_error?: Function): Array<T> {
        // return this.__exec(null, params, fc_success, fc_error, 'save');
        return this.__exec({ id: null, params: params, fc_success: fc_success, fc_error: fc_error, exec_type: 'save' });
    }

    /**
    This method sort params for all(), get(), delete() and save()
    */
    protected __exec(exec_params: IExecParams): any {
        super.__exec(exec_params);

        switch (exec_params.exec_type) {
            case 'save':
            return this._save(exec_params.params, exec_params.fc_success, exec_params.fc_error);
        }
    }

    private _save(params: IParamsResource, fc_success: Function, fc_error: Function): IResource {
        if (this.is_saving || this.is_loading) {
            return ;
        }
        this.is_saving = true;

        let object = this.toObject(params);

        // http request
        let path = new PathBuilder();
        path.appendPath(this.getService().getPrePath());
        path.appendPath(this.getService().getPath());
        this.id && path.appendPath(this.id);
        params.include ? path.setInclude(params.include) : null;

        let resource = Converter.newResource(this.type, this.id);

        let promise = Core.Services.JsonapiHttp.exec(
            path.get(), this.id ? 'PUT' : 'POST',
            object, !(angular.isFunction(fc_error))
        );

        promise.then(
            success => {
                this.is_saving = false;

                // foce reload cache (for example, we add a new element)
                if (!this.id) {
                    this.getService().memorycache.clearAllCollections();
                }

                // is a resource?
                if ('id' in success.data.data) {
                    this.id = success.data.data.id;
                    Converter.build(success.data, this, this.getService().schema);
                    /*
                    Si lo guardo en la caché, luego no queda bindeado con la vista
                    Usar {{ $ctrl.service.getCachedResources() | json }}, agregar uno nuevo, editar
                    */
                    // this.getService().memorycache.setResource(this);
                } else if (angular.isArray(success.data.data)) {
                    console.warn('Server return a collection when we save()', success.data.data);

                    /*
                    we request the service again, because server maybe are giving
                    us another type of resource (getService(resource.type))
                    */
                    let tempororay_collection = this.getService().memorycache.getCollection('justAnUpdate');
                    Converter.build(success.data, tempororay_collection, this.getService().schema);
                    angular.forEach(tempororay_collection, (resource_value: IResource, key: string) => {
                        let res = Converter.getService(resource_value.type).memorycache.resources[resource_value.id];
                        Converter.getService(resource_value.type).memorycache.setResource(resource_value);
                        res.id = res.id + 'x';
                    });

                    console.warn('Temporal collection for a resource_value update', tempororay_collection);
                }

                this.runFc(fc_success, success);
            },
            error => {
                this.is_saving = false;

                this.runFc(fc_error, 'data' in error ? error.data : error);
            }
        );

        return resource;
    }

    public addRelationship<T extends IResource>(resource: T, type_alias?: string) {
        let object_key = resource.id;
        if (!object_key) {
            object_key = 'new_' + (Math.floor(Math.random() * 100000));
        }

        type_alias = (type_alias ? type_alias : resource.type);
        if (!(type_alias in this.relationships)) {
            this.relationships[type_alias] = { data: { } };
        }

        if (type_alias in this.getService().schema.relationships && this.getService().schema.relationships[type_alias].hasMany) {
            this.relationships[type_alias]['data'][object_key] = resource;
        } else {
            this.relationships[type_alias]['data'] = resource;
        }
    }

    public addRelationships(resources: ICollection, type_alias: string) {
        if (!(type_alias in this.relationships)) {
            this.relationships[type_alias] = { data: { } };
        } else {
            // we receive a new collection of this relationship. We need remove old (if don't exist on new collection)
            angular.forEach(this.relationships[type_alias]['data'], (resource) => {
                if (!(resource.id in resources)) {
                    delete this.relationships[type_alias]['data'][resource.id];
                }
            });
        }

        angular.forEach(resources, (resource) => {
            this.relationships[type_alias]['data'][resource.id] = resource;
        });
    }

    public addRelationshipsArray<T extends IResource>(resources: Array<T>, type_alias?: string): void {
        resources.forEach((item: IResource) => {
            this.addRelationship(item, type_alias || item.type);
        });
    }

    public removeRelationship(type_alias: string, id: string): boolean {
        if (!(type_alias in this.relationships)) {
            return false;
        }
        if (!('data' in this.relationships[type_alias])) {
            return false;
        }
        if (!(id in this.relationships[type_alias]['data'])) {
            return false;
        }
        delete this.relationships[type_alias]['data'][id];
        return true;
    }

    /**
    @return This resource like a service
    **/
    public getService() {
        return Converter.getService(this.type);
    }
}
