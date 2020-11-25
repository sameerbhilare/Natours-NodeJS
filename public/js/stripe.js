/*
    In this script, we will actually do the request, and process the payment on the front end.
    We need to use stripe package, but we need to include this in the html as this is front-end JS.
    We have included this JS in the tour.pug  - https://js.stripe.com/v3/
*/
import axios from 'axios';
import { showAlert } from './alerts';

// Stripe with public key
const stripe = Stripe(
  'pk_test_51HqsfzKaPgCpuarzT2fgnG9woReuZucrPyFfRZ2UHInklIMVyQnBlBBe5QHN2cUDdv1oSlToIblfumvNHVPGGNo700rI7cH0Da'
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get stripe checkout session from the server - /checkout-session/:tourId
    // relative API path because website and API are hosting on the same place
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
    //console.log(session);

    // 2) Create checkout form + charge credit card
    // axios wraps the actual response from service in to 'responseObj.data'
    await stripe.redirectToCheckout({ sessionId: session.data.session.id });
  } catch (error) {
    console.error(error);
    showAlert('error', error.response.data.message);
  }
};
