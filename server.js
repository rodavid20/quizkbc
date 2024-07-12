const express = require("express");
const fs = require("fs");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");

const port = process.env.PORT || 3000;
//const port = process.argv[2] || 443;
global.port = port;

const { sequelize, GameSession, Question, PlayerSession } = require("./models");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

//https://itnext.io/node-express-letsencrypt-generate-a-free-ssl-certificate-and-run-an-https-server-in-5-minutes-a730fbe528ca
// const https = require('https');

// // Certificate
// const privateKey = fs.readFileSync('/etc/letsencrypt/live/srv550727.hstgr.cloud/privkey.pem', 'utf8');
// const certificate = fs.readFileSync('/etc/letsencrypt/live/srv550727.hstgr.cloud/cert.pem', 'utf8');
// const ca = fs.readFileSync('/etc/letsencrypt/live/srv550727.hstgr.cloud/fullchain.pem', 'utf8');

// const credentials = {
// 	key: privateKey,
// 	cert: certificate,
// 	ca: ca
// };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: null }
}));

// Initialize Passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Configure the local strategy for use by Passport
passport.use(new LocalStrategy((username, password, done) => {
  //Replace this with your user authentication logic
  console.log('Authenticating user:', process.env.ADMIN_USERNAME);
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return done(null, { id: 1, username: 'user' });
  }
  return done(null, false, { message: 'Invalid credentials' });
}));

// Serialize user to the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser((id, done) => {
  // Replace this with your user retrieval logic
  done(null, { id: 1, username: 'user' });
});

const server = createServer(app);
//const server = https.createServer(credentials, app);
const io = new Server(server, {
  transports: ["websocket"],
});

const path = require("path");

let connectedUsers = [];
let serverStartTime; //only one game at a time
let serverGameData = {};
const warningThreshold = 30;
const alertThreshold = 10;
const timeLimit = 120;

app.use("/static", express.static(path.join(__dirname, "public")));

app.get("/login", (req, res) => {
  res.sendFile(join(__dirname, "login.html"));
});

app.post('/login',
  (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      //console.log('Authenticating user:', err);
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect('/login');
      }
      req.logIn(user, (err) => {
       return res.redirect('/admin');
      });
    })(req, res, next);
  }
);

// Middleware to protect routes and store original URL
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.get("/client", (req, res) => {
  res.sendFile(join(__dirname, "client.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(join(__dirname, "game.html"));
});

app.get("/results", (req, res) => {
  res.sendFile(join(__dirname, "results.html"));
});

app.get("/create-question", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "question.html"));
});

app.get("/begin-game", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "begin-game.html"));
});

app.get("/admin", ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, "game-sessions.html"));
});

app.get("/api/game-sessions", async (req, res) => {
  try {
    const gameSessions = await GameSession.findAll({
      include: [
        {
          model: PlayerSession,
          attributes: [
            "playerName",
            "choice",
            "score",
            "clientTime",
            "serverTime",
          ],
        },
        {
          model: Question,
          attributes: [
            "text",
            "option1",
            "option2",
            "option3",
            "option4",
            "correctOption",
          ],
        },
      ],
      order: [["name", "ASC"]],
    });
    res.json(gameSessions);
  } catch (error) {
    console.error("Failed to fetch game sessions:", error);
    res.status(500).send("Failed to fetch game sessions");
  }
});

app.get("/create-questions",  ensureAuthenticated, (req, res) => {
  // Check if there is a gameSessionId provided
  const { gameSessionId } = req.query;

  if (!gameSessionId) {
    // Create a new game session if none provided
    GameSession.create()
      .then((session) => {
        const url = `/create-questions?gameSessionId=${session.sessionId}`;
        res.redirect(url); // Redirect to the same page with the new session ID
      })
      .catch((err) => {
        res.status(500).send("Failed to create a new game session.");
      });
  } else {
    // Serve the HTML page with the session ID
    res.sendFile(__dirname + `/create-questions.html`);
  }
});

