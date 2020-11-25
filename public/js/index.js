/* eslint-disable */
// Since we have configued ESLint for nodejs, with above line, ESlint will be disabled for this file (.js)

/*
    The idea is basically that this index.js file is our entry file, 
    and so in this one we kind of get data from the user interface 
    and then we delegate actions to some functions coming from these other modules (login.js, alerts.js).
*/

import { displayMap } from './mapbox';
import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';

// this is because we have stored data in 'data-locations' attribute of a div with id as 'map'
// DOM elements
const mapBoxEl = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logoutBtn = document.querySelector('.nav__el--logout');
const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

// Delegation
if (mapBoxEl) {
  const locations = JSON.parse(mapBoxEl.dataset.locations);
  displayMap(locations);
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault(); // to prevent the form from loadin any other page
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

if (userDataForm) {
  userDataForm.addEventListener('submit', (e) => {
    e.preventDefault(); // to prevent the form from loadin any other page

    // we kind of needed to programmatically recreate a multi-part form data in orde to send a file/photo
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);
    //console.log(form);
    updateSettings(form, 'data');
  });
}

if (userPasswordForm) {
  userPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // to prevent the form from loadin any other page

    // change button text so that user know that it's updating
    const savePassBtn = document.querySelector('.btn--save-password');
    savePassBtn.textContent = 'Updating...';

    // get input form data
    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    // call /updateMyPassword API and await so that we can then clear input fields, etc.
    await updateSettings({ passwordCurrent, password, passwordConfirm }, 'password');

    // change button text back to original
    savePassBtn.textContent = 'Save Password';
    // clear input fields
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });
}

if (bookBtn) {
  bookBtn.addEventListener('click', (e) => {
    e.target.textContent = 'Processing...';
    // const { tourId } = e.target.dataset; // standard JS: data-tour-id => will be dataset.tourId
    const tourId = e.target.dataset.tourId; // standard JS: data-tour-id => will be dataset.tourId
    bookTour(tourId);
  });
}
