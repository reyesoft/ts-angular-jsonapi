import * as Jsonapi from '../interfaces';
import { Base } from '../services/base';
// import { Converter } from './resource-converter';

export class ResourceRelationshipsConverter {
    private getService: Function;
    private relationships_from: Array<any>;
    private relationships_dest: Array<any>;
    private included_resources: Object;
    private schema: Jsonapi.ISchema;

    /** @ngInject */
    public constructor(
        getService: Function,
        relationships_from: Array<any>,
        relationships_dest: Array<any>,
        included_resources: Object,
        schema: Jsonapi.ISchema
    ) {
        this.getService = getService;
        this.relationships_from = relationships_from;
        this.relationships_dest = relationships_dest;
        this.included_resources = included_resources;
        this.schema = schema;
    }

    public buildRelationships() {
        // recorro los relationships levanto el service correspondiente
        angular.forEach(this.relationships_from, (relation_from_value: IDataCollection & IDataObject, relation_key) => {

            // relation is in schema? have data or just links?
            if (!(relation_key in this.relationships_dest) && ('data' in relation_from_value)) {
                this.relationships_dest[relation_key] = { data: Base.newCollection() };
            }

            // sometime data=null or simple { }
            if (!relation_from_value.data) {
                return ;
            }

            if (this.schema.relationships[relation_key] && this.schema.relationships[relation_key].hasMany) {
                // hasMany
                if (relation_from_value.data.length < 1) {
                    return ;
                }
                this.__buildRelationshipHasMany(
                    relation_from_value,
                    relation_key
                );
            } else {
                // hasOne
                this.__buildRelationshipHasOne(
                    relation_from_value,
                    relation_key
                );
            }
        });
    }

    private __buildRelationshipHasMany(
        relation_from_value: IDataCollection,
        relation_key: number
    ) {
        let resource_service = this.getService(relation_from_value.data[0].type);
        if (resource_service) {
            let tmp_relationship_data = Base.newCollection();
            angular.forEach(relation_from_value.data, (relation_value: IDataResource) => {
                let tmp = this.__buildRelationship(relation_value, this.included_resources);

                // sometimes we have a cache like a services
                if (!('attributes' in tmp)
                    && tmp.id in this.relationships_dest[relation_key].data
                    && 'attributes' in this.relationships_dest[relation_key].data[tmp.id]
                ) {
                    tmp_relationship_data[tmp.id] = this.relationships_dest[relation_key].data[tmp.id];
                } else {
                    tmp_relationship_data[tmp.id] = tmp;
                }
            });

            // REMOVE resources from cached collection
            // build an array with the news ids
            let new_ids = {};
            angular.forEach(relation_from_value.data, (data_resource: IDataResource) => {
                new_ids[data_resource.id] = true;
            });
            // check if new ids are on destination. If not, delete resource
            angular.forEach(this.relationships_dest[relation_key].data, (relation_dest_value: IDataResource) => {
                if (!(relation_dest_value.id in new_ids)) {
                    delete this.relationships_dest[relation_dest_value.id];
                }
            });

            this.relationships_dest[relation_key].data = tmp_relationship_data;
        }
    }

    private __buildRelationshipHasOne(
        relation_from_value: IDataObject,
        relation_key: number
    ) {
        // new related resource <> cached related resource <> ? delete!
        if (
            this.relationships_dest[relation_key].data == null ||
            relation_from_value.data.id !== this.relationships_dest[relation_key].data.id
        ) {
            this.relationships_dest[relation_key].data = {};
        }

        // trae datos o cambió resource? actualizamos!
        if (
            'attributes' in relation_from_value.data ||
            this.relationships_dest[relation_key].data.id !== relation_from_value.data.id
        ) {
            let tmp = this.__buildRelationship(relation_from_value.data, this.included_resources);
            this.relationships_dest[relation_key].data = tmp;
        }
    }

    private __buildRelationship(relation: IDataResource, included_array): Jsonapi.IResource | IDataResource {
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
