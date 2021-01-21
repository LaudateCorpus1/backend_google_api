// Client ID and API key from the Developer Console
var CLIENT_ID = "CLIENT_ID";
var API_KEY = "API_KEY";

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
  'https://docs.googleapis.com/$discovery/rest?version=v1'
];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  }, function (error) {
    append(JSON.stringify(error, null, 2));
  });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
  var runbutton = document.getElementById('scriptbutton');
  function submit(evt) {
    var text = document.getElementById('inputArea');
    update("Loading Script...", "s");
    var func = new Function(text.value);
    func();
    update("Script was run!", "s");
  }
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    update("Hello, " + gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getName() + "!");
    runbutton.addEventListener('click', submit);
    init();
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
    update("You're not signed, please press the authorize button above.");
    runbutton.removeEventListener('click', submit);
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

var p = document.getElementById('content');
var s = document.getElementById('status');
var c = document.getElementById('console');

function append(message, elem = "p") {
  if (elem == "p") {
    p.textContent +=  message + '\n';
  } else if (elem == "s") {
    s.textContent += message + '\n';
  } else {
    c.value += message + '\n';
  }
}

function clear(elem = "p") {
  if (elem == "p") {
    p.textContent = "";
  } else if (elem == "s") {
    s.textContent = "";
  } else {
    c.textContent = "";
  }
}

function update(message, elem = "p") {
  if (elem == "p") {
    p.textContent = message;
  } else if (elem == "s") {
    s.textContent = message;
  } else {
    c.textContent = message;
  }
}

//Used for Loading and Loaded Messages.
function print(message) {
  append(message, "c");
}

//Add tab capability.
Array.prototype.slice.call(document.getElementsByTagName('textarea')).forEach((area) => {
  area.addEventListener('keydown', function (e) {
    if (e.key == 'Tab') {
      e.preventDefault();
      var start = this.selectionStart;
      var end = this.selectionEnd;
      this.value = this.value.substring(0, start) +
        "\t" + this.value.substring(end);
      this.selectionStart =
        this.selectionEnd = start + 1;
    }
  });
});