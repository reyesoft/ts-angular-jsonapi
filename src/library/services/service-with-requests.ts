import { Base } from '../services/base';
import { IParamsResource } from '../interfaces';

export abstract class ServiceWithRequests {
    /**
    This method sort params for all(), get(), delete() and save()
    */
    protected __exec(id: string, params: IParamsResource, fc_success, fc_error, exec_type: string): any {
        // makes `params` optional
        if (angular.isFunction(params)) {
            fc_error = fc_success;
            fc_success = params;
            params = angular.extend({}, Base.Params);
        } else {
            if (angular.isUndefined(params)) {
                params = angular.extend({}, Base.Params);
            } else {
                params = angular.extend({}, Base.Params, params);
            }
        }

        fc_success = angular.isFunction(fc_success) ? fc_success : angular.noop();
        fc_error = angular.isFunction(fc_error) ? fc_error : undefined;
    }

    protected runFc(some_fc, param) {
        return angular.isFunction(some_fc) ? some_fc(param) : angular.noop();
    }

}
