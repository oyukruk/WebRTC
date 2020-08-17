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

    for (let index = 0; index < usersArray.length; index++) {
      var nextUser = usersArray[index];
      if (nextUser.username.toLowerCase().trim() == userObject.username.toLowerCase().trim()) {
        socket.emit("signalServerError", {
          errorDescription: "Baglanmak istenen kullanıcı adına sahip bir kullanıcı zaten bulunuyor.",
          errorCode: "ERR-USER-003"
        });
        return;
      }
    }

      usersArray.push(userObject);
      socket.emit("userSaved", userObject.username);

    
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
        else
      console.log("could not find a socket id to remove");
  });


  socket.on("peer-offer", function (offerObject){

    var offeredUserObject = 0;

    if(typeof offerObject !== "object" || 
       offerObject === null || 
       !offerObject.hasOwnProperty("SDP") || 
       !offerObject.hasOwnProperty("targetUsername"))
    {
      console.log("peer-offer, bad parameter:"+offerObject);
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


    if(!offeredUserObject)
    {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }


    console.log("emitting peer-offer to "+offeredUserObject.username+" with SDP:"+offerObject.SDP+" from:"+offerObject.fromUsername);

    io.of("/").connected[offeredUserObject.socketId].emit("peer-offer", offerObject);


  });

  socket.on("peer-answer", function (offerObject){

    var offeredUserObject = 0;

        if(typeof offerObject !== "object" || 
        offerObject === null || 
        !offerObject.hasOwnProperty("SDP") || 
        !offerObject.hasOwnProperty("targetUsername"))
    {
      console.log("peer-offer, bad parameter:"+offerObject);
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

    
    if(!offeredUserObject)
    {
      var errorObject = {};
      errorObject.errorDescription = "Aranmak istenen kullanıcıyı bulamadım, lütfen daha sonra tekrar deneyiniz.";
      errorObject.errorCode = "ERR-USER-002";
      socket.emit("signalServerError", errorObject);
      console.log("offeredUserObject is null, terminating.");
      return;
    }


    console.log("emitting peer-answer to "+offeredUserObject.username+" with SDP:"+offerObject.SDP+" from:"+offerObject.targetUsername);

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
    console.log(callerUserObject.username+" will try calling "+offeredUserObject.username);
  });

  socket.on("answer", function(username) {

    var offeredUserObject = 0;
    var callerUserObject = 0;
   // var accepted = answerObject.accepted;

    
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
      if (user.username.toLowerCase() == username.toLowerCase()) {
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
    
    io.of("/").connected[callerUserObject.socketId].emit("answer", offeredUserObject.username);
    console.log("answering : " + callerUserObject.username); 
  });

});


function removeElement(array, elem) {
  console.log("removing object from array. username:" + elem.username + " socketId:" + elem.socketId);
  var index = array.indexOf(elem);
  if (index > -1) {
    array.splice(index, 1);
  }
};