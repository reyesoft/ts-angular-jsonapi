export default routesConfig;

/** @ngInject */
function routesConfig(
    $stateProvider: angular.ui.IStateProvider,
    $urlRouterProvider: angular.ui.IUrlRouterProvider,
    $locationProvider: angular.ILocationProvider
) {
    $locationProvider.html5Mode(true).hashPrefix('!');
    $urlRouterProvider.otherwise('/users');

    $stateProvider
    .state('users', {
        url: '/users',
        template: '<users></users>'
    })
    .state('user', {
        url: '/user/user/:userId',
        template: '<user></user>'
    })
    .state('books', {
        url: '/books/:filter',
        template: '<books></books>'
    })
    .state('book', {
        url: '/books/book/:bookId',
        template: '<book></book>'
    })
    ;
}
