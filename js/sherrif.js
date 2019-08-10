var db = null;
var configdoc = "_local/config";
var config = null;
var replication = null;

// get the currently seleted Chrome tab
var getCurrentTab = function() {
  chrome.tabs.getSelected(null,function(tab) {
    console.log(tab);
    callback(null, tab);
  });
};
// Load the _local/config doc
var loadConfig = function(callback) {
  db.get(configdoc, function(err, data) {
    if (err) {
      //If config not set, open options to do so.
      chrome.runtime.openOptionsPage();
    }
    //This config needs to be available everywhere
    config = data;
    callback(null, data);
  });
};
// save the config locally
var saveConfig = function(callback) {
  db.put(config,callback);
};

// Loads the links in the popup.
var loadLinks = function(config) {
  console.log("into loadlinks");
  db.find({
    // Needs to get (type: link and friendemail: config.useremail) (current user) AND (type: friend  and useremail: config.useremail)
    selector: {friendemail: {$eq:config.useremail}}
  }).then(function (result) {
    var html = '<tbody>';
    var friends = '';
    for(var i in result.docs) {
      var doc = result.docs[i];
      if(doc.type == "link" ){
      html += '<tr>';
      if(doc.visited == 0){
      // set to green for new links. visited: 0
      html += '<td class="alert-success"><a class="truncate" href="' + doc.url + '" title="' + doc.url + '" target="_new">' + doc.title + '</a><br />'
      }
      else{
      //No green for links that have been visited. visited: 1
      html += '<td><a class="truncate" href="' + doc.url + '" title="' + doc.url + '" target="_new">' + doc.title + '</a><br />'
      }
      html += '</td>';
      html += '<td><button class="pseudo delete" data-id="' + doc._id +'" data-rev="' + doc._rev + '"><img src="img/remove.png" class="removeicon"/></button></td>'
      html += '</tr>';
      }
      // The friend records
      if(doc.type == 'friend'){
        friends += '<button class="alert alert-success" role="alert" data-friend="'+doc.friendemail+'">'+doc.friendname+'</button>';
     }
    }
    html += '</tbody>';
    // Append the table with generated html
    $('#thetable').html(html);
    $('#friends').html(friends);


    // when the delete button is pressed
    $(".delete").bind("click", function(event) {
      var b = $( this );
      var id = b.attr("data-id");
      var rev = b.attr("data-rev");
      db.remove(id,rev, function() {
        //I have to send config but it should be available already
        loadLinks(config);
      })
    });

    // Clicking a friends name in the popup will send them a link. 
    $("button.alert").bind("click", function() {
      text1 = $(event.target).attr('data-friend');
      text2 = $(event.target).text();
      text = {friendname: text2, friendemail: text1}
      //Useless callback
      saveLink(text, function() {
      })
    });

  }).catch(function (err) {
    console.log(err);
  });
// End of loadLinks()
};


//Create link record
var saveLink = function(friend, callback) {
  getCurrentTab(function(err, tab) {
    var seconds = new Date().getTime() / 1000;
    var id = 'link'+seconds.toString();
    var doc = {
      _id: id,
      type: 'link',
      url: tab.url,
      title: tab.title,
      useremail: config.useremail,
      friendemail: friend.friendemail,
      visited: 0
    }
    db.put(doc, callback);
    // send notice to popup. Should disappear after a bit.
    $('#notice').html("Link sent to "+friend.friendname);
  });
};
// Replicates the local Indexeddb to the Couchdb URL in the configdoc
var kickOffReplication = function() {
  if (config.url) {
    replication = db.sync(config.url, {
      live:true, 
      retry:true
    }).on('change', function(change){ 
      console.log("change", change);
    });
  }
}

// when the page has loaded
$( document ).ready(function() {
  console.log("document is ready!");
  // start up PouchDB
  db = new PouchDB("sherrif");
  
  // when the Manage Users button is pressed, open options page
  $("#manageusers").bind("click", function() {
    chrome.runtime.openOptionsPage();
    });

  // load the config. 
  loadConfig(function(err, data) {
 
      $('#replicationurl').val(data.url);
      kickOffReplication();
      loadLinks(data);
    
  })
});
function alertOb(text){
  alert(JSON.stringify(text));
}