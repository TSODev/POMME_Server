#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./app');
var debug = require('debug')('sensors:server');
var http = require('http');
var socketio = require('socket.io');
const fs = require('fs');


var raspi = require('raspi');
var Serial = require('raspi-serial').Serial;
var log4js = require('log4js');


var redis = require('redis');
var redis_client = redis.createClient();

var moment = require('moment');
var _ = require('lodash');

redis_client.on('connect', function() {
  console.log('Redis : Client connected');
});

redis_client.on('error', function (err) {
  console.log('Redis : Something went wrong ' + err);
});

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
var socket = null;

/**
 * Listen on provided port, on all network interfaces.
 */

var expressServer = server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

const io = socketio(expressServer);

const WATCHDOG_INTERVAL_MS = 20000
const DEAD_INTERVAL_MS = WATCHDOG_INTERVAL_MS * 3
const NB_METRICS_BEFORE_STORE = 8                 // approx 8 x 8 = 64s - store 1 metric per minute (Redis) - 1440/day
const HISTORY_DAYS = 365                          // Total history = 365 x 1440 = 525 600 -> 40 bytes / records -> approx 20MB/y

var metric = '';
var header = '';
var metric_received = 0;
var header_received = 0;
var sensorInfo = {};
var num = 0;

var connections = [];

//===========================================================================

io.on('connection',(s) => {
  socket = s;

	socket.emit('welcomeFromServer',{data:"Welcome from Raspberry Sensor Server"});
	socket.on('clientConnected', (uniqId) => {
    socket.join('Metrics', () => {
      let rooms = Object.keys(socket.rooms)
      console.log('Client :', uniqId, 'has join the room [',rooms,']');
      socket.emit('roomWelcome', 'Welcome in '+ rooms[1]);
      connections.push({id: uniqId, moment: moment(), sockInfo: rooms})
      // connections.map(c => {
      //   console.log(c.moment._d, c.id)
      // })
    })
  });

  // socket.on('watchdogEcho', (data)=> {
  //   updateConnectionTime(data.id);
  // })


  socket.on('historyRequest', (info) => {
    console.log('Request History for last ', info.len , 'seconds by', info.id);
    const connection = connections.filter(c => (c.id === info.id))[0]
    const maxScore = moment().format('x');
    const minScore = moment().subtract(info.len, 'seconds').format('x');
    const historyLimitScore = moment().subtract(HISTORY_DAYS, 'year').format('x');

    redis_client.zrangebyscore('mset0',historyLimitScore, -1, (err, members) => {
//    redis_client.zremrangebyscore('mset0',historyLimitScore, -1, (err, members) => {
      console.log('Delete history', members.length)
    })
    redis_client.zrangebyscore('mset0',minScore, maxScore, (err, members) => {

      console.log('Sending ', members.length , 'to', connection.sockInfo);

        const sockInfo = connection.sockInfo[0];
        io.to(sockInfo).emit('startHistoricData', {historyStart: {len: members.length, min: minScore, max: maxScore}});
        io.to(sockInfo).emit('historicData', {history: members});
        io.to(sockInfo).emit('endHistoricData', {historyEnd: {}});

    });
  } )

  socket.on('disconnect', function() {
    console.log('a socket has disconnected !', socket.id)
//    console.log(connections)
    index = _.findIndex(connections,(c)=>(c.sockInfo[0] === socket.id));
    connections.splice(index,1)
    socket.disconnect(true);
  });
  
});



const addMetric = (metric) => {

    var mesure = JSON.parse(metric);
 
//    console.log('[Mesure] temperature :', mesure.metrics.temp);
//    console.log('[Mesure] humidité :', mesure.metrics.hum);
  

    var nowMoment = moment().format('x');
    mesure.moment = nowMoment;
    if (num < NB_METRICS_BEFORE_STORE) {
      num += 1;
    } else {
      redis_client.zadd('mset0',nowMoment,JSON.stringify(mesure));
      num = 0
    }

    try {
       io.to('Metrics').emit('metric', {mesure: mesure});      
    } catch (error) {
       console.log('Socket Error : ', err)
    }

  }
  

raspi.init(() => {
    var serial = new Serial({portId: '/dev/ttyUSB0', baudRate: 115200});
    var sensor = true
    serial.open(() => {
      serial.on('data', (data) => {
        data.map(char => {

                switch (char) {
                  case 0x80:
//                      console.log('START Sensor');
                      sensor = true
                    break;
                  case 0x81:
//                      console.log('START metrics');
                      sensor = false
                      break;
                  case 0xFF:
//                      console.log('STOP')
                      if (sensor) {
                        try {
                          sensorInfo = JSON.parse(header);
                          io.to('Metrics').emit('sensorInfo', sensorInfo);                 
                        } catch (error) {
                          console.log('Error reading sensor info', sensorInfo);
                        }
                      } else {
                        addMetric(metric)
                        metric = '';
                      }
                      break;
                  default:
                      if (sensor)  {
                        header += String.fromCharCode(char) 
                      }
                      else {
                        metric += String.fromCharCode(char);
                      }
                    break;
                }
        })
      });
    });
  });

    // quit on ctrl-c when running docker in terminal
    process.on('SIGINT', () => {
      console.log('Closing http server.');
      io.close();
      expressServer.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Closing http server.');
      io.close()
      expressServer.close();
      process.exit(0);
    });


/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
