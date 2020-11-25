/*
    Anonymous (catchAsync) function for global handling of errors for 'Await'
    so that we don't have to repeat try catch blocks in each route handler.
*/
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // .catch(next) is shorthand for .catch(err => next(err));
  };
};
