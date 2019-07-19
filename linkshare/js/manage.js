var db = null;
var configdoc = '_local/config';
var database = 'sherrif';
var config = null;
var friends = '';
var sync = null;
var groups = '';
var remoteCouch = 'http://127.0.0.1:5984/'+database;

var db = new PouchDB(database);

function updateConfig(){  
      username = $('#username').val();
      useremail = $('#useremail').val();
      url = $('#couchdburl').val();
      db.put({
          _id: configdoc,
          _rev: config._rev,
          username: username,
          useremail: useremail,
          url:url
        }).then(function(response) {
        console.log('Config updated!');
      }).catch(function (err) {
        console.log(err);
      });
} 
var loadConfig = function() {
  db.get(configdoc, function(err, data) {
    config = data;
    if(config.useremail){
      $('#username').val(config.username);
      $('#useremail').val(config.useremail);
      $('#couchdburl').val(config.url);
    }
  });
};

function addDoc(doc){
  db.put(doc).then(function () {
      console.log('Doc Added.');
      }).catch(function (err) {
      console.log("Doc failed.");
      }); 
}

loadConfig();
db.allDocs({
    include_docs: true
  }).then(function (result) {
    var docs = result.rows.map(function (row) {
        if(row.doc.type == 'friend'){
           friends += '<div class="alert alert-success" role="alert">'+row.doc.friendname+'</div>';
        }
        if(row.doc.type == 'group'){
            groups += '<div class="alert alert-warning" role="alert">'+row.doc.groupname+'</div><div>'+row.doc.grouplist+'</div>';
         }
        $('#insertfriends').html(friends);
        //$('#insertgroups').html(groups);
      return row.doc;
    });
  }).catch(function (err) {
    console.log(err);
  });

$("#settingssave").bind("click", function() {
    updateConfig();
    var date = new Date();
    var seconds = date.getTime() / 1000;
    friendname = $('#friendname').val();
    friendemail = $('#friendemail').val();
    useremail = $('#useremail').val();

    //groupname = $('#groupname').val();
    //grouplist = $('#grouplist').val();
    // Adds a friend if filled out
    if(friendemail && friendname){
        doc = {_id: 'friend'+seconds, type: 'friend', useremail: useremail, friendname: friendname, friendemail: friendemail}
        addDoc(doc);
    }
    // Adds a group if filled out
    // if(groupname && grouplist){
    //     doc = {_id: 'group'+n, type: 'group', groupname: groupname, grouplist: grouplist, useremail: useremail}
    //     addDoc(doc);
    // }
});
  function alertOb(text){
    alert(JSON.stringify(text));
  }
