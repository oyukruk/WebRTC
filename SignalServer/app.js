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
    userObject.socketId = socket.id;
    userObject.isOffered = false;
    userObject.isAnswered = false;


    //Localimde çalıştırdığımda aynı isimli kullanıcılar kabul ediliyor
    //Son giren isim olarak boş string alıyor
    //Boş string alan kullanıcı arama yapamıyor
    for (let index = 0; index < usersArray.length; index++) {
      var nextUser = usersArray[index];
      if (nextUser.username == userObject.username) {
        removeUserObjectByUsername(nextUser.username);
        break;
      }
    }

    usersArray.push(userObject);
    socket.emit("userSaved", userObject.username);
    updateUsers();

  });

  socket.on("disconnect", function () {
    console.log("got disconnect signal from socket id:" + socket.id);
    removeUserObjectBySocketId(socket.id);
  });

  socket.on("endCall", function (connectedUser) {
    //connctedUser userArray den bulunur 
    //ve ona socket.emit("callEnded", bu sockete gelen kullanıcının username de parametre olarak verilir

    var userObject = findUserObjectByUsername(connectedUser);

    if (userObject)
      io.of("/").connected[userObject.socketId].emit("callEnded");

  });

  socket.on("peer-offer", function (offerObject) {

    var offeredUserObject = 0;

    if (typeof offerObject !== "object" ||
      offerObject === null ||
      !offerObject.hasOwnProperty("SDP") ||
      !offerObject.hasOwnProperty("targetUsername")) {
      console.log("peer-offer, bad parameter:" + offerObject);
      return;
    }

    offeredUserObject = findUserObjectByUsername(offerObject.targetUsername);

    if (!offeredUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }


    console.log("emitting peer-offer to " + offeredUserObject.username + " with SDP:" + offerObject.SDP + " from:" + offerObject.fromUsername);

    io.of("/").connected[offeredUserObject.socketId].emit("peer-offer", offerObject);


  });

  socket.on("peer-answer", function (offerObject) {

    var offeredUserObject = 0;

    if (typeof offerObject !== "object" ||
      offerObject === null ||
      !offerObject.hasOwnProperty("SDP") ||
      !offerObject.hasOwnProperty("targetUsername")) {
      console.log("peer-offer, bad parameter:" + offerObject);
      return;
    }

    offeredUserObject = findUserObjectByUsername(offerObject.fromUsername);

    if (!offeredUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }


    console.log("emitting peer-answer to " + offeredUserObject.username + " with SDP:" + offerObject.SDP + " from:" + offerObject.targetUsername);

    io.of("/").connected[offeredUserObject.socketId].emit("peer-answer", offerObject);
  });

  socket.on("offer", function (usernameToCall) {

    var offeredUserObject = 0;
    var callerUserObject = 0;

    callerUserObject = findUserObjectBySocketId(socket.id);
    offeredUserObject = findUserObjectByUsername(usernameToCall);

    //loop bitti, fakat aramayı yapmak isteyen kullanıcının objesini arrayde bulamadım.
    if (!callerUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aramayı yapmak isteyen kullanıcıyı bulamadım, lütfen tekrar giriş yapınız.";
      errorObject.errorCode = "ERR-USER-001";
      socket.emit("signalServerError", errorObject);
      console.log("callUserObject is null, terminating.");
      return;
    }

    //loop bitti, fakat aranmak istenen kullanıcının objesini arrayde bulamadım.
    if (!offeredUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }

    //Ece'nin Mert'i aramak istediği senaryoda:
    //MertUser.socket.emit('offer', EceUser.username)  

    io.of("/").connected[offeredUserObject.socketId].emit("offer", callerUserObject.username);
    console.log(callerUserObject.username + " will try calling " + offeredUserObject.username);
  });

  socket.on("send-candidate", function (candidateObject) {

    try {
      if (typeof candidateObject !== "object" ||
        candidateObject === null ||
        !candidateObject.hasOwnProperty("candidate") ||
        !candidateObject.hasOwnProperty("fromUsername") ||
        !candidateObject.hasOwnProperty("targetUsername")) {
        console.log("send-candidate, bad parameter:" + candidateObject);
        return;
      }

      var targetUserObject = 0;

      targetUserObject = findUserObjectByUsername(candidateObject.targetUsername);

      if (!targetUserObject) {
        var errorObject = {};
        errorObject.errorDescription = "Candidate gönderilmek istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
        errorObject.errorCode = "ERR-USER-009";
        socket.emit("signalServerError", errorObject);
        console.log("targetUserObject is null, terminating.");
        return;
      }

      io.of("/").connected[targetUserObject.socketId].emit("new-ice-candidate", candidateObject.candidate);


    } catch (err) {
      console.log("send-candidate error:" + err);
    }
  });

  socket.on("answer", function (answerObject) {

    var offeredUserObject = 0;
    var callerUserObject = 0;

    offeredUserObject = findUserObjectBySocketId(socket.id);
    callerUserObject = findUserObjectByUsername(answerObject.caller);

    //loop bitti, fakat aramayı yapmak isteyen kullanıcının objesini arrayde bulamadım.
    if (!callerUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aramayı yapmak isteyen kullanıcıyı bulamadım, lütfen tekrar giriş yapınız.";
      errorObject.errorCode = "ERR-USER-001";
      socket.emit("signalServerError", errorObject);
      console.log("callUserObject is null, terminating.");
      return;
    }

    //loop bitti, fakat aranmak istenen kullanıcının objesini arrayde bulamadım.
    if (!offeredUserObject) {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }

    if (answerObject.accepted) {
      io.of("/").connected[callerUserObject.socketId].emit("accepted", offeredUserObject.username);
      console.log("answering : " + callerUserObject.username);
    } else {
      io.of("/").connected[callerUserObject.socketId].emit("declined", offeredUserObject.username);
      console.log("answering : " + callerUserObject.username);
    }

  });

  socket.on("candidate", function (user) {

    if (callerUserObject.isAnswered && offeredUserObject.isOffered) {
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

  //Seçilen sockete message objesini emit et
  socket.on("private-message", function (messageObject) {



    var userObject = findUserObjectByUsername(messageObject.to);
    if (!userObject)
      return;

    io.of("/").connected[userObject.socketId].emit("private-message", {
      from: messageObject.from,
      targetUsername: messageObject.to,
      message: messageObject.message
    });

  });

  //Bütün socketlere message objesini emit et
  socket.on("public-message", function (messageObject) {
    io.sockets.emit("new-message", {
      username: socket.username,
      message: messageObject.message
    })
  });

  socket.on("typing", function (username) {
    if (findUserObjectByUsername(username) != null) {
      io.of("/").connected[findUserObjectByUsername(username).socketId].emit("typing", {
        username: socket.username
      });
    } else {
      var errorObject = {};
      errorObject.errorDescription = "Kayıtlı kullanıcı yok.";
      errorObject.errorCode = "ERR-USER-011";
      io.sockets.emit("signalServerError", errorObject);
      console.log("Target user is not present.");
    }
  })
});


function removeElement(array, elem) {
  console.log("removing object from array. username:" + elem.username + " socketId:" + elem.socketId);
  var index = array.indexOf(elem);
  if (index > -1) {
    array.splice(index, 1);
  }
};

function updateUsers() {

  console.log("will notify updated sockets about latest usersArray. current usersArrayLength:" + usersArray.length);
  if (usersArray.length == 0) {
    var errorObject = {};
    errorObject.errorDescription = "Kayıtlı kullanıcı yok.";
    errorObject.errorCode = "ERR-USER-007";
    io.sockets.emit("signalServerError", errorObject);
    console.log("There are no online users.");
  } else {
    io.sockets.emit("online-Users", usersArray);
    console.log("Sending an array of online users");
  }
};


function findUserObjectByUsername(username) {
  var returnValue = 0;

  for (let index = 0; index < usersArray.length; index++) {
    var user = usersArray[index];

    //eğer arraydeki user objelerinden, username'i bu evente parametre olarak gelen usernameToCall'a eşit ise
    //ilgili user objesi, aranmak istenen usera denk geliyor
    if (user.username.toLowerCase() == username.toLowerCase()) {
      returnValue = user;
      break;
    }
  }

  return returnValue;
};

function findUserObjectBySocketId(socketId) {
  var returnValue = 0;

  for (let index = 0; index < usersArray.length; index++) {
    var user = usersArray[index];
    //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
    //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
    if (user.socketId == socketId) {
      returnValue = user;
      break;
    }
  }

  return returnValue;
};

function removeUserObjectBySocketId(socketId) {
  var userObjectToBeRemoved = -1;

  userObjectToBeRemoved = findUserObjectBySocketId(socketId);

  console.log("findUserObjectBySocketId result:" + userObjectToBeRemoved);

  if (!userObjectToBeRemoved)
    return;

  //just in case
  var foundSocketForceDisconnect = io.of("/").connected[userObjectToBeRemoved.socketId];
  if (foundSocketForceDisconnect)
    foundSocketForceDisconnect.emit("forceDisconnect");

  var foundSocketClose = io.of("/").connected[userObjectToBeRemoved.socketId];
  if (foundSocketClose && typeof foundSocketClose.close === "function")
    foundSocketClose.close();

  removeElement(usersArray, userObjectToBeRemoved);

  console.log("removed element. array length:" + usersArray.length);
  updateUsers();
};


function removeUserObjectByUsername(username) {
  var userObjectToBeRemoved = -1;

  userObjectToBeRemoved = findUserObjectByUsername(username);

  if (!userObjectToBeRemoved)
    return;

  //just in case
  var foundSocketForceDisconnect = io.of("/").connected[userObjectToBeRemoved.socketId];
  if (foundSocketForceDisconnect)
    foundSocketForceDisconnect.emit("forceDisconnect");

  var foundSocketClose = io.of("/").connected[userObjectToBeRemoved.socketId];
  if (foundSocketClose && typeof foundSocketClose.close === "function")
    foundSocketClose.close();

  removeElement(usersArray, userObjectToBeRemoved);

  console.log("removed element. array length:" + usersArray.length);
  updateUsers();


};