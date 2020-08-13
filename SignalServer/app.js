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
  //offer olan durumda answer geçişi için
  var isOffered = true;
  var isAnswered = false;
  //answerda kullanmak için globale çektim
  var offeredUserObject = 0;
  var callerUserObject = 0;

  socket.on('login', (username) => {
    var userObject = {};
    userObject.username = username;
    userObject.socketId = socket.id;
    var generatedUsername = "Anonymous";
    

    if (userObject.username == "") {
      socket.emit("emptyUsername", generatedUsername);
      userObject.username = generatedUsername;
      usersArray.push(userObject);
    } else {

      for (let index = 0; index < usersArray.length; index++) {
        var nextUser = usersArray[index];
        if (nextUser.username == userObject.username && nextUser.username != generatedUsername) {
          socket.emit("signalServerError", {
            errorDescription: "Baglanmak istenen kullanıcı adına sahip bir kullanıcı zaten bulunuyor.",
            errorCode: "ERR-USER-003"
          });
          return;
        }
      }

      usersArray.push(userObject);
      socket.emit("userSaved" , userObject.username);

    }
  });

  socket.on("disconnect", function () {
    var foundUserObjectToRemove = false;
    var userObjectToBeRemoved = -1;


    for (var II = 0; II < usersArray.length; II++) {
      var nextUser = usersArray[II];


      if (nextUser.socketId == socket.id) {
        foundUserObjectToRemove = true;
        userObjectToBeRemoved = nextUser;
        break;
      }
    }


    if (foundUserObjectToRemove == true)
      removeElement(usersArray, userObjectToBeRemoved);
  });

  socket.on("offer", function (usernameToCall) {

    
    //elimizdeki arrayde dönüyoruz
    for (let index = 0; index < usersArray.length; index++) {
      var user = usersArray[index];
      //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
      //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
      if (user.socketId == socket.id) {
        callerUserObject = user;
      }

      //eğer arraydeki user objelerinden, username'i bu evente parametre olarak gelen usernameToCall'a eşit ise
      //ilgili user objesi, aranmak istenen usera denk geliyor
      if (user.username.toLowerCase() == usernameToCall.toLowerCase()) {
        offeredUserObject = user;
      }

      if (!callerUserObject && !offeredUserObject)
        break;
    }

    //loop bitti, fakat aramayı yapmak isteyen kullanıcının objesini arrayde bulamadım.
    if (!callerUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aramayı yapmak isteyen kullanıcıyı bulamadım, lütfen tekrar giriş yapınız.";
      errorObject.errorCode = "ERR-USER-001";
      socket.emit("signalServerError", errorObject);
      isOffered = false;
      console.log("callUserObject is null, terminating.");
      return;
    }

    //loop bitti, fakat aranmak istenen kullanıcının objesini arrayde bulamadım.
    if (!offeredUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      isOffered = false;
      console.log("offeredUserObject is null, terminating.");
      return;
    }

    //Ece'nin Mert'i aramak istediği senaryoda:
    //MertUser.socket.emit('offer', EceUser.username)    
    io.of("/").connected[offeredUserObject.socketId].emit("offer", callerUserObject.username);
  });

  socket.on("answer", function() {

    if(isOffered)
    {
      io.of("/").connected[callerUserObject.socketId].emit("answer", offeredUserObject);
      console.log("answering : " + callerUserObject.username); 
      isAnsvered = true;
    }
    else
    {
      var errorObject = {};
      errorObject.errorDescription = "Cevaplanmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-003";
      socket.emit("signalServerError", errorObject);
      console.log("can't answer, terminating.");
    }
  });

  socket.on("candidate", function(user){

if(isAnswered){
  io.of("/").connected[user.socketId].emit("candidate", user.candidate);
  console.log("Generating a candidate for : " + user.username);
} else {
  var errorObject = {};
  errorObject.errorDescription = "Candidate oluşturamıyorum, lütfen daha sonra tekrar deneyiniz.";
  errorObject.errorCode = "ERR-USER-004";
  socket.emit("signalServerError", errorObject);
  console.log("can't generate a candidate, terminating.");
}
  });
});


function removeElement(array, elem) {
  console.log("removing object from array. username:" + elem.username + " socketId:" + elem.socketId);
  var index = array.indexOf(elem);
  if (index > -1) {
    array.splice(index, 1);
  }
};