import * as angular from 'angular';
import 'angular-ui-router';
import * as Jsonapi from '../../library/index';

class UserController implements ng.IController {
    public user: Jsonapi.IResource;
    public relatedcontacts: Jsonapi.IResource[];

    /** @ngInject */
    constructor(
        protected UsersService: Jsonapi.IService,
        protected ContactsService: Jsonapi.IService,
        protected $stateParams
    ) {
        this.user = UsersService.get(
            $stateParams.userId,
            { include: ['contacts'] },
            success => {
                console.log('success users controller', success);
            },
            error => {
                console.log('error users controller', error);
            }
        );

        this.relatedcontacts = ContactsService.all(
            { beforepath: 'users/' + $stateParams.userId },
            () => {
                console.log('Contacts from users relationship', this.relatedcontacts);
            }
        );
    }

    public $onInit() {

    }

    /*
    Add a new user
    */
    public new() {
        let user = this.UsersService.new();
        user.attributes.name = 'Pablo Reyes';
        user.attributes.date_of_birth = '2030-12-10';
        angular.forEach(this.relatedcontacts, (contact: Jsonapi.IResource) => {
            user.addRelationship(contact /* , 'handcontact' */);
        });
        console.log('new save', user.toObject());
        // user.save( /* { include: ['contact'] } */ );
    }

    /*
    Update name for actual user
    */
    public update() {
        this.user.attributes.name += 'o';
        this.user.save(
            // { include: ['contacts'] }
        );
        console.log('update save with contact include', this.user.toObject({ include: ['contacts'] }));
        console.log('update save without any include', this.user.toObject());
    }

    public removeRelationship() {
        this.user.removeRelationship('photos', '1');
        this.user.save();
        console.log('removeRelationship save with photos include', this.user.toObject());
    }
}

export class User {
    templateUrl = 'users/user.html';
    controller = UserController;
};
