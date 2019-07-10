var db = null;
var configdoc = "_local/config";
var config = null;
var newcount = null;
var replication = null;
var remoteCouch = 'http://192.168.1.131:5984/';

// get the currently seleted Chrome tab
var getCurrentTab = function(callback) {
  var getTab = function(callback){
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(array_of_Tabs) {
    var tab = array_of_Tabs[0];
    callback(null, tab);
  });
}};

var loadConfig = function(callback) {
  db.get(configdoc, function(err, data) {
    config = data;
    callback(null, data);
  });
};
// MapReduce function that orders by date
var map = function(doc) {
  if (doc.recipient == config.useremail) {
    if(doc.visited == 0){
      newcount += 1;
    }
    emit(doc,null);
  }
};

var initializeIcon = function() {
  kickOffReplication();
  db.query(map, {include_docs:true}).then(function(result) {
    if(newcount > 0){
      chrome.browserAction.setBadgeText( { text: newcount.toString() });
      chrome.browserAction.setBadgeBackgroundColor({color:'green'})
    }
    else {
      chrome.browserAction.setBadgeText( { text: '' });
    }
  });
 };

var kickOffReplication = function() {
    replication = db.sync(remoteCouch+"links", {
      live:true, 
      retry:true
    })
}
// when the page has loaded
$( document ).ready(function() {  
  // start up PouchDB
  db = new PouchDB("linkshare");
  initializeIcon();
  
  // load the config
   loadConfig(function(err, data) {  
    kickOffReplication();
  })
});
  //alert(JSON.stringify(doc));
