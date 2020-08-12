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



console.log("Listening for incoming connections on port:" + expressServerPort);

//Gorkem

io.on('connection', (socket) => {
  socket.emit("welcome");
  console.log('a user connected');

  socket.on('login', (username) => {
    var userObject = {};
    userObject.username = username;
    userObject.socket = socket;
    userObject.socketId = socket.id;

    var generatedUsername = "Anonymous";
    var validation = true;

    if (userObject.username == "") {
      socket.emit("emptyUsername", generatedUsername);
      userObject.username = generatedUsername;
      usersArray.push(newUser);
      socket.emit("saved user:" + userObject.username);
    } else {
    for (let index = 0; index < usersArray.length; index++) {
      var nextUser = usersArray[II];
      if (nextUser.username == userObject.username && nextUser.username != generatedUsername) {
        socket.emit("Username Exists");
        validation = false;
        break;
      }
    }
    if(validation){
      usersArray.push(userObject);
      socket.emit("saved user:" + userObject.username);
    }
  }});
    
  socket.on("leave", function () {
    var foundUserObjectToRemove = false;
    var userObjectToBeRemoved = -1;
    for (var II = 0; II < usersArray.length; II++) {
      var nextUser = usersArray[II];
      if (nextUser.socketId == userObject.socketId) {
        foundUserObjectToRemove = true;
        userObjectToBeRemoved = nextUser;
        break;
      }
    }
    if (foundUserObjectToRemove == true)
      removeElement(usersArray, userObjectToBeRemoved);
  });

  socket.on("offer", function (usernameToCall) {

    var callerUserObject = 0;
    var offeredUserObject = 0;

    //elimizdeki arrayde dönüyoruz
    for (let index = 0; index < usersArray.length; index++) {
        var user = usersArray[index];
        //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
        //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
        if(user.socketId == socket.id)
        {
          callerUserObject = user;
        }

        //eğer arraydeki user objelerinden, username'i bu evente parametre olarak gelen usernameToCall'a eşit ise
        //ilgili user objesi, aranmak istenen usera denk geliyor
        if(user.username == usernameToCall)
        {
          offeredUserObject = user;
        }


        if(!callerUserObject && !offeredUserObject)
          break;
    }

    //loop bitti, fakat aramayı yapmak isteyen kullanıcının objesini arrayde bulamadım.
    if(!callerUserObject)
    {
      var errorObject = {};
      errorObject.errorDescription = "Aramayı yapmak isteyen kullanıcıyı bulamadım, lütfen tekrar giriş yapınız.";
      errorObject.errorCode = "ERR-USER-001";
      socket.emit("signalServerError", errorObject);

      console.log("callUserObject is null, terminating.");
      return;
    }

    //loop bitti, fakat aranmak istenen kullanıcının objesini arrayde bulamadım.
    if(!offeredUserObject)
    {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);

      console.log("offeredUserObject is null, terminating.");
      return;
    }

    //Ece'nin Mert'i aramak istediği senaryoda:
    //MertUser.socket.emit('offer', EceUser.username)    
    offeredUserObject.socket.emit("offer",callerUserObject.username);
  });
  
  socket.on("answer", function() {
            
  });

  socket.on("candidate", function(){

  });
});


function removeElement(array, elem) {
  console.log("removing object from array:" + JSON.stringify(elem));
  var index = array.indexOf(elem);
  if (index > -1) {
    array.splice(index, 1);
  }
};