

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');


var usersArray = [];




var localMode = false;

var options = {
  index: 'index.html'
};

process.argv.forEach(function (val, index, array) {
  console.log(val);
  if (val === "local")
    localMode = true;
});

var expressServerPort = process.env.PORT;

if (localMode == true) {  
  expressServerPort = 3002;
  selfApiUrl = "http://localhost:" + expressServerPort + "/";
  app.use('/public', express.static('public', options));

} else {
  app.use('/', express.static('/home/site/wwwroot', options));
  app.use('/public', express.static('/home/site/wwwroot/public', options));
}

var server = app.listen(expressServerPort);

var io = require('socket.io').listen(server)
io.set('origins', '*:*');

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(bodyParser.json({
  verify: rawBodySaver
}));
app.use(bodyParser.urlencoded({
  verify: rawBodySaver,
  extended: true
}));
app.use(bodyParser.raw({
  verify: rawBodySaver,
  type: '*/*'
}));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/users', function (req, res) {

  var responseData = {};
  responseData.users = usersArray;  
  res.status(200);
  res.json(responseData);
});



console.log("Listening for incoming connections on port:"+expressServerPort);


io.on('connection', (socket) => {

  socket.emit("welcome");
  console.log('a user connected');

  socket.on('login', (username) => {

    usersArray.push({username:username, socketId:socket.id});

    console.log("saved user:"+username);
  });

  socket.on("disconnect", function(){
    var foundUserObjectToRemove = false;
    var userObjectToBeRemoved = -1;
    for(var II=0; II<usersArray.length; II++)
    {
      var userObject = usersArray[II];

      if(userObject.socketId == socket.id)
      {
        foundUserObjectToRemove = true;
        userObjectToBeRemoved = userObject;
        break;
      }

    }
    if(foundUserObjectToRemove == true)
      removeElement(usersArray,userObjectToBeRemoved);
  });
});


function removeElement(array, elem) {

  console.log("removing object from array:"+JSON.stringify(elem));
  var index = array.indexOf(elem);
  if (index > -1) {
      array.splice(index, 1);
  }
}