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
    var isPresent = false;

    //Localimde çalıştırdığımda aynı isimli kullanıcılar kabul ediliyor
    //Son giren isim olarak boş string alıyor
    //Boş string alan kullanıcı arama yapamıyor
    for (let index = 0; index < usersArray.length; index++) {
      var nextUser = usersArray[index];
      if (nextUser.username == userObject.username) {
        isPresent = true;
        socket.emit("signalServerError", {
          errorDescription: "Baglanmak istenen kullanıcı adına sahip bir kullanıcı zaten bulunuyor.",
          errorCode: "ERR-USER-003"
        });
        return;
      }
    }

    if (isPresent == false) {
      usersArray.push(userObject);
      socket.emit("userSaved", userObject.username);
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


  socket.on("peer-offer", function (offerObject) {

    var offeredUserObject = 0;

    if (typeof offerObject !== "object" ||
      offerObject === null ||
      !offerObject.hasOwnProperty("SDP") ||
      !offerObject.hasOwnProperty("targetUsername")) {
      console.log("peer-offer, bad parameter:" + offerObject);
      return;
    }

    for (let index = 0; index < usersArray.length; index++) {
      var user = usersArray[index];
      //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
      //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
      if (user.username.toLowerCase() == offerObject.targetUsername.toLowerCase()) {
        offeredUserObject = user;
        break;
      }
    }


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


    for (let index = 0; index < usersArray.length; index++) {
      var user = usersArray[index];
      //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
      //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
      if (user.username.toLowerCase() == offerObject.fromUsername.toLowerCase()) {
        offeredUserObject = user;
        break;
      }
    }


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
        offeredUserObject.isOffered = true;
      }
    }

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

      for (let index = 0; index < usersArray.length; index++) {
        var user = usersArray[index];

        if (user.username.toLowerCase() == candidateObject.targetUsername.toLowerCase()) {
          targetUserObject = user;
          break;
        }

      }

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


    //elimizdeki arrayde dönüyoruz
    for (let index = 0; index < usersArray.length; index++) {
      var user = usersArray[index];
      //eğer arraydeki user objelerinden, socket id'si bu event'e gelen socket id ile eşitse
      //ilgili user objesi, bu eventi tetikleyen; yani offerı yapan user oluyor. (arayan kişi)
      if (user.socketId == socket.id) {
        offeredUserObject = user;
      }

      //eğer arraydeki user objelerinden, username'i bu evente parametre olarak gelen usernameToCall'a eşit ise
      //ilgili user objesi, aranmak istenen usera denk geliyor
      if (user.username.toLowerCase() == answerObject.caller.toLowerCase()) {
        callerUserObject = user;
      }
    }

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

  //Güncel kullanıcı listesi döndürecek event
  socket.on("users", function(){
if(usersArray.length == 0){
  var errorObject = {};
  errorObject.errorDescription = "Kayıtlı kullanıcı yok.";
  errorObject.errorCode = "ERR-USER-007";
  socket.emit("signalServerError", errorObject);
  console.log("There are no online users.");
} else 
{
  socket.emit("Online-Users", usersArray);
  console.log("Sending an array of online users");
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