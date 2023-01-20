var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cache = require('persistent-cache');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var beatmapsRouter = require('./routes/beatmaps');
var scoresRouter = require('./routes/scores');
var leaderboardsRouter = require('./routes/leaderboards');
var loginRouter = require('./routes/login');
var systemRouter = require('./routes/system');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var expressStats = cache();
app.use(function (req, res, next) {
  res.on('finish', function () {
    try{
      //not required stats, so its ok if it fails
      expressStats.putSync('requests', (expressStats.getSync('requests') ?? 0) + 1);
      expressStats.putSync('size', (expressStats.getSync('size') ?? 0) + parseInt(res.get('Content-Length') ?? 0));
    }catch(err) {}
  });

  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/beatmaps', beatmapsRouter);
app.use('/scores', scoresRouter);
app.use('/leaderboards', leaderboardsRouter);
app.use('/login', loginRouter);
app.use('/system', systemRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
