/* eslint-disable */
// Since we have configued ESLint for nodejs, with above line, ESlint will be disabled for this file (.js)
import '@babel/polyfill'; // will make some of the newer JavaScript features work in older browsers as well.
import axios from 'axios';
import { showAlert } from './alerts';

/*
    Remember that our login API will then send back a cookie which automatically gets stored in the browser.
    And also automatically gets send back with each subsequent request.
*/
// ES6 module export. Syntax => 'default export' or 'export'
// NodeJS uses CommonJS to export modules. Syntax => 'module.exports' or 'exports'
// Here we are using ES6 module export as it is front end JS
export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in sucessfully');
      // navigate to home page after 1.5 seconds
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    // if there is any error from service e.g. 403, 401,
    // axios will throw an error and you an access it via err.response.data
    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });

    if (res.data.status === 'success') {
      // true - reload from server not from browser cache
      // Setting true is imp because otherwise it might simply load the same page from the cache
      // which would then still have our user menu up there.
      location.reload(true);
    }
  } catch (error) {
    showAlert('error', 'Error logging out. Try Again!');
  }
};
