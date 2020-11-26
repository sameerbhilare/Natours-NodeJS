/* eslint-disable */
// Since we have configued ESLint for nodejs, with above line, ESlint will be disabled for this file (.js)

export const hideAlert = () => {
  // find elements with class anme 'alert'
  const el = document.querySelector('.alert');
  // remove the alert.
  if (el) el.parentElement.removeChild(el);
};

// type is 'success' or 'error'
export const showAlert = (type, msg, time = 7) => {
  // hide existing alerts
  hideAlert();

  // create markup with 'alert' class
  // and based on type (success/error), add alert--success or alert--error css class
  const markup = `<div class='alert alert--${type}'>${msg}</div>`;

  // show error at the start of the body element
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);

  // hide alert after 5 seconds
  window.setTimeout(hideAlert, time * 1000);
  // above line is same as below commented piece of code
  /*
  window.setTimeout(() => {
    hideAlert();
  }, 5000); */
};