app.get("/api/results", async (req, res) => {
  //console.log("Fetching questions for game session:", serverGameData.gameSessionId);
  try {
    if (serverGameData == null || serverGameData.gameSessionId == null) {
      return res.json({});
    }
    const gameSession = await GameSession.findByPk(serverGameData.gameSessionId, {
      attributes: ["startTime", "name"],
      include: [
        {
          model: PlayerSession,
          attributes: [
            "playerName",
            "choice",
            "score",
            "clientTime",
            "serverTime",
          ],
        },
      ],
    });
    if (gameSession) {
      //console.log("Questions:", gameSession);
      res.json(gameSession);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("Failed to fetch results:", error);
    res.status(500).send("Failed to fetch results");
  }
});

app.get("/api/copy-questions", async (req, res) => {
  const { gameSessionId } = req.query;
  try {
    const gameSession = await GameSession.findByPk(gameSessionId, {
      include: [Question],
    });
    if (!gameSession) {
      return res.status(404).send("Game session not found");
    }
    let newGameSession = await GameSession.create({
      name: gameSession.name + "-Copy",
    });
    //console.log("Copying questions for game session:", gameSession.Questions);
    const createdQuestions = await Question.bulkCreate(
      gameSession.Questions.map((question) => ({
        text: question.text,
        option1: question.option1,
        option2: question.option2,
        option3: question.option3,
        option4: question.option4,
        correctOption: question.correctOption,
        sessionId: newGameSession.sessionId,
      })),
      {
        validate: true, // This ensures validations defined in the model are applied
      }
    );
    res.json({
      message: `${createdQuestions.length} questions created successfully`,
      gameSessionId: newGameSession.gameSessionId,
    });
  } catch (error) {
    console.error("Failed to copy questions:", error);
    res.status(500).send("Failed to copy questions");
  }
});

app.get("/api/questions/:gameSessionId", async (req, res) => {
  const { gameSessionId } = req.params;
  //console.log("Fetching questions for game session:", gameSessionId);
  try {
    const gameSession = await GameSession.findByPk(gameSessionId, {
      attributes: ["startTime", "name"],
      include: [Question],
    });
    if (gameSession) {
      //console.log("Questions:", gameSession);
      res.json({
        gameSessionId: gameSessionId,
        gameSessionName: gameSession.name,
        gameStartTime: gameSession.startTime,
        questions: gameSession.Questions,
        alertThreshold: alertThreshold,
        warningThreshold: warningThreshold,
        timeLimit: timeLimit,
      });
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("Failed to fetch questions:", error);
    res.status(500).send("Failed to fetch questions");
  }
});

app.post("/api/create-questions", async (req, res) => {
  const { gameSessionId, gameSessionName, questions } = req.body;
  //console.log('Updating questions:', req.body, gameSessionId);
  try {
    let gameSession;
    if (!gameSessionId) {
      gameSession = await GameSession.create({ name: gameSessionName });
    } else {
      gameSession = await GameSession.findByPk(gameSessionId);
      gameSession.name = gameSessionName;
      //gameSession.startTime = new Date();     //keep date as null and when game starts update it to new Date()
      gameSession.save();
      if (!gameSession) return res.status(404).send("Game session not found");
    }
    //console.log('Creating questions:', questions, gameSessionId, gameSessionName);

    const result = await Question.destroy({
      where: {
        sessionId: gameSessionId,
      },
    });

    const createdQuestions = await Question.bulkCreate(
      questions.map((question) => ({
        text: question.text,
        option1: question.options[0],
        option2: question.options[1],
        option3: question.options[2],
        option4: question.options[3],
        correctOption: question.correctOption,
        sessionId: gameSessionId,
      })),
      {
        validate: true, // This ensures validations defined in the model are applied
      }
    );
    res.status(201).json({
      message: `${createdQuestions.length} questions created successfully`,
      gameSessionId: gameSessionId,
    });
  } catch (error) {
    console.error("Error creating questions:", error);
    res.status(500).send("Failed to create questions");
  }
});

io.on("connection", (socket) => {
  connectedUsers.push(socket.handshake.auth.username);
  io.emit("connected_users", connectedUsers);
  //console.log("a user connected");
  socket.on("disconnect", () => {
    //console.log("user disconnected");
    connectedUsers = connectedUsers.filter(
      (user) => user !== socket.handshake.auth.username
    );
    io.emit("connected_users", connectedUsers);
  });
  socket.on("start_question", (gameData) => {
    serverGameData = gameData;
    gameData.timeLimit = timeLimit;
    gameData.warningThreshold = warningThreshold;
    gameData.alertThreshold = alertThreshold;
    serverStartTime = new Date().getTime();
    io.emit("begin_question", gameData);
  });

  socket.on("stop_question", (gameData) => {
    io.emit("end_question", gameData);
  });

  socket.on("submit_result", async (result) => {
    if(serverGameData == null) return;
    if(result == null) return;
    if(result.gameSessionId != serverGameData.gameSessionId) return; //ignore results from other games
    const serverTime = (new Date().getTime() - serverStartTime) / 1000;
    result.serverTime = serverTime;
    try {
      let gameSession = await GameSession.findByPk(result.gameSessionId);
      if (!gameSession) return res.status(404).send("Game session not found");
      if (gameSession.startTime == null) {
        gameSession.startTime = serverStartTime;
        await gameSession.save();
      }
      let score = 0;
      for (let i = 0; i < result.answers.length; i++) {
        if (result.answers[i] == serverGameData.questions[i].correctOption) {
          score++;
        }
      }
      result.score = score;
      result.serverTime = serverTime;
      result.clientActualTime = result.clientTime;      
      if (result.clientTime > timeLimit) {
        result.clientTime = timeLimit;
      }
      //console.log("Updating results:", result);
      await PlayerSession.create({
        sessionId: result.gameSessionId,
        playerName: result.username,
        choice: result.answers.toString(),
        score: result.score,
        clientTime: result.clientTime,
        clientActualTime: result.clientActualTime,
        serverTime: serverTime,
      });
      
    } catch (error) {
      console.error("Error:", result);
      console.error("Error saving results:", error);
    }
    io.emit("recieved_result", result);
  });
});

server.listen(port, async () => {
  console.log(`server running at port ${port}`);
  try {
    await sequelize.authenticate();
    //console.log("Database connected!");
    await sequelize.sync({ force: false, alter: false }); // Optionally, consider 'alter: true' if you want to make non-destructive updates to the schema
    //console.log("Database models synchronized!");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});

// app.post('/api/update-questions/:gameSessionId', async (req, res) => {
//   const { gameSessionId } = req.params;
//   const { questions } = req.body;
//   console.log('Updating questions:', questions);

//   try {
//       const gameSession = await GameSession.findByPk(gameSessionId);
//       if (!gameSession) {
//           return res.status(404).send('Game session not found');
//       }

//       await Promise.all(questions.map(question =>
//           Question.update({
//               text: question.text,
//               option1: question.options[0],
//               option2: question.options[1],
//               option3: question.options[2],
//               option4: question.options[3],
//               correctOption: question.correctOption
//           }, {
//               where: { questionId: question.id, sessionId: gameSessionId }
//           })
//       ));

//       res.status(200).json({ message: 'Questions updated successfully' });
//   } catch (error) {
//       console.error('Error updating questions:', error);
//       res.status(500).send('Failed to update questions');
//   }
// });

// app.post('/submit-edited-questions/:sessionId', async (req, res) => {
//   try {
//       const { questions } = req.body;
//       for (const question of questions) {
//           const q = await Question.findByPk(question.id);
//           if (q) {
//               q.text = question.text;
//               q.option1 = question.options[0];
//               q.option2 = question.options[1];
//               q.option3 = question.options[2];
//               q.option4 = question.options[3];
//               q.correctOption = parseInt(question.correctOption, 10) + 1; // Assuming 0-indexed front-end
//               await q.save();
//           }
//       }
//       res.status(200).send('Questions updated successfully');
//     } catch (error) {
//       console.error('Error updating questions:', error);
//       res.status(500).send('Failed to update questions');
//     }
// });

// app.post('/submit-questions', async (req, res) => {
//   const questionsData = req.body.questions;
//   const gameSessionId = req.body.gameSessionId;

//   if (!Array.isArray(questionsData) || questionsData.length === 0) {
//     return res.status(400).send({
//       message: 'Invalid input: Expected an array of questions.'
//     });
//   }
//   try {
//     console.log('Creating questions:', questionsData);
//     const gameSession = await GameSession.findByPk(gameSessionId);
//     gameSession.gameSessionName = req.body.gameSessionName;
//     const questions = await Question.bulkCreate(questionsData.map(question => ({
//       text: question.text,
//       option1: question.options[0],
//       option2: question.options[1],
//       option3: question.options[2],
//       option4: question.options[3],
//       correctOption: parseInt(question.correctOption, 0) + 1,
//       sessionId: gameSessionId
//     })), {
//       validate: true // This ensures validations defined in the model are applied
//     });
//     res.status(201).json({
//       message: `${questions.length} questions created successfully`,
//       questions
//     });
//   } catch (error) {
//     console.error('Error saving questions:', error);
//     res.status(500).json({
//       message: "Failed to create questions",
//       error: error.message || 'Database error'
//     });
//   }
// });
