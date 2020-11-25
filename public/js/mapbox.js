/* eslint-disable */
// Since we have configued ESLint for nodejs, with above line, ESlint will be disabled for this file (.js)

//console.log('Hello from client side');

/*
    We want to actually get access to the location data of the tour that we are currently trying to display
    right here in the JavaScript file. So how are going to do that? 
    We can do an Ajax request, so basically a call to our API and get the data from there.
    But that's not really necessary in this case and we can use a trick - 
    So in our tour template, we already have all the data about the tour itself 
    and so now we can simply put that data into our HTML (in 'data-' attribute) 
    so that JavaScript can then read it from there.
    So basically, we are gonna expose the location data, as a string in the HTML and 
    our JavaScript will then pick it up from there without having to do, like any API call separately.
*/

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1Ijoic2FtZWVyNTkiLCJhIjoiY2tocHJtdzRvMHpuODJ2azZpM2F0dW9zOSJ9.SrNl_idaw-ijP-WyhIlPig';
  var map = new mapboxgl.Map({
    container: 'map', // what that means is that it will put the map on an element with the ID of 'map'.
    //style: 'mapbox://styles/mapbox/streets-v11', // this is default style
    style: 'mapbox://styles/sameer59/ckhpthbqx0e3r19npooqaamjb', // this is our custom style using Mapbox Studio
    scrollZoom: false, // to avoid zooming via scroll, bcz when you scroll web page and when you are point of map, it scrolls in the map and not page, which is not a good user experience
    //center: [-118.249883, 34.055604], // where to start from, first longitude then latitude
    //zoom: 10, // zoom level
    //interactive: false, // map will look like simple image and we can zoom in zoom out, etc.
  });

  /*
    We don't want to center the map anywhere, but instead we want it to automatically figure out
    the position of the map based on our tour location points. 
    What we're gonna do now is basically put all the locations for a certain tour on the map,
    and then allow the map to basically figure out automatically which portion of the map 
    it should display in order to fit all of these points correctly.
  */
  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker'; // custom map pin image

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom', // the bottom of our custom pin is going to be located at the exact GPS location.
    })
      .setLngLat(loc.coordinates) // Lng first then Lat
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30, // to avoid popup on top of Marker
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  // fit the bounds on the map
  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
