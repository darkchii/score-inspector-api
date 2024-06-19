var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cache = require('persistent-cache');
var cors = require('cors');

const compression = require('compression');
const { ApplyRoutes } = require('./routes');
const { rateLimit } = require('express-rate-limit');

var app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: 'draft-7',
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
    error: 'RateLimitError'
  }
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression({ level: 9 }));

app.use(function (req, res, next) {
  if (res.headersSent) {
    console.log(req.method, req.url, res.statusCode);
  } else {
    res.on('finish', function () {
      const remote_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.log(req.method, remote_ip, req.url, res.statusCode);
    })
  }
  next();
});

var expressStats = cache();
app.use(function (req, res, next) {
  res.on('finish', function () {
    try {
      //not required stats, so its ok if it fails
      expressStats.putSync('requests', (expressStats.getSync('requests') ?? 0) + 1);
      expressStats.putSync('size', (expressStats.getSync('size') ?? 0) + parseInt(res.get('Content-Length') ?? 0));
    } catch (err) { }
  });

  next();
});

ApplyRoutes(app);

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
