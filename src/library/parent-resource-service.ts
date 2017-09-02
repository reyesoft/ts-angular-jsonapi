import * as angular from 'angular';
import { Base } from './services/base';
import { IResource, ICollection, IExecParams, IExecParamsProcessed } from './interfaces';

export class ParentResourceService {
    /*
    This method sort params for all(), get(), delete() and save()
    */
    protected proccess_exec_params(exec_params: IExecParams): IExecParamsProcessed {
        // makes `params` optional
        if (angular.isFunction(exec_params.params)) {
            exec_params.fc_error = exec_params.fc_success;
            exec_params.fc_success = <Function>exec_params.params;
            exec_params.params = angular.extend({}, Base.Params);
        } else {
            if (angular.isUndefined(exec_params.params)) {
                exec_params.params = angular.extend({}, Base.Params);
            } else {
                exec_params.params = angular.extend({}, Base.Params, exec_params.params);
            }
        }

        exec_params.fc_success = angular.isFunction(exec_params.fc_success) ? exec_params.fc_success : function() { /* */ };
        exec_params.fc_error = angular.isFunction(exec_params.fc_error) ? exec_params.fc_error : undefined;

        return <IExecParamsProcessed>exec_params; // @todo
    }

    protected runFc(some_fc, param) {
        return angular.isFunction(some_fc) ? some_fc(param) : angular.noop();
    }

}
