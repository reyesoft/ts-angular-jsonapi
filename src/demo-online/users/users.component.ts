import * as Jsonapi from '../../library/index';

class UsersController implements ng.IController {
    public users: Jsonapi.ICollection;

    /** @ngInject */
    constructor(
        protected JsonapiCore: Jsonapi.ICore,
        protected UsersService: Jsonapi.IService
    ) {
        UsersService.register();
        this.users = UsersService.all(
            // { include: ['contacts', 'photos'] },
            success => {
                console.log('success users controll', this.users);
            },
            error => {
                console.log('error users controll', error);
            }
        );
    }

    public $onInit() {

    }

    public delete (user: Jsonapi.IResource) {
        console.log('eliminaremos (no soportado en este ejemplo)', user.toObject());
        this.UsersService.delete(
            user.id,
            success => {
                console.log('deleted', success);
            }
        );
    }
}

export class Users {
    public templateUrl = 'users/users.html';
    public controller = UsersController;
};
