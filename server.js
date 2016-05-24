var http = require('http');
var path = require('path');
var util = require('util');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');


var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

var www_path = path.resolve(__dirname, 'www');
console.log(www_path);
router.use(express.static( www_path ));
var messages = [];
var sockets = [];

io.on('connection', function (socket) {
    messages.forEach(function (data) {
        socket.emit('message', data);
    });

    socket.extra = {};
    socket.extra.username = 'Anonymous';
    socket.extra['connectedOn'] = Math.floor(new Date() / 1000);
    socket.extra['id'] = socket.id;


    sockets[socket.id] = socket;
    //sockets.push(socket);

    socket.on('disconnect', function () {
        sockets.splice(sockets.indexOf(socket), 1);
        updateRoster();
    });

    socket.on('message', function (msg) {
        var text = String(msg || '');

        if (!text)
            return;

        socket.get('name', function (err, name) {
            var data = {
                name: name,
                text: text
            };

            broadcast('message', data);
            messages.push(data);
        });
    });

    socket.on('set-username', function (name, callback) {
        socket.extra.username = String(name || 'Anonymous');
        socket.extra.usernameUpdatedOn = Math.floor( new Date/1000);
        updateRoster();
        callback( socket.extra );
    });

    socket.on('user-list', function( callback ) {
        /*
        async.map( sockets, function( socket, callback ) {
                callback( null, [ socket.id, socket.extra ] );
        },
        function( err, userList ) {
            callback( userList );
        });
        */
        var userList = [];
        for ( var socket in sockets ) {
            userList.push(sockets[socket].extra);
        }
        callback( userList );

    });

    socket.on('room-list', function(callback) {

        var rooms = io.sockets.adapter.rooms;
        var roomList = {};


        /**
         * @todo check what if room name that begins with '/#'
         */
        for( var id in rooms ) {
            if ( id.indexOf('/#') != -1 ) continue;
            var room = rooms[id];
            var users = [];
            for ( var s in room.sockets ) {
                //console.log(s);
                users.push(io.sockets.sockets[s].extra);
            }
            roomList[id] = users;
        }

        //console.log(roomList);

        callback( roomList );

    });

    socket.on('join-room', function( roomname, callback ) {
        console.log(socket);
        var user = socket.extra.username;
        console.log( user + " joins " + roomname);
        socket.join( roomname );
        callback( roomname );
    } );


    socket.on('send-message', function( data, callback ) {
        var username = data.username;
        var room = data.room;
        var text = data.text;
        io.to(room).emit('recv-message', data );
        callback(room, text);
    });





});

function updateRoster() {
    async.map(
        sockets,
        function (socket, callback) {
            callback( socket.name );
        },
        function (err, names) {
            broadcast('roster', names);
        }
    );
}

function broadcast(event, data) {
    sockets.forEach(function (socket) {
        socket.emit(event, data);
    });
}

server.listen( 10080, "0.0.0.0", function(){
    var addr = server.address();
    console.log("Chat server listening at", addr.address + ":" + addr.port);
});
