angular.module("proton.Controllers.Messages", [
  "ngRoute",
  "proton.Routes"
])

.controller("MessageListController", function($state, $stateParams, $scope, $rootScope, Message) {
  $rootScope.pageName = $state.current.data.mailbox;
  $scope.messages = Message.query();
})

.controller("ComposeMessageController", function($rootScope, Message) {
  $rootScope.pageName = "New Message";
  $scope.message = new Message();
})

.controller("ViewMessageController", function($rootScope, message) {
  $rootScope.pageName = message.MessageTitle;
  $scope.message = message;
});
