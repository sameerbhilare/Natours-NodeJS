/* eslint-disable */
// Since we have configued ESLint for nodejs, with above line, ESlint will be disabled for this file (.js)

// Updating User Data (Name, Email):  Way 2: By calling our REST API

import axios from 'axios';
import { showAlert } from './alerts';

// type is either 'password' or 'data'
export const updateSettings = async (data, type) => {
  // for /updateMyPassword, API expects passwordCurrent, password, passwordConfirm
  // for /updateMe, API expects name, email
  // relative API path because website and API are hosting on the same place
  const url = type === 'password' ? '/api/v1/users/updateMyPassword' : '/api/v1/users/updateMe';
  try {
    const res = await axios({
      method: 'PATCH',
      url: url,
      data: data,
    });

    if (res.data.status === 'success') {
      showAlert('success', `${type.toUpperCase()} successfully updated!`);
    }
  } catch (err) {
    // if there is any error from service e.g. 403, 401,
    // axios will throw an error and you an access it via err.response.data
    showAlert('error', err.response.data.message);
  }
};
