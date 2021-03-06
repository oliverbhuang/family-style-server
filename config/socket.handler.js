var client = require('./redis.js');
var Promise = require('bluebird');

module.exports = function socketHandler(io) {
  // each time this namespace is called, a new socket-room is created
  var tableio = io.of('/table');

  tableio.on('connection', function ioConnect(socket) {
    socket.on('loadMessages', function loadMessages(eventId) {
      client.lrangeAsync([eventId, 0, -1])
      .then(function getMessages(messageIds) {
        return Promise.all(messageIds.map(function lookup(messageId) {
          return client.hgetallAsync(messageId);
        }));
      })
      .then(function sendMessages(messages) {
        tableio.to(socket.id).emit('loadMessages', messages);
      });
    });

    socket.on('join', function ioEmit(message) {
      socket.join(message.eventId);
      tableio.to(message.eventId).emit('updateUsers', message.users);
    });

    socket.on('emitMessage', function emitMessage(eventId, message) {
      client.incrAsync('messageCount')
      .then(function addMessages(messageCount) {
        Promise.all([client.hmsetAsync(['m:' + messageCount, 'firstName',
            message.firstName, 'message', message.message, 'pictureUrl', message.pictureUrl,
            'userid', message.userid]),
            client.rpushAsync([eventId, 'm:' + messageCount])]);
      })
      .then(function sendMessage() {
        tableio.to(eventId).emit('returnMessage', message);
      });
    });
  });
};
