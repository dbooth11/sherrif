var db = null;
var configdoc = "_local/config";
var database = "sherrif";
var config = null;
var newcount = null;
var friends = '';
var html = '';
var replication = null;


var  db = new PouchDB(database);

db.get(configdoc, function(err, data) {
  if (err) {
    chrome.runtime.openOptionsPage();
  }
  config = data;
});


// MapReduce function that orders by date
var map = function(doc) {
  if (doc.friendemail == config.useremail) {
    if(doc.visited == 0){
      newcount += 1;
    }
    emit(doc,null);
  }
};

var initializeIcon = function() {
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
    replication = db.sync(config.url, {
      live:true, 
      retry:true
    })
}
var friendmap = function (doc) {
  if (doc.useremail == config.useremail) {
    emit(doc, null);
  }
};

function loadFriends() {
  db.query(friendmap, { include_docs: true }).then(function (result) {
    for (var i in result.rows) {
      var doc = result.rows[i].doc;
      html += '<a class="friend" role="alert" data-to=' + doc.friendemail + '>' + doc.friendname + '</a>'
    }
   friends = html;
  });
}

initializeIcon();

function alertOb(text){
  alert(JSON.stringify(text));
}
  //alert(JSON.stringify(doc));
