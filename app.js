var createError = require('http-errors');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cors = require('cors');

const compression = require('compression');
const { ApplyRoutes } = require('./routes');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression({ level: 9 }));

app.use('/ping', function (req, res, next) {
  res.send('https://cdn.donmai.us/original/e7/72/__kousaka_kirino_ore_no_imouto_ga_konna_ni_kawaii_wake_ga_nai_drawn_by_kina_asuki__e7724d517c6cfc29641fd6c1d9f3bb41.png')
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
