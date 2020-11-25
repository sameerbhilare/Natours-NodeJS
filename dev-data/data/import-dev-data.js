/*
Importing Data from JSON file to MongoDB
We are going to create a script that will simply load the data from the JSON file into the database.
This script (.js) will be independent of Express and will be used only one to load the data initially.

To Delete existing Data, pass '--delete' argument while running this script
    >node dev-data/data/import-dev-data.js --delete

To import existing Data, pass '--import' argument while running this script
    >node dev-data/data/import-dev-data.js --import
*/
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tour = require('./../../models/tourModel');
const User = require('./../../models/userModel');
const Review = require('./../../models/reviewModel');

dotenv.config({ path: './config.env' });

// get connection string
const connectionString = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

// connect to the database
// Note: We need to pass few options to connect method in order to deal with some deprecation warnings.
// If you still get some warnings, based on the error, add that option in the connect() method.
mongoose
  .connect(connectionString, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    //console.log(conn.connections);
    console.log('DB Connection successful!');
  });

// READ JSON FILE and convert to JSON object
const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'utf-8'));
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
const reviews = JSON.parse(fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8'));

// IMPROT DATA INTO DATABASE
const importData = async () => {
  try {
    // create() method accepts single object or an array of objects
    await Tour.create(tours);
    await User.create(users, { validateBeforeSave: false });
    await Review.create(reviews);
    console.log('Data successfully loaded!');
  } catch (error) {
    console.log(error);
  }

  // process.exit is an aggressive way of stopping an application
  // but in this case it's no problem because it's really just a very small script
  // that we're running here and not a real application
  process.exit();
};

// DELETE ALL DATA FROM COLLECTION
const deleteData = async () => {
  try {
    await Tour.deleteMany(); // to delete all documents in given collection
    await User.deleteMany(); // to delete all documents in given collection
    await Review.deleteMany(); // to delete all documents in given collection
    console.log('Data successfully deleted!');
  } catch (error) {
    console.log(error);
  }

  // process.exit is an aggressive way of stopping an application
  // but in this case it's no problem because it's really just a very small script
  // that we're running here and not a real application
  process.exit();
};

console.log(process.argv); // this is an array of arguments
// 0th arg is the node.exe process
// 1st arg is the .js file which we afer executing (import-dev-data.js)
// 2nd arg is what we pass extra options.

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
