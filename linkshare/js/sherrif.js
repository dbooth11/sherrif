var db = null;
var configdoc = "_local/config";
var config = null;
var replication = null;

// get the currently seleted Chrome tab
var getCurrentTab = function(callback) {
  chrome.tabs.getSelected(null,function(tab) {
    console.log(tab);
    callback(null, tab);
  });
};

var loadConfig = function(callback) {
  db.get(configdoc, function(err, data) {
    if (err) {
      chrome.runtime.openOptionsPage();
    }
    config = data;
    callback(null, data);
  });
};

var saveConfig = function(callback) {
  db.put(config,callback);
};

var loadLinks = function(config) {
  console.log("into loadlinks");
  db.find({
    selector: {useremail: {$eq:config.useremail}}
  }).then(function (result) {
    var html = '<tbody>';
    var friends = '';
    for(var i in result.docs) {
      var doc = result.docs[i];
      if(doc.type == "link" ){
      html += '<tr>';
      if(doc.visited == 0){
      html += '<td class="alert-success"><a class="truncate" href="' + doc.url + '" title="' + doc.url + '" target="_new">' + doc.title + '</a><br />'
      }
      else{
      html += '<td><a class="truncate" href="' + doc.url + '" title="' + doc.url + '" target="_new">' + doc.title + '</a><br />'
      }
      html += '</td>';
      html += '<td><button class="pseudo delete" data-id="' + doc._id +'" data-rev="' + doc._rev + '"><img src="img/remove.png" class="removeicon"/></button></td>'
      html += '</tr>';
      }
      if(doc.type == 'friend'){
        friends += '<button class="alert alert-success" role="alert" data-friend="'+doc.friendemail+'">'+doc.friendname+'</button>';
     }
    }
    html += '</tbody>';
    $('#thetable').html(html);
    $('#friends').html(friends);


    // when the delete button is pressed
    $(".delete").bind("click", function(event) {
      var b = $( this );
      var id = b.attr("data-id");
      var rev = b.attr("data-rev");
      db.remove(id,rev, function() {
        loadLinks(config);
      })
    });
    
    $("button.alert").bind("click", function() {
      text1 = $(event.target).attr('data-friend');
      text2 = $(event.target).text();
      text = {friendname: text2, friendemail: text1}
      saveLink(text, function() {
      })
    });

  }).catch(function (err) {
    console.log(err);
  });

};

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
    $('#notice').html("Link sent to "+friend.friendname)

  });
};

var kickOffReplication = function() {
  if (replication != null) {
    replication.cancel();
  }
  if (config.url) {
    replication = db.sync(config.url, {
      live:true, 
      retry:true
    }).on('change', function(change){ 
      console.log("change", change);
      loadLinks();
    });
  }
}

// when the page has loaded
$( document ).ready(function() {
  console.log("document is ready!");
  
  // start up PouchDB
  db = new PouchDB("sherrif");
    
  // when the settings/save button is pressed
  $("#settingssave").bind("click", function() {
    config.url = $('#replicationurl').val();
    config.username = $(['#username']).val();
    config.useremail = $('#useremail').val();
    saveConfig(function(err, data) {
      kickOffReplication();
      console.log("save",err, data);
    })
  });
  
    // when the settings/save button is pressed
    $("#manageusers").bind("click", function() {
      chrome.runtime.openOptionsPage();
    });

  // load the config
  loadConfig(function(err, data) {
    console.log("!", err, data);
    if (!err && data.url) {
      $('#replicationurl').val(data.url);
      kickOffReplication();
      loadLinks(data);
    } 
  })
});
function alertOb(text){
  alert(JSON.stringify(text));
}