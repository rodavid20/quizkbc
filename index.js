<<<<<<< HEAD
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  transports: ['websocket']
});


const port = process.env.PORT || 3000;
const path = require('path')

app.use('/static', express.static(path.join(__dirname, 'public')))

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(join(__dirname, 'client.html'));
  });

  app.get('/game', (req, res) => {
    res.sendFile(join(__dirname, 'game.html'));
  });

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
    socket.on('start_question', (question) => {        
        io.emit('begin_question', question);
    });
    
    socket.on('stop_question', (question) => {        
      io.emit('end_question', question);
    });
  
     socket.on('submit_result', (result) => {        
        io.emit('recieved_result', result);
      });
  });

server.listen(port, () => {
  console.log('server running at http://localhost:' + port);
=======
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  transports: ['websocket']
});


const port = process.env.PORT || 3000;
const path = require('path')

app.use('/static', express.static(path.join(__dirname, 'public')))

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'admin.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(join(__dirname, 'client.html'));
  });

  app.get('/game', (req, res) => {
    res.sendFile(join(__dirname, 'game.html'));
  });

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });
    socket.on('start_question', (question) => {        
        io.emit('begin_question', question);
    });
    
    socket.on('stop_question', (question) => {        
      io.emit('end_question', question);
    });
  
     socket.on('submit_result', (result) => {        
        io.emit('recieved_result', result);
      });
  });

server.listen(port, () => {
  console.log('server running at http://localhost:' + port);
>>>>>>> 4d689dc (Initial commit)
});